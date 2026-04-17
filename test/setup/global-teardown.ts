import { resolveAdminConnection, withAdminClient } from './db-config';

module.exports = async () => {
  const { config } = await resolveAdminConnection();
  await withAdminClient(config, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS incicle_workflow_test WITH (FORCE)`);
  });
};
