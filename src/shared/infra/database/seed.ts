import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Seed inicial: cria um template publicado com 2 steps e 10k instâncias
 * para o teste de carga (k6).
 *
 * Executar manualmente:
 *   npm run seed
 */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'incicle_workflow',
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected. Running seed...');

  const TENANT = 'a0000000-0000-0000-0000-000000000001';
  const TEMPLATE_ID = 'a0000000-0000-0000-0000-000000000002';
  const VERSION_ID = 'a0000000-0000-0000-0000-000000000003';
  const SNAPSHOT = {
    templateId: TEMPLATE_ID,
    versionId: VERSION_ID,
    versionNumber: 1,
    steps: [
      {
        stepOrder: 1,
        stepName: 'Aprovação Seed',
        approvalRule: 'ANY',
        approvers: ['user-manager-1', 'user-director-1', 'user-director-2'],
        slaHours: 24,
      },
    ],
  };

  await dataSource.query(
    `DELETE FROM instance_steps
     WHERE instance_id IN (
       SELECT id FROM workflow_instances
       WHERE company_id = $1 AND created_by = 'seed-user'
     )`,
    [TENANT],
  );

  await dataSource.query(
    `DELETE FROM workflow_instances
     WHERE company_id = $1 AND created_by = 'seed-user'`,
    [TENANT],
  );

  // Template
  await dataSource.query(
    `INSERT INTO templates (id, company_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [TEMPLATE_ID, TENANT, 'Template de Aprovação Padrão'],
  );

  // Version
  await dataSource.query(
    `INSERT INTO template_versions (id, template_id, version_number, status, config, published_at)
     VALUES ($1, $2, 1, 'published', $3, now()) ON CONFLICT DO NOTHING`,
    [
      VERSION_ID,
      TEMPLATE_ID,
      JSON.stringify({
        steps: [
          {
            id: 'step-tpl-1',
            stepOrder: 1,
            stepName: 'Aprovação Gerência',
            approvalRule: 'ALL',
            approvers: ['user-manager-1'],
            slaHours: 24,
          },
          {
            id: 'step-tpl-2',
            stepOrder: 2,
            stepName: 'Aprovação Diretoria',
            approvalRule: 'ANY',
            approvers: ['user-director-1', 'user-director-2'],
            slaHours: 48,
          },
        ],
      }),
    ],
  );

  // 10k instâncias submetidas com step pendente real para os testes de carga
  const BATCH = 500;
  const TOTAL = 10_000;

  for (let i = 0; i < TOTAL; i += BATCH) {
    const instanceValues: any[] = [];
    const instancePlaceholders: string[] = [];
    const stepValues: any[] = [];
    const stepPlaceholders: string[] = [];
    let instanceIdx = 1;
    let stepIdx = 1;

    for (let j = i; j < Math.min(i + BATCH, TOTAL); j++) {
      const instanceId = `b0000000-0000-0000-0000-${String(j).padStart(12, '0')}`;
      const stepId = `c0000000-0000-0000-0000-${String(j).padStart(12, '0')}`;
      const primaryApprover =
        j % 2 === 0
          ? ['user-manager-1']
          : ['user-director-1', 'user-director-2'];
      const snapshot = {
        ...SNAPSHOT,
        steps: [
          {
            stepOrder: 1,
            stepName: j % 2 === 0 ? 'Aprovação Gerência' : 'Aprovação Diretoria',
            approvalRule: primaryApprover.length === 1 ? 'ALL' : 'ANY',
            approvers: primaryApprover,
            slaHours: 24,
          },
        ],
      };

      instanceValues.push(
        instanceId,
        TENANT,
        TEMPLATE_ID,
        VERSION_ID,
        'active',
        'seed-user',
        JSON.stringify(snapshot),
      );
      instancePlaceholders.push(
        `($${instanceIdx++}, $${instanceIdx++}, $${instanceIdx++}, $${instanceIdx++}, $${instanceIdx++}, $${instanceIdx++}, $${instanceIdx++})`,
      );

      stepValues.push(
        stepId,
        instanceId,
        1,
        j % 2 === 0 ? 'Aprovação Gerência' : 'Aprovação Diretoria',
        primaryApprover.length === 1 ? 'ALL' : 'ANY',
        null,
        JSON.stringify(primaryApprover),
        24,
        new Date(Date.now() + 24 * 3600_000),
        false,
        'pending',
        0,
        JSON.stringify([]),
      );
      stepPlaceholders.push(
        `($${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++}, $${stepIdx++})`,
      );
    }

    await dataSource.query(
      `INSERT INTO workflow_instances (
         id, company_id, template_id, version_id, status, created_by, snapshot
       )
       VALUES ${instancePlaceholders.join(',')} ON CONFLICT DO NOTHING`,
      instanceValues,
    );

    await dataSource.query(
      `INSERT INTO instance_steps (
         id, instance_id, step_order, step_name, approval_rule, quorum_count,
         approvers, sla_hours, sla_deadline, sla_breached, status, version, decisions
       )
       VALUES ${stepPlaceholders.join(',')} ON CONFLICT DO NOTHING`,
      stepValues,
    );

    console.log(`Inserted ${Math.min(i + BATCH, TOTAL)}/${TOTAL} instances`);
  }

  console.log('Seed completed.');
  await dataSource.destroy();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
