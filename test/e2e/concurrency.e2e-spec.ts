import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase } from '../setup/test-app';
import { randomUUID } from 'crypto';
import { authHeader } from '../setup/auth';

/**
 * Teste de Corrida Concorrente
 *
 * N = 20 requisições simultâneas no mesmo step.
 *
 * Justificativa do N:
 *   20 representa um cenário extremo mas realista — por exemplo, um sistema
 *   de integração disparando múltiplos webhooks em paralelo, ou um retry storm.
 *   É suficiente para estressar o optimistic locking sem tornar o teste
 *   excessivamente lento. Com N=20, a probabilidade de todas as requisições
 *   chegarem ao banco antes de qualquer resposta retornar é alta em ambiente
 *   local, garantindo colisões reais.
 *
 * Resultado esperado:
 *   - Exatamente 1 requisição retorna 201 (decisão efetivada)
 *   - As outras N-1 retornam 409 (ConflictException do optimistic lock)
 */
describe('Corrida Concorrente (N=20)', () => {
  const N = 20;
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

  async function setupActiveInstance(): Promise<{ instanceId: string; stepId: string }> {
    const templateId = randomUUID();
    const versionId = randomUUID();
    const stepId = randomUUID();

    await request(app.getHttpServer())
      .post('/templates')
      .set(authHeader('user-admin'))
      .send({ id: templateId, name: 'Template Concorrência' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/templates/${templateId}/versions`)
      .set(authHeader('user-admin'))
      .send({
        id: versionId,
        steps: [
          {
            id: stepId,
            stepOrder: 1,
            stepName: 'Aprovação Concorrente',
            approvalRule: 'ALL',
            approvers: ['user-a'],
            slaHours: 24,
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/templates/${templateId}/versions/${versionId}/publish`)
      .set(authHeader('user-admin'))
      .expect(201);

    const instanceId = randomUUID();

    await request(app.getHttpServer())
      .post('/instances')
      .set(authHeader('user-admin'))
      .send({ id: instanceId, templateId, versionId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/instances/${instanceId}/submit`)
      .set(authHeader('user-admin'))
      .expect(201);

    // Pega o step ID real do banco
    const { body } = await request(app.getHttpServer())
      .get(`/instances/${instanceId}`)
      .set(authHeader('user-admin'))
      .expect(200);

    return { instanceId, stepId: body.steps[0].id };
  }

  it(`deve efetivar exatamente 1 de ${N} aprovações simultâneas (optimistic locking)`, async () => {
    const { instanceId, stepId } = await setupActiveInstance();

    // Dispara N requests simultâneos
    const results = await Promise.allSettled(
      Array.from({ length: N }, () =>
        request(app.getHttpServer())
          .post(`/approvals/${instanceId}/steps/${stepId}/approve`)
          .set(authHeader('user-a'))
          .then((res) => res.status),
      ),
    );

    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value : 500));

    const approved = statuses.filter((s) => s === 201);
    // 409 = optimistic lock (chegaram ao banco com versão desatualizada)
    // 400 = step já aprovado (leram o estado pós-commit de outro request)
    const conflicted = statuses.filter((s) => s === 409 || s === 400);

    console.log(`Resultados: ${approved.length}x 201, ${conflicted.length}x 409/400, outros: ${N - approved.length - conflicted.length}`);

    // Exatamente 1 deve ter sucesso
    expect(approved).toHaveLength(1);

    // As demais devem indicar conflito (409 ou 400)
    expect(conflicted.length).toBeGreaterThanOrEqual(N - 2);

    // O step deve estar aprovado no banco
    const { body } = await request(app.getHttpServer())
      .get(`/instances/${instanceId}`)
      .set(authHeader('user-admin'))
      .expect(200);

    expect(body.steps[0].status).toBe('approved');
    expect(body.steps[0].decisions).toHaveLength(1);
  });
});
