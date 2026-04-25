# Modelagem de Dados

## Schema

```sql
templates (
  id          UUID PRIMARY KEY,
  company_id  UUID NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
)

template_versions (
  id             UUID PRIMARY KEY,
  template_id    UUID REFERENCES templates(id),
  version_number INT NOT NULL,
  status         VARCHAR NOT NULL,   -- 'draft' | 'published' | 'archived'
  config         JSONB NOT NULL,     -- steps embutidos
  created_at     TIMESTAMPTZ DEFAULT now(),
  published_at   TIMESTAMPTZ
)

workflow_instances (
  id           UUID PRIMARY KEY,
  company_id   UUID NOT NULL,
  template_id  UUID NOT NULL,
  version_id   UUID NOT NULL,
  status       VARCHAR NOT NULL,     -- 'draft' | 'active' | 'completed' | 'rejected'
  created_by   TEXT NOT NULL,
  snapshot     JSONB,                -- imutável após submit
  created_at   TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)

instance_steps (
  id            UUID PRIMARY KEY,
  instance_id   UUID REFERENCES workflow_instances(id),
  step_order    INT NOT NULL,
  step_name     TEXT NOT NULL,
  approval_rule VARCHAR NOT NULL,    -- 'ALL' | 'ANY' | 'QUORUM'
  quorum_count  INT,
  approvers     JSONB NOT NULL,      -- lista de user IDs aprovadores
  sla_hours     INT NOT NULL,
  sla_deadline  TIMESTAMPTZ,         -- calculado no submit
  sla_breached  BOOLEAN DEFAULT false,
  status        VARCHAR NOT NULL,    -- 'pending' | 'approved' | 'rejected'
  version       INT DEFAULT 0,       -- optimistic locking
  decisions     JSONB NOT NULL       -- array de StepDecision embutido
  -- cada elemento: { actorId, decision, decidedAt, isDelegated, originalApproverId }
)

delegations (
  id           UUID PRIMARY KEY,
  company_id   UUID NOT NULL,
  delegator_id TEXT NOT NULL,
  delegate_id  TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
)

audit_logs (
  id          UUID PRIMARY KEY,
  company_id  UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  action      TEXT NOT NULL,
  actor_id    TEXT NOT NULL,
  payload     JSONB,
  occurred_at TIMESTAMPTZ DEFAULT now()
  -- append-only: sem UPDATE nem DELETE
)

outbox_events (
  id             UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id   UUID NOT NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL,
  published      BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
)
```

---

## Índices Críticos

```sql
-- Filtrar instâncias por tenant e status (query mais frequente)
CREATE INDEX ON workflow_instances (company_id, status);

-- Steps em ordem dentro de uma instância
CREATE INDEX ON instance_steps (instance_id, step_order);

-- SLA checker: steps pendentes com deadline ultrapassado
CREATE INDEX ON instance_steps (sla_deadline) WHERE status = 'pending';

-- Inbox do aprovador: busca por JSONB containment nos aprovadores do step
CREATE INDEX ON instance_steps USING gin(approvers);

-- Delegações ativas de um delegado
CREATE INDEX ON delegations (delegate_id, expires_at) WHERE active = true;

-- Outbox poller: eventos não publicados
CREATE INDEX ON outbox_events (published, created_at) WHERE published = false;
```

---

## Decisões de Modelagem

**`config JSONB` em `template_versions`** — os steps do template ficam embutidos na versão para facilitar o snapshot. Quando a instância é submetida, essa config é copiada para `snapshot JSONB` em `workflow_instances`, tornando a instância imune a alterações futuras no template.

**`decisions JSONB` em `instance_steps`** — as decisões de aprovação/rejeição são armazenadas como array JSONB diretamente no step, não em tabela separada. Isso simplifica o carregamento do aggregate (sem join extra) e é adequado dado que o número de decisões por step é pequeno e limitado pelo número de aprovadores configurados.

**`approvers JSONB` em `instance_steps`** — lista de IDs dos aprovadores resolvidos no momento do submit (parte do snapshot). Indexada com GIN para suportar `@>` containment check eficiente no inbox query.

**`sla_deadline TIMESTAMPTZ` em `instance_steps`** — calculado no `submit` como `submitted_at + slaHours`. Exposto diretamente nas leituras de instância.

**`version INT` em `instance_steps`** — coluna de controle para optimistic locking. O UPDATE sempre inclui `WHERE version = :atual`, e incrementa `version` em 1. Se 0 rows afetadas, outro ator ganhou a corrida → 409 Conflict.

**`audit_logs` append-only** — nenhum repositório expõe método de update ou delete nessa tabela. Em produção, protegido por role PostgreSQL sem `UPDATE`/`DELETE`.

**`outbox_events`** — garante atomicidade entre persistir a decisão e publicar o evento no broker. Inserido na mesma transação do aggregate (junto com o estado e a auditoria); publicado por um poller separado após o commit.
