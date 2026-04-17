# Arquitetura — Workflow InCicle

## Por que DDD?

Este sistema tem regras de negócio complexas e centrais: lógicas de aprovação (ALL/ANY/QUORUM), snapshots imutáveis que refletem um estado organizacional no tempo, ciclos de delegação e SLA por etapa. Quando a complexidade reside no domínio, não na infraestrutura, DDD é a abordagem correta pois:

- **Isola as regras de negócio** da infraestrutura (banco, broker, HTTP). Toda a lógica de aprovação pode ser testada sem subir banco ou fila.
- **Aggregates definem consistência transacional**: cada transação modifica um único aggregate root, eliminando locks distribuídos complexos.
- **Domain Events desacoplam side-effects**: auditoria, atualização de SLA e notificações são consequências de eventos, não lógica embutida nos casos de uso.
- **Linguagem Ubíqua**: o código fala a língua do negócio — `WorkflowInstance.submit()`, `ApprovalRule.isSatisfiedBy()`, `Delegation.isExpired()`.

---

## Bounded Contexts

O domínio foi dividido em três contextos com responsabilidades claras:

```
┌──────────────────────────────────────────────────────────┐
│                    CORE DOMAIN                           │
│                                                          │
│  ┌─────────────────────────┐                             │
│  │    Workflow Context      │  Templates, Instâncias,    │
│  │    (contexto principal)  │  Aprovações, SLA           │
│  └─────────────────────────┘                             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                  SUPPORTING DOMAINS                      │
│                                                          │
│  ┌──────────────────────┐   ┌───────────────────────┐    │
│  │  Delegation Context  │   │  Analytics Context    │    │
│  │  Delegação com       │   │  SLA compliance,      │    │
│  │  detecção de ciclo   │   │  métricas e relatórios│    │
│  └──────────────────────┘   └───────────────────────┘    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   GENERIC DOMAIN                         │
│                                                          │
│  ┌──────────────────────┐                                │
│  │   Shared Kernel      │  AggregateRoot, Entity,        │
│  │                      │  ValueObject, DomainEvent,     │
│  │                      │  TenantId, Result<T>           │
│  └──────────────────────┘                                │
└──────────────────────────────────────────────────────────┘
```

**Core Domain** é onde está o maior valor de negócio. Os supporting domains existem para apoiar o core sem poluí-lo.

---

## Camadas por Bounded Context

Cada contexto tem exatamente três camadas. Dependências sempre apontam para dentro (Dependency Rule):

```
  HTTP / Broker
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │  INFRA  (Controllers, TypeORM repos, RabbitMQ)  │
  │  Implementa as interfaces definidas no Domain   │
  └─────────────────────────────────────────────────┘
       │ depende de
       ▼
  ┌─────────────────────────────────────────────────┐
  │  APPLICATION  (Commands, Queries, Handlers)     │
  │  Orquestra o domínio; sem regra de negócio      │
  └─────────────────────────────────────────────────┘
       │ depende de
       ▼
  ┌─────────────────────────────────────────────────┐
  │  DOMAIN  (Aggregates, VOs, Events, Services)    │
  │  Sem dependência de framework ou banco          │
  └─────────────────────────────────────────────────┘
```

**Domain** não importa nada de NestJS, TypeORM ou RabbitMQ. É TypeScript puro — permite testar todo o comportamento de negócio em milissegundos, sem mocks de infraestrutura.

**Application** usa interfaces (portas) para acessar banco e broker. As implementações concretas estão em Infra e são injetadas via NestJS DI.

**Infra** é o único lugar que conhece TypeORM, RabbitMQ e HTTP. Aqui vivem os ORM entities (distintos das domain entities), os repositórios concretos e os controllers.

> `workflow-instance.aggregate.ts` (domain entity rica, sem decorator TypeORM) é diferente de `workflow-instance.orm-entity.ts` (mapeamento de banco, sem lógica de negócio). O repositório traduz entre os dois.

---

## Estrutura de Pastas

```
src/
├── contexts/
│   ├── workflow/                         ← CORE DOMAIN
│   │   ├── domain/
│   │   │   ├── aggregates/
│   │   │   │   ├── workflow-template/
│   │   │   │   └── workflow-instance/
│   │   │   ├── value-objects/
│   │   │   ├── events/
│   │   │   ├── services/
│   │   │   └── repositories/            ← interfaces (portas)
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   ├── queries/
│   │   │   └── handlers/
│   │   └── infra/
│   │       ├── persistence/
│   │       └── http/
│   ├── delegation/                       ← SUPPORTING DOMAIN
│   └── analytics/                        ← SUPPORTING DOMAIN
│
└── shared/                               ← GENERIC DOMAIN / SHARED KERNEL
    ├── domain/
    │   ├── aggregate-root.base.ts
    │   ├── entity.base.ts
    │   ├── value-object.base.ts
    │   ├── domain-event.base.ts
    │   └── result.ts
    └── infra/
        ├── database/
        ├── messaging/
        ├── audit/
        └── logging/                      ← Winston logger global
```

> **`logs/`** — pasta na raiz do projeto criada em runtime. Contém `app.log` (todos os níveis) e `error.log` (warn + error), com rotação automática a cada 10 MB. Os arquivos `.log` são ignorados pelo `.gitignore`; a pasta é versionada via `.gitkeep`.

---

## Aggregates e Entidades

Um **Aggregate** é um cluster de entidades e value objects tratado como uma unidade de consistência. Só o **Aggregate Root** é acessível de fora.

### `WorkflowTemplate`

```
WorkflowTemplate (Aggregate Root)
  ├── id, tenantId, name
  └── versions: TemplateVersion[]
        ├── id, versionNumber, status (draft | published | archived)
        └── steps: TemplateStep[]
              ├── order, approvers
              └── approvalRule: ApprovalRule  ← Value Object
```

Regras encapsuladas:
- `publish()` — só transita `draft → published`; lança exceção caso contrário.
- Versão publicada não pode ser modificada.

### `WorkflowInstance`

```
WorkflowInstance (Aggregate Root)
  ├── id, tenantId, templateVersionId
  ├── status (draft | active | completed | rejected)
  ├── snapshot: Snapshot               ← Value Object imutável
  └── steps: InstanceStep[]
        ├── id, status, version        ← version = optimistic locking
        └── decisions: StepDecision[]
              ├── actorId, decision (approve | reject)
              └── isDelegated: boolean
```

Regras encapsuladas:
- `submit(snapshot)` — exige versão publicada; persiste snapshot imutável.
- `decide(stepId, actorId, decision)` — verifica idempotência, aplica decisão, avalia `ApprovalRule`, emite evento.

### `Delegation`

```
Delegation (Aggregate Root)
  ├── id, tenantId, delegatorId, delegateId
  └── period: DelegationPeriod  ← Value Object (startsAt, expiresAt)
```

---

## Value Objects

Imutáveis e sem identidade. Igualdade por valor, não por referência.

| Value Object       | Responsabilidade |
|--------------------|-----------------|
| `ApprovalRule`     | Encapsula `ALL`, `ANY` ou `QUORUM(n)`. Método `isSatisfiedBy(decisions, total)` retorna `boolean`. |
| `Snapshot`         | Cópia imutável do template + aprovadores resolvidos no momento do submit. |
| `SlaDeadline`      | Data-limite calculada a partir de `criadoEm + slaHours`. Método `isBreached()`. |
| `TenantId`         | Wrapper tipado para UUID do tenant — evita misturar IDs de tipos distintos. |
| `DelegationPeriod` | Intervalo de validade. Método `contains(date)`. |

---

## Domain Events

Eventos são fatos imutáveis que **já aconteceram**. O aggregate os emite em memória; handlers na camada Application os processam após a persistência.

```
InstanceSubmittedEvent    → publica no RabbitMQ, inicia SLA tracking
StepApprovedEvent         → avalia conclusão da instância, registra auditoria
StepRejectedEvent         → rejeita instância, registra auditoria
InstanceCompletedEvent    → notificação externa via broker
SlaBreachedEvent          → escalonamento, registra breach
DelegationCreatedEvent    → auditoria
```

Eventos só são emitidos após o aggregate ser salvo com sucesso — garantido pelo fluxo do repositório.

---

## Domain Services

Quando uma regra envolve mais de um aggregate ou não pertence naturalmente a nenhum deles:

| Domain Service                 | Responsabilidade                                               |
|--------------------------------|----------------------------------------------------------------|
| `SnapshotBuilderService`       | Recebe `TemplateVersion` + org chart e constrói o `Snapshot`.  |
| `ApprovalRuleEvaluatorService` | Avalia se decisões satisfazem a `ApprovalRule` de um step.     |
| `CycleDetectorService`         | BFS/DFS sobre grafo de delegações ativas para detectar ciclos. |

---

## Fluxo Completo de uma Aprovação

`POST /approvals/:instanceId/steps/:stepId/approve`

```
HTTP Request (Authorization: Bearer <jwt>)
    │
    ▼
JwtAuthGuard (Global — APP_GUARD)
    │  - valida assinatura HS256, exp, nbf
    │  - exige claims sub + companyId
    │  - grava { userId, companyId } em request.auth
    │  - 401 se token inválido/ausente
    ▼
ApprovalsController (Infra)
    │  - @TenantId() / @ActorId() leem request.auth (não headers livres)
    │  - valida DTO
    │  - dispara ApproveStepCommand
    ▼
ApproveStepHandler (Application)
    │  1. busca delegação ativa para o actor
    │  2. carrega WorkflowInstance via repositório
    │  3. verifica step.canBeDecidedBy(actorId, originalApproverId)
    │     └─ 403 se o ator não for aprovador nem delegado válido
    │  4. chama instance.decide(stepId, actorId, 'approve', isDelegated)
    │     └─ WorkflowInstance (Domain)
    │           - verifica idempotência
    │           - cria StepDecision entity
    │           - avalia ApprovalRule.isSatisfiedBy()
    │           - avança step / completa instância se necessário
    │           - emite StepApprovedEvent em memória
    │  5. dataSource.transaction(manager => {
    │       instanceRepo.save(instance, manager)   ← estado
    │       auditService.log(..., manager)          ← auditoria
    │       outboxPublisher.saveToOutbox(..., manager) ← envelope
    │     })                                        ← COMMIT atômico
    │  6. após commit: publishPending() → RabbitMQ
    │     └─ UPDATE WHERE version = $currentVersion
    │        (0 rows → 409 Conflict — optimistic lock)
    ▼
RabbitMQ (Infra)
    └─ consumidores: SLA tracker, notificações externas
```
