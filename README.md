# Workflow InCicle — API de Aprovações Corporativas

API de workflow de aprovações corporativas multi-tenant com templates versionados, snapshots imutáveis, delegação de aprovadores, auditoria completa e controle de SLA.

---

## Quickstart

```bash
cp .env.example .env
docker compose up --build
# API:     http://localhost:3000
# Swagger: http://localhost:3000/api
```

Para rodar em modo de desenvolvimento (hot reload):

```bash
docker compose up postgres rabbitmq -d
npm install
npm run start:dev
```

Para rodar os testes E2E via Docker Compose:

```bash
docker compose --profile test run --rm api-test
```

Se o banco local estiver com schema desatualizado (drift), use:

```bash
docker compose down -v   # remove volumes — banco é recriado do zero
docker compose up --build
```

---

## Tokens JWT para Testes

A API valida JWT HS256 com o campo `companyId` (tenant) no payload. Não há endpoint de login — o token é emitido por um IdP externo. Para testes locais, use os tokens abaixo, gerados com `JWT_SECRET=change-me` (padrão do `.env.example`):

| Usuário  | `sub`             | Token                                                                                                                                                                                                                                  |
|----------|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Manager  | `user-manager-1`  | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLW1hbmFnZXItMSIsImNvbXBhbnlJZCI6ImEwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsImlhdCI6MTc0NDc2MTYwMCwiZXhwIjo5OTk5OTk5OTk5fQ.TRwX7loxF0TWgk94HkN93UcMfR-4yIT2o8pvwweZ8JQ`  |
| Director | `user-director-1` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWRpcmVjdG9yLTEiLCJjb21wYW55SWQiOiJhMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJpYXQiOjE3NDQ3NjE2MDAsImV4cCI6OTk5OTk5OTk5OX0.6H6j6NNCTSIRKI8AISaybpKWZgPaPb8gT6n4Cko58mc` |

Ambos pertencem ao tenant `companyId: a0000000-0000-0000-0000-000000000001` e não expiram.

**Swagger UI:** clique em **Authorize** (cadeado) e cole `Bearer <token>` no campo.

**VS Code REST Client / IntelliJ HTTP Client:** abra `api.http` — os tokens já estão configurados como variáveis `@tokenManager` e `@tokenDirector`.

---

## Variáveis de Ambiente

| Variável            | Descrição                                       | Padrão                                     |
|---------------------|-------------------------------------------------|--------------------------------------------|
| `APP_PORT`          | Porta da API                                    | `3000`                                     |
| `DB_HOST`           | Host do PostgreSQL                              | `localhost`                                |
| `DB_HOST_TEST`      | Host do PostgreSQL usado pelos testes E2E       | `localhost` no host / `postgres` no Docker |
| `DB_PORT`           | Porta do PostgreSQL                             | `5432`                                     |
| `DB_NAME`           | Nome do banco                                   | `incicle_workflow`                         |
| `DB_USER`           | Usuário do banco                                | `postgres`                                 |
| `DB_PASSWORD`       | Senha do banco                                  | —                                          |
| `ASYNC_PROVIDER`    | Broker de mensageria                            | `rabbitmq`                                 |
| `ASYNC_URL`         | Connection string do broker                     | `amqp://guest:guest@rabbitmq:5672`         |
| `JWT_SECRET`        | Segredo do JWT HS256                            | `change-me`                                |
| `LOG_LEVEL`         | Nível de log (`debug`, `info`, `warn`, `error`) | `info`                                     |
| `SLA_DEFAULT_HOURS` | SLA padrão por step (em horas)                  | `24`                                       |

---

## Comandos Úteis

```bash
npm run start:dev     # servidor com hot reload
npm run test          # testes unitários
npm run test:e2e      # testes end-to-end
npm run test:cov      # cobertura
npm run seed          # insere 10k instâncias para testes de carga
```

Para os testes E2E:

- rodando no host: `DB_HOST_TEST=localhost`
- rodando dentro do container `api`/`api-test`: `DB_HOST_TEST=postgres`

---

## Documentação

| Doc                                            | Conteúdo                                                             |
|------------------------------------------------|----------------------------------------------------------------------|
| [Arquitetura](docs/arquitetura.md)             | DDD, bounded contexts, camadas, aggregates, eventos e fluxo completo |
| [Modelagem de Dados](docs/modelagem-dados.md)  | Schema SQL, índices e relações                                       |
| [Decisões Técnicas](docs/decisoes-tecnicas.md) | RabbitMQ, optimistic lock, outbox pattern, auditoria                 |
| [Contrato de API](docs/api.md)                 | Endpoints, headers obrigatórios e exemplos                           |
| [Teste de Carga](LOAD_TEST.md)                 | Scripts k6, metodologia e relatório de resultados                    |
