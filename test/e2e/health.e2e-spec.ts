import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup/test-app';

describe('Health E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health deve retornar status ok', async () => {
    const { body } = await request(app.getHttpServer()).get('/health').expect(200);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /health/ready deve verificar conectividade com o banco e broker', async () => {
    const { body } = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('ok');
    expect(body.checks.broker).toBe('ok');
  });

  it('GET /health/ready deve retornar degraded quando o broker estiver indisponível', async () => {
    const degradedApp = await createTestApp({
      brokerMock: {
        emit: () => ({ toPromise: () => Promise.resolve() }),
        connect: () => Promise.reject(new Error('broker down')),
      },
    });

    try {
      const { body } = await request(degradedApp.getHttpServer()).get('/health/ready').expect(200);
      expect(body.status).toBe('degraded');
      expect(body.checks.database).toBe('ok');
      expect(body.checks.broker).toBe('unavailable');
    } finally {
      await degradedApp.close();
    }
  });
});
