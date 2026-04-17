import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase } from '../setup/test-app';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { authHeader } from '../setup/auth';
import { DataSource } from 'typeorm';

describe('Workflow E2E', () => {
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

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function createPublishedTemplate() {
    const templateId = randomUUID();
    const versionId = randomUUID();
    const stepId = randomUUID();

    await request(app.getHttpServer())
      .post('/templates')
      .set(authHeader('user-admin'))
      .send({ id: templateId, name: 'Template E2E' })
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
            stepName: 'Aprovação',
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

    return { templateId, versionId, stepId };
  }

  async function createAndSubmitInstance(templateId: string, versionId: string) {
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

    return instanceId;
  }

  // ── Cenários ─────────────────────────────────────────────────────────────

  describe('Fluxo completo: template → versão → publicação → instância → submit → aprovação', () => {
    it('deve criar snapshot imutável ao submeter e completar instância ao aprovar', async () => {
      const { templateId, versionId } = await createPublishedTemplate();
      const instanceId = await createAndSubmitInstance(templateId, versionId);

      // Verifica que snapshot foi criado
      const { body: instance } = await request(app.getHttpServer())
        .get(`/instances/${instanceId}`)
        .set(authHeader('user-admin'))
        .expect(200);

      expect(instance.status).toBe('active');
      expect(instance.snapshot).toBeDefined();
      expect(instance.snapshot.steps).toHaveLength(1);
      expect(instance.steps).toHaveLength(1);

      const stepId = instance.steps[0].id;

      // Aprova o step
      await request(app.getHttpServer())
        .post(`/approvals/${instanceId}/steps/${stepId}/approve`)
        .set(authHeader('user-a'))
        .expect(201);

      // Instância deve estar completa
      const { body: completed } = await request(app.getHttpServer())
        .get(`/instances/${instanceId}`)
        .set(authHeader('user-admin'))
        .expect(200);

      expect(completed.status).toBe('completed');
      expect(completed.steps[0].status).toBe('approved');
    });

    it('não deve submeter instância com versão não publicada', async () => {
      const templateId = randomUUID();
      const versionId = randomUUID();

      await request(app.getHttpServer())
        .post('/templates')
        .set(authHeader('user-admin'))
        .send({ id: templateId, name: 'Template Draft' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/templates/${templateId}/versions`)
        .set(authHeader('user-admin'))
        .send({
          id: versionId,
          steps: [{ id: randomUUID(), stepOrder: 1, stepName: 'Step', approvalRule: 'ALL', approvers: ['user-a'], slaHours: 24 }],
        })
        .expect(201);

      // Não publica — versão fica em draft
      const instanceId = randomUUID();
      await request(app.getHttpServer())
        .post('/instances')
        .set(authHeader('user-admin'))
        .send({ id: instanceId, templateId, versionId })
        .expect(201);

      // Submit deve falhar
      await request(app.getHttpServer())
        .post(`/instances/${instanceId}/submit`)
        .set(authHeader('user-admin'))
        .expect(422);
    });
  });

  describe('Timeline', () => {
    it('deve retornar eventos na linha do tempo após submit', async () => {
      const { templateId, versionId } = await createPublishedTemplate();
      const instanceId = await createAndSubmitInstance(templateId, versionId);

      const { body: timeline } = await request(app.getHttpServer())
        .get(`/instances/${instanceId}/timeline`)
        .set(authHeader('user-admin'))
        .expect(200);

      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThan(0);
    });
  });

  describe('Snapshot imutável após alteração no org chart', () => {
    it('o snapshot não deve mudar mesmo que a versão do template seja alterada após o submit', async () => {
      const { templateId, versionId } = await createPublishedTemplate();
      const instanceId = await createAndSubmitInstance(templateId, versionId);

      // Captura snapshot original
      const { body: before } = await request(app.getHttpServer())
        .get(`/instances/${instanceId}`)
        .set(authHeader('user-admin'))
        .expect(200);

      const snapshotApprovers = before.snapshot.steps[0].approvers;

      // Cria uma NOVA versão do template com aprovadores diferentes
      await request(app.getHttpServer())
        .post(`/templates/${templateId}/versions`)
        .set(authHeader('user-admin'))
        .send({
          id: randomUUID(),
          steps: [
            {
              id: randomUUID(),
              stepOrder: 1,
              stepName: 'Aprovação',
              approvalRule: 'ALL',
              approvers: ['user-NOVO'],
              slaHours: 24,
            },
          ],
        })
        .expect(201);

      // Snapshot da instância original não deve ter mudado
      const { body: after } = await request(app.getHttpServer())
        .get(`/instances/${instanceId}`)
        .set(authHeader('user-admin'))
        .expect(200);

      expect(after.snapshot.steps[0].approvers).toEqual(snapshotApprovers);
      expect(after.snapshot.steps[0].approvers).not.toContain('user-NOVO');
    });
  });

  describe('Rejeição', () => {
    it('deve rejeitar instância quando um step é rejeitado', async () => {
      const { templateId, versionId } = await createPublishedTemplate();
      const instanceId = await createAndSubmitInstance(templateId, versionId);

      const { body: instance } = await request(app.getHttpServer())
        .get(`/instances/${instanceId}`)
        .set(authHeader('user-admin'))
        .expect(200);

      const stepId = instance.steps[0].id;

      await request(app.getHttpServer())
        .post(`/approvals/${instanceId}/steps/${stepId}/reject`)
        .set(authHeader('user-a'))
        .send({ comment: 'Documentação incompleta' })
        .expect(201);

      const { body: rejected } = await request(app.getHttpServer())
        .get(`/instances/${instanceId}`)
        .set(authHeader('user-admin'))
        .expect(200);

      expect(rejected.status).toBe('rejected');
      expect(rejected.steps[0].status).toBe('rejected');
    });
  });

  describe('Falha de dependência', () => {
    it('deve persistir aprovação e manter evento pendente na outbox quando o broker estiver indisponível', async () => {
      const unstableApp = await createTestApp({
        brokerMock: {
          emit: () => ({ toPromise: () => Promise.reject(new Error('broker down')) }),
          connect: () => Promise.reject(new Error('broker down')),
        },
      });

      try {
        await cleanDatabase(unstableApp);

        const templateId = randomUUID();
        const versionId = randomUUID();

        await request(unstableApp.getHttpServer())
          .post('/templates')
          .set(authHeader('user-admin'))
          .send({ id: templateId, name: 'Template resiliencia broker' })
          .expect(201);

        await request(unstableApp.getHttpServer())
          .post(`/templates/${templateId}/versions`)
          .set(authHeader('user-admin'))
          .send({
            id: versionId,
            steps: [
              {
                id: randomUUID(),
                stepOrder: 1,
                stepName: 'Aprovacao',
                approvalRule: 'ALL',
                approvers: ['user-a'],
                slaHours: 24,
              },
            ],
          })
          .expect(201);

        await request(unstableApp.getHttpServer())
          .post(`/templates/${templateId}/versions/${versionId}/publish`)
          .set(authHeader('user-admin'))
          .expect(201);

        const instanceId = randomUUID();
        await request(unstableApp.getHttpServer())
          .post('/instances')
          .set(authHeader('user-admin'))
          .send({ id: instanceId, templateId, versionId })
          .expect(201);

        await request(unstableApp.getHttpServer())
          .post(`/instances/${instanceId}/submit`)
          .set(authHeader('user-admin'))
          .expect(201);

        const { body: instance } = await request(unstableApp.getHttpServer())
          .get(`/instances/${instanceId}`)
          .set(authHeader('user-admin'))
          .expect(200);

        const stepId = instance.steps[0].id;

        await request(unstableApp.getHttpServer())
          .post(`/approvals/${instanceId}/steps/${stepId}/approve`)
          .set(authHeader('user-a'))
          .expect(201);

        const { body: completed } = await request(unstableApp.getHttpServer())
          .get(`/instances/${instanceId}`)
          .set(authHeader('user-admin'))
          .expect(200);

        expect(completed.status).toBe('completed');
        expect(completed.steps[0].status).toBe('approved');

        const dataSource = unstableApp.get<DataSource>(getDataSourceToken());
        const pendingOutbox = await dataSource.query(
          'SELECT COUNT(*)::int AS count FROM outbox_events WHERE published = false',
        );
        expect(pendingOutbox[0].count).toBeGreaterThan(0);
      } finally {
        await unstableApp.close();
      }
    });
  });
});
