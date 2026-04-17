import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase } from '../setup/test-app';
import { randomUUID } from 'crypto';
import { authHeader } from '../setup/auth';

describe('Delegações E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await cleanDatabase(app);
  });

  const future = (offsetHours: number) =>
    new Date(Date.now() + offsetHours * 3600_000).toISOString();
  const past = (offsetHours: number) =>
    new Date(Date.now() - offsetHours * 3600_000).toISOString();

  describe('Criação de delegação', () => {
    it('deve criar delegação válida', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-a'))
        .send({ id: randomUUID(), delegateId: 'user-b', startsAt: past(1), expiresAt: future(24) })
        .expect(201);

      expect(body.id).toBeDefined();
    });

    it('deve bloquear ciclo direto A→B + tentativa B→A', async () => {
      // user-a delega para user-b
      await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-a'))
        .send({ id: randomUUID(), delegateId: 'user-b', startsAt: past(1), expiresAt: future(24) })
        .expect(201);

      // user-b tenta delegar para user-a → ciclo B→A
      const { body } = await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-b'))
        .send({ id: randomUUID(), delegateId: 'user-a', startsAt: past(1), expiresAt: future(24) })
        .expect(422);

      expect(body.message).toMatch(/ciclo/i);
    });

    it('deve bloquear auto-delegação', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-a'))
        .send({ id: randomUUID(), delegateId: 'user-a', startsAt: past(1), expiresAt: future(24) })
        .expect(422);

      expect(body.message).toMatch(/ciclo/i);
    });
  });

  describe('Listagem', () => {
    it('GET /delegations deve listar todas as delegações', async () => {
      await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-a'))
        .send({ id: randomUUID(), delegateId: 'user-b', startsAt: past(1), expiresAt: future(24) })
        .expect(201);

      const { body } = await request(app.getHttpServer())
        .get('/delegations')
        .set(authHeader('user-a'))
        .expect(200);

      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /delegations/active deve retornar apenas delegações dentro do período', async () => {
      await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-a'))
        .send({ id: randomUUID(), delegateId: 'user-b', startsAt: past(1), expiresAt: future(24) })
        .expect(201);

      const { body } = await request(app.getHttpServer())
        .get('/delegations/active')
        .set(authHeader('user-a'))
        .expect(200);

      expect(body.length).toBeGreaterThanOrEqual(1);
      body.forEach((d: any) => {
        expect(new Date(d.expiresAt).getTime()).toBeGreaterThan(Date.now());
      });
    });
  });

  describe('Revogação', () => {
    it('deve revogar delegação ativa', async () => {
      const id = randomUUID();
      await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-a'))
        .send({ id, delegateId: 'user-b', startsAt: past(1), expiresAt: future(24) })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/delegations/${id}`)
        .set(authHeader('user-a'))
        .expect(200);

      const { body } = await request(app.getHttpServer())
        .get('/delegations/active')
        .set(authHeader('user-a'))
        .expect(200);

      const stillActive = body.find((d: any) => d.id === id);
      expect(stillActive).toBeUndefined();
    });
  });

  describe('Detecção de ciclo em cadeia', () => {
    it('deve bloquear ciclo A→B→C + tentativa C→A', async () => {
      await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-a'))
        .send({ id: randomUUID(), delegateId: 'user-b', startsAt: past(1), expiresAt: future(24) })
        .expect(201);

      await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-b'))
        .send({ id: randomUUID(), delegateId: 'user-c', startsAt: past(1), expiresAt: future(24) })
        .expect(201);

      const { body } = await request(app.getHttpServer())
        .post('/delegations')
        .set(authHeader('user-c'))
        .send({ id: randomUUID(), delegateId: 'user-a', startsAt: past(1), expiresAt: future(24) })
        .expect(422);

      expect(body.message).toMatch(/ciclo/i);
    });
  });
});
