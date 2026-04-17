import { resolveAdminConnection, withAdminClient } from './db-config';

module.exports = async () => {
  const testDb = 'incicle_workflow_test';
  const { config } = await resolveAdminConnection();

  // Executa cada comando administrativo em conexões separadas para evitar
  // warnings do pg em comandos de gerenciamento de database.
  await withAdminClient(config, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${testDb}`);
  });
  await withAdminClient(config, async (client) => {
    await client.query(`CREATE DATABASE ${testDb}`);
  });

  // Expõe as variáveis para todos os test suites
  process.env.DB_HOST = String(config.host);
  process.env.DB_HOST_TEST = String(config.host);
  process.env.DB_PORT = String(config.port);
  process.env.DB_NAME = testDb;
  process.env.DB_USER = String(config.user);
  process.env.DB_PASSWORD = String(config.password ?? '');
  process.env.ASYNC_URL = process.env.ASYNC_URL ?? 'amqp://guest:guest@localhost:5672';
  process.env.SLA_DEFAULT_HOURS = '24';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
};
