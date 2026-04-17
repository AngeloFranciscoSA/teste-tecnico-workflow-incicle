import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './setup/test-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health deve retornar status ok', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(body.status).toBe('ok');
  });
});
