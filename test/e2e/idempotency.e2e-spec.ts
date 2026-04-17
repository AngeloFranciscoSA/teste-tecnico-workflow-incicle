import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase } from '../setup/test-app';
import { randomUUID } from 'crypto';
import { authHeader } from '../setup/auth';

describe('Idempotência', () => {
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

  async function setupAndApprove() {
    const templateId = randomUUID();
    const versionId = randomUUID();

    await request(app.getHttpServer()).post('/templates').set(authHeader('user-admin')).send({ id: templateId, name: 'T' }).expect(201);
    await request(app.getHttpServer())
      .post(`/templates/${templateId}/versions`)
      .set(authHeader('user-admin'))
      .send({
        id: versionId,
        steps: [
          { id: randomUUID(), stepOrder: 1, stepName: 'S', approvalRule: 'ALL', approvers: ['user-a', 'user-b'], slaHours: 24 },
        ],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/templates/${templateId}/versions/${versionId}/publish`)
      .set(authHeader('user-admin'))
      .expect(201);

    const instanceId = randomUUID();
    await request(app.getHttpServer()).post('/instances').set(authHeader('user-admin')).send({ id: instanceId, templateId, versionId }).expect(201);
    await request(app.getHttpServer()).post(`/instances/${instanceId}/submit`).set(authHeader('user-admin')).expect(201);

    const { body } = await request(app.getHttpServer()).get(`/instances/${instanceId}`).set(authHeader('user-admin')).expect(200);
    const stepId = body.steps[0].id;

    return { instanceId, stepId };
  }

  it('segunda aprovação idêntica do mesmo ator não deve criar decisão duplicada', async () => {
    const { instanceId, stepId } = await setupAndApprove();

    // Primeira aprovação
    await request(app.getHttpServer())
      .post(`/approvals/${instanceId}/steps/${stepId}/approve`)
      .set(authHeader('user-a'))
      .expect(201);

    // Segunda aprovação — idêntica, deve ser idempotente (200 ou 201, sem erro)
    await request(app.getHttpServer())
      .post(`/approvals/${instanceId}/steps/${stepId}/approve`)
      .set(authHeader('user-a'))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    // Deve ter apenas 1 decisão no banco
    const { body } = await request(app.getHttpServer())
      .get(`/instances/${instanceId}`)
      .set(authHeader('user-admin'))
      .expect(200);

    expect(body.steps[0].decisions).toHaveLength(1);
  });

  it('tentar aprovar step já rejeitado deve retornar erro', async () => {
    const { instanceId, stepId } = await setupAndApprove();

    await request(app.getHttpServer())
      .post(`/approvals/${instanceId}/steps/${stepId}/reject`)
      .set(authHeader('user-a'))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/approvals/${instanceId}/steps/${stepId}/approve`)
      .set(authHeader('user-a'))
      .expect((res) => {
        expect([409, 422, 400]).toContain(res.status);
      });
  });
});
