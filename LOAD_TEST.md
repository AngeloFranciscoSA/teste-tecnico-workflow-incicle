# Teste de Carga — InCicle Workflow

## Pré-requisitos

```bash
# Instalar k6
# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6
```

## Preparação do ambiente

```bash
# 1. Subir a infraestrutura
docker-compose up -d

# 2. Aguardar a API inicializar
curl -s http://localhost:3000/health/ready

# 3. Rodar o seed (10k instâncias)
npx ts-node -r tsconfig-paths/register src/shared/infra/database/seed.ts
```

Se a API estiver usando o valor padrão de `.env.example`, exporte também o segredo JWT antes dos testes:

```bash
export JWT_SECRET=change-me
```

## Executar os testes

```bash
# Rodar todos de uma vez
./load-tests/run-all.sh http://localhost:3000

# Ou individualmente (JWT_SECRET deve bater com o valor no .env)
k6 run --env BASE_URL=http://localhost:3000 --env JWT_SECRET=change-me load-tests/inbox.js
k6 run --env BASE_URL=http://localhost:3000 --env JWT_SECRET=change-me load-tests/approve.js
k6 run --env BASE_URL=http://localhost:3000 --env JWT_SECRET=change-me load-tests/timeline.js
```

---

## Metodologia

### Base de dados
- **10.000 instâncias** pré-criadas via seed com status `active` e snapshot persistido
- Cada instância possui **1 step pendente real** pronto para aprovação, alternando entre gerência e diretoria
- Todas no mesmo tenant para simular isolamento real

### Perfil de carga

| Endpoint                      | Ramp-up      | Pico (VUs) | Duração sustentada |
|-------------------------------|--------------|------------|--------------------|
| `GET /approvals/inbox`        | 30s → 20 VUs | 100 VUs    | 1m                 |
| `POST /approvals/approve`     | 20s → 10 VUs | 30 VUs     | 1m                 |
| `GET /instances/:id/timeline` | 30s → 30 VUs | 80 VUs     | 2m                 |

### Metas

| Métrica                    | Meta                                          |
|----------------------------|-----------------------------------------------|
| p95 latência               | < 500ms                                       |
| Taxa de erro               | < 2%                                          |
| Conflitos (409) no approve | Esperado — indica optimistic lock funcionando |

---

## Relatório de Resultados

### Ambiente de teste

| Item       | Valor                           |
|------------|---------------------------------|
| Data       | 2026-04-17                      |
| Plataforma | WSL2 (Windows) + Docker Desktop |
| PostgreSQL | PostgreSQL 16 (Docker)          |
| Node.js    | v22 (Docker)                    |
| Base       | 10.000 instâncias via seed      |

### GET /approvals/inbox

| Métrica            | Resultado  | Meta    | Status   |
|--------------------|------------|---------|----------|
| Throughput (req/s) | 8.3 req/s  | —       | —        |
| p50 latência       | 3.76s      | —       | —        |
| p95 latência       | 38.2s      | < 500ms | ✗ FALHOU |
| Taxa de erro       | 0.00%      | < 2%    | ✓        |

> **Causa:** a query já utiliza JOIN direto com filtro JSONB (`?|`) e índice GIN em `instance_steps.approvers`. O gargalo real não é a busca, mas o **volume de dados retornado**: com 10k instâncias ativas onde o usuário é aprovador, cada resposta serializa ~1 MB de payload. Ver Gargalo 1.

### POST /approvals/approve

| Métrica                        | Resultado   | Meta     | Status   |
|--------------------------------|-------------|----------|----------|
| Throughput (req/s)             | 95.9 req/s  | —        | —        |
| p50 latência (approve)         | 14.34ms     | —        | —        |
| p95 latência (approve)         | 26.82ms     | < 500ms  | ✓        |
| Taxa de erro                   | 0.00%       | < 2%     | ✓        |
| 409 Conflict (optimistic lock) | detectados  | esperado | ✓        |

> Cada iteração faz GET `/instances/:id` + POST `/approve`. O p95 de 26.82ms reflete o custo real da escrita transacional (estado + auditoria + outbox). Os 409 registrados confirmam que o optimistic locking está ativo e funcional.

### GET /instances/:id/timeline

| Métrica            | Resultado | Meta    | Status |
|--------------------|-----------|---------|--------|
| Throughput (req/s) | 150 req/s | —       | —      |
| p50 latência       | 2.89ms    | —       | —      |
| p95 latência       | 5.31ms    | < 500ms | ✓      |
| Taxa de erro       | 0.00%     | < 2%    | ✓      |

---

## Gargalos Identificados

### Gargalo 1: `GET /approvals/inbox` com muitas instâncias ativas

**Problema:** A query já utiliza JOIN direto com filtro JSONB e índice GIN (migration `1700000000001-AddGinIndexApprovers`), o que resolve o tempo de busca. O gargalo remanescente é o **volume de dados retornado**: em cenários onde o usuário é aprovador em milhares de instâncias ativas, a resposta pode atingir ~1 MB por request, saturando I/O de rede e memória sob carga concorrente.

**Solução implementada:** índice GIN em `instance_steps.approvers` + query com JOIN filtrado no banco.

**Solução definitiva (próximo passo):** paginação cursor-based com `LIMIT` + `ORDER BY sla_deadline ASC`, retornando os itens com SLA mais urgente primeiro e permitindo navegação incremental:

```sql
SELECT i.id AS "instanceId", i.company_id AS "tenantId",
       s.id AS "stepId", s.step_name AS "stepName", s.approvers
FROM workflow_instances i
JOIN instance_steps s ON s.instance_id = i.id
WHERE i.company_id = $1
  AND i.status = 'active'
  AND s.status = 'pending'
  AND s.approvers ?| $2
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(s.decisions) d WHERE d->>'actorId' = $3
  )
  AND s.sla_deadline > $4  -- cursor
ORDER BY s.sla_deadline ASC
LIMIT 50
```

### Gargalo 2: `GET /instances/:id/timeline` sem cache

**Problema:** Cada request reconstrói a timeline lendo todos os events do aggregate. Para instâncias com muitas decisões, isso pode ser custoso.

**Proposta de melhoria:** Materializar a timeline em tabela separada via event handlers (projeção CQRS). Reads passam a ser O(1) por instância.

### Gargalo 3: Conexões PostgreSQL sob pico

**Problema:** Com 100 VUs simultâneos, o pool de conexões pode se esgotar.

**Proposta de melhoria:** Configurar `poolSize` no TypeORM e adicionar PgBouncer como connection pooler no docker-compose para produção.
