# Contrato de API

Swagger interativo disponível em `http://localhost:3000/api`.  
Spec estática em `openapi.yaml` (gerada automaticamente na inicialização).

---

## Autenticação

Todas as rotas de negócio exigem `Authorization: Bearer <jwt>`.

Claims mínimas do token:

| Claim       | Descrição                 | Exemplo                                |
|-------------|---------------------------|----------------------------------------|
| `sub`       | ID do usuário autenticado | `user-manager-1`                       |
| `companyId` | UUID do tenant            | `a0000000-0000-0000-0000-000000000001` |

> `GET /health` e `GET /health/ready` são públicos.

---

## Endpoints

### Templates

| Método | Rota                                         | Descrição                                  |
|--------|----------------------------------------------|--------------------------------------------|
| `POST` | `/templates`                                 | Criar template                             |
| `POST` | `/templates/:id/versions`                    | Adicionar versão draft                     |
| `POST` | `/templates/:id/versions/:versionId/publish` | Publicar versão (imutável após publicação) |
| `GET`  | `/templates`                                 | Listar templates do tenant                 |
| `GET`  | `/templates/:id`                             | Detalhar template com versões e steps      |

### Instâncias

| Método | Rota                      | Descrição                                    |
|--------|---------------------------|----------------------------------------------|
| `POST` | `/instances`              | Criar instância (status: draft)              |
| `POST` | `/instances/:id/submit`   | Submeter — congela snapshot e inicia fluxo   |
| `GET`  | `/instances`              | Listar instâncias (filtro: `?status=active`) |
| `GET`  | `/instances/:id`          | Detalhar instância com steps e decisões      |
| `GET`  | `/instances/:id/timeline` | Timeline auditável em ordem cronológica      |

### Aprovações

| Método | Rota                                           | Descrição                                   |
|--------|------------------------------------------------|---------------------------------------------|
| `GET`  | `/approvals/inbox`                             | Steps pendentes para o usuário corrente     |
| `POST` | `/approvals/:instanceId/steps/:stepId/approve` | Aprovar step (idempotente, optimistic lock) |
| `POST` | `/approvals/:instanceId/steps/:stepId/reject`  | Rejeitar step (encerra o workflow)          |

### Delegações

| Método   | Rota                  | Descrição                                         |
|----------|-----------------------|---------------------------------------------------|
| `POST`   | `/delegations`        | Criar delegação (detecta ciclos)                  |
| `GET`    | `/delegations`        | Listar todas as delegações do tenant              |
| `GET`    | `/delegations/active` | Listar apenas delegações ativas e dentro do prazo |
| `DELETE` | `/delegations/:id`    | Revogar delegação                                 |

### Analytics

| Método | Rota                        | Descrição                        |
|--------|-----------------------------|----------------------------------|
| `GET`  | `/analytics/sla-compliance` | Relatório de conformidade de SLA |

### Health

| Método | Rota            | Descrição                     |
|--------|-----------------|-------------------------------|
| `GET`  | `/health`       | Liveness check                |
| `GET`  | `/health/ready` | Readiness check (DB + broker) |

---

## Códigos de Status

| Status | Situação                                                     |
|--------|--------------------------------------------------------------|
| `200`  | Leitura bem-sucedida                                         |
| `201`  | Criação ou ação bem-sucedida                                 |
| `400`  | DTO inválido ou regra de negócio violada                     |
| `401`  | Token ausente, inválido, expirado ou com claims faltando     |
| `403`  | Token válido, mas o ator não tem permissão para a ação       |
| `404`  | Recurso não encontrado                                       |
| `409`  | Conflito de concorrência (optimistic lock) — tente novamente |
| `422`  | Entidade não processável (ex: ciclo de delegação detectado)  |
| `500`  | Erro interno                                                 |

---

## Exemplos de Payload

### Criar template

```json
POST /templates
{
  "id": "uuid-do-template",
  "name": "Aprovação de Compras"
}
```

### Criar versão com steps

```json
POST /templates/:id/versions
{
  "id": "uuid-da-versao",
  "steps": [
    {
      "id": "uuid-step-1",
      "stepOrder": 1,
      "stepName": "Aprovação Gerência",
      "approvalRule": "ALL",
      "approvers": ["user-manager-1"],
      "slaHours": 24
    },
    {
      "id": "uuid-step-2",
      "stepOrder": 2,
      "stepName": "Aprovação Diretoria",
      "approvalRule": "ANY",
      "approvers": ["user-director-1", "user-director-2"],
      "slaHours": 48
    }
  ]
}
```

### Criar instância

```json
POST /instances
{
  "id": "uuid-da-instancia",
  "templateId": "uuid-do-template",
  "versionId": "uuid-da-versao"
}
```

### Aprovar step

```json
POST /approvals/:instanceId/steps/:stepId/approve
{
  "comment": "Aprovado conforme orçamento disponível."
}
```

### Criar delegação

```json
POST /delegations
{
  "id": "uuid-da-delegacao",
  "delegateId": "uuid-do-substituto",
  "startsAt": "2026-04-16T00:00:00.000Z",
  "expiresAt": "2026-04-30T23:59:59.000Z"
}
```
