# Decisões Técnicas e Trade-offs

## Mensageria: RabbitMQ

**Por que RabbitMQ?**

- Integração NestJS first-class via `@nestjs/microservices`.
- Exchange `topic` roteia eventos por padrão semântico: `workflow.instance.submitted`, `workflow.step.approved`.
- Dead Letter Exchange (DLX): mensagens que falham após N tentativas vão para DLX — sem perda silenciosa.
- Durabilidade com `durable: true` — eventos sobrevivem a restarts.
- Operação simples via Docker: sem ZooKeeper ou gerenciamento de partições.

**RabbitMQ vs. Kafka:**

| Critério             | RabbitMQ   | Kafka              |
|----------------------|------------|--------------------|
| Latência             | ~1ms       | Maior (batching)   |
| Throughput           | Alto       | Muito alto         |
| Replay de eventos    | Não nativo | Nativo (retention) |
| Ordering garantido   | Por fila   | Por partição       |
| Overhead operacional | Baixo      | Alto               |

Para um sistema de aprovações corporativas (não streaming de analytics), RabbitMQ oferece a melhor relação custo-benefício. A troca para Kafka faria sentido se o sistema evoluir para event sourcing completo com necessidade de replay histórico.

---

## Concorrência: Optimistic Locking

**Problema:** dois aprovadores clicam "aprovar" simultaneamente no mesmo step.

**Solução:** coluna `version` em `instance_steps`. O UPDATE inclui `WHERE version = :currentVersion`. Se retornar 0 rows, outro ator ganhou a corrida → `409 Conflict`.

```sql
UPDATE instance_steps
SET status = 'approved', version = version + 1
WHERE id = $1 AND version = $2
```

Pessimistic locking (`SELECT FOR UPDATE`) foi descartado pois manteria o step bloqueado durante toda a chamada ao broker, degradando throughput sob carga.

O teste de concorrência usa N=20 requests simultâneos no mesmo step. Com optimistic locking, exatamente 1 deve ser efetivado e os demais retornam 409.

---

## Outbox Pattern

Garante atomicidade entre persistir a decisão e publicar o evento no RabbitMQ.

**Sem Outbox** — cenários de falha:
- Aggregate salvo no banco → falha de rede → evento nunca chega ao broker.
- Evento enviado ao broker → falha no commit do banco → estado inconsistente.

**Com Outbox:**

```
Transação única:
  1. UPDATE instance_steps (decisão)
  2. INSERT outbox_events (evento serializado)

Poller (processo separado):
  3. SELECT FROM outbox_events WHERE published = false
  4. Publica no RabbitMQ
  5. UPDATE outbox_events SET published = true
```

Falhas no step 4 são seguras: o poller vai tentar novamente. Com idempotency key nos consumers, publicações duplicadas são ignoradas.

---

## Snapshot Imutável

Quando uma instância é submetida (`POST /instances/:id/submit`), o sistema congela uma cópia completa do template no momento do submit — incluindo aprovadores resolvidos, regras e SLA.

Isso garante que alterações futuras no org chart ou no template **não afetam instâncias já em andamento**. A instância sempre reflete o estado organizacional do momento em que foi criada.

---

## Detecção de Ciclo em Delegações

Ao criar uma delegação `A → B`, o sistema executa BFS/DFS sobre o grafo de delegações ativas do tenant partindo de `B`. Se alcançar `A`, o ciclo é bloqueado com `422 Unprocessable Entity`.

Complexidade O(V+E), limitada ao escopo do tenant por `company_id`.

Exemplo bloqueado: `A → B → C → A`.

---

## Auditoria Imutável

`audit_logs` é append-only por convenção de aplicação: nenhum repositório expõe método de `update` ou `delete` nessa tabela.

Cada operação de escrita (submit, approve, reject, delegação) registra uma entrada com: `entity_type`, `entity_id`, `action`, `actor_id`, `payload` e `occurred_at`.

Em produção, a imutabilidade pode ser reforçada com role PostgreSQL sem permissão de `UPDATE`/`DELETE` na tabela.

---

## Autenticação: JWT Guard Global

Toda rota de negócio é protegida por `JwtAuthGuard`, registrado como `APP_GUARD` global no `AppModule`. O guard:

1. Verifica a presença do header `Authorization: Bearer <token>`.
2. Valida a assinatura HMAC-SHA256 com `JWT_SECRET`.
3. Checa `exp` e `nbf` do token.
4. Exige que o payload contenha `sub` (userId) e `companyId`.
5. Grava `{ userId, companyId }` em `request.auth`.

Os decorators `@TenantId()` e `@ActorId()` nos controllers apenas leem `request.auth` — não há extração de headers livres. Rotas públicas usam o decorator `@Public()` (somente `/health` e `/health/ready`).

---

## Atomicidade: Estado, Auditoria e Outbox na Mesma Transação

`submit`, `approve` e `reject` persistem três coisas numa única transação PostgreSQL:

```
BEGIN
  1. UPSERT workflow_instances / UPDATE instance_steps  ← estado do aggregate
  2. INSERT audit_logs                                  ← registro imutável
  3. INSERT outbox_events                               ← envelope para o broker
COMMIT
```

Só após o `COMMIT` o serviço tenta publicar os eventos pendentes no RabbitMQ (`publishPending()`). Se a publicação falhar, o estado e a auditoria já estão persistidos e o poller tentará novamente — sem inconsistência possível.

O `EntityManager` transacional é passado explicitamente para `instanceRepo.save(instance, manager)`, `auditService.log(..., manager)` e `outboxPublisher.saveToOutbox(..., manager)`, garantindo que os três participem da mesma transação aberta pelo handler.

---

## Multi-tenancy

Isolamento por `company_id` (aka `tenant_id`) em todas as tabelas. Todas as queries de leitura filtram por `company_id`, garantindo que dados de um tenant nunca vazem para outro.

Os valores de `companyId` e `userId` são extraídos do JWT Bearer validado pelo guard global (ver seção acima). Os decorators customizados (`@TenantId()`, `@ActorId()`) leem o contexto autenticado já resolvido no request.

---

## Logging: Winston

O logger padrão do NestJS (`console.log`) foi substituído pelo **Winston** via `nest-winston`, registrado como `@Global()` no `LoggerModule`.

**Motivação:** NestJS não persiste logs em arquivo nem suporta rotação. Em produção, logs estruturados em JSON são necessários para correlação com ferramentas como Datadog, Loki ou CloudWatch.

**Configuração:**

| Transport | Nível mínimo | Formato | Rotação |
|-----------|-------------|---------|---------|
| Console | `info` | Colorido (dev) / JSON (prod) | — |
| `logs/app.log` | `info` | JSON | 10 MB, 5 arquivos |
| `logs/error.log` | `warn` | JSON | 10 MB, 5 arquivos |

**Como usar em qualquer serviço:**

```typescript
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class MeuService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  fazerAlgo() {
    this.logger.log('Operação executada', 'MeuService');
    this.logger.error('Falha inesperada', stack, 'MeuService');
  }
}
```

O `context` (terceiro argumento) aparece como campo `context` no JSON e como `[MeuService]` no console colorido.

---

## UUIDs como identificadores

Todos os aggregates usam UUID como ID pelos seguintes motivos:

1. **DDD** — o aggregate gera seu próprio ID antes do INSERT, sem depender de sequence do banco.
2. **Multi-tenancy** — elimina colisão semântica de IDs entre tenants em eventos assíncronos.
3. **Segurança básica** — IDs não são enumeráveis por iteração sequencial.
