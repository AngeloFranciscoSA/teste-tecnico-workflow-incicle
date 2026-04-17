import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "templates" (
        "id"          UUID PRIMARY KEY,
        "company_id"  VARCHAR NOT NULL,
        "name"        VARCHAR NOT NULL,
        "description" VARCHAR,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "template_versions" (
        "id"             UUID PRIMARY KEY,
        "template_id"    UUID NOT NULL REFERENCES "templates"("id"),
        "version_number" INTEGER NOT NULL,
        "status"         VARCHAR NOT NULL DEFAULT 'draft',
        "config"         JSONB NOT NULL DEFAULT '{}',
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "published_at"   TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "workflow_instances" (
        "id"           UUID PRIMARY KEY,
        "company_id"   VARCHAR NOT NULL,
        "template_id"  UUID NOT NULL,
        "version_id"   UUID NOT NULL,
        "status"       VARCHAR NOT NULL DEFAULT 'draft',
        "created_by"   VARCHAR NOT NULL,
        "snapshot"     JSONB,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "submitted_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "instance_steps" (
        "id"            UUID PRIMARY KEY,
        "instance_id"   UUID NOT NULL REFERENCES "workflow_instances"("id"),
        "step_order"    INTEGER NOT NULL,
        "step_name"     VARCHAR NOT NULL,
        "approval_rule" VARCHAR NOT NULL,
        "quorum_count"  INTEGER,
        "approvers"     JSONB NOT NULL DEFAULT '[]',
        "sla_hours"     INTEGER NOT NULL,
        "sla_deadline"  TIMESTAMPTZ,
        "sla_breached"  BOOLEAN NOT NULL DEFAULT false,
        "status"        VARCHAR NOT NULL DEFAULT 'pending',
        "version"       INTEGER NOT NULL DEFAULT 0,
        "decisions"     JSONB NOT NULL DEFAULT '[]'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "delegations" (
        "id"           UUID PRIMARY KEY,
        "company_id"   VARCHAR NOT NULL,
        "delegator_id" VARCHAR NOT NULL,
        "delegate_id"  VARCHAR NOT NULL,
        "starts_at"    TIMESTAMPTZ NOT NULL,
        "expires_at"   TIMESTAMPTZ NOT NULL,
        "active"       BOOLEAN NOT NULL DEFAULT true,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"          UUID PRIMARY KEY,
        "company_id"  VARCHAR NOT NULL,
        "entity_type" VARCHAR NOT NULL,
        "entity_id"   VARCHAR NOT NULL,
        "action"      VARCHAR NOT NULL,
        "actor_id"    VARCHAR NOT NULL,
        "payload"     JSONB,
        "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id"             UUID PRIMARY KEY,
        "aggregate_type" VARCHAR NOT NULL,
        "aggregate_id"   VARCHAR NOT NULL,
        "event_type"     VARCHAR NOT NULL,
        "payload"        JSONB NOT NULL DEFAULT '{}',
        "published"      BOOLEAN NOT NULL DEFAULT false,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Índices críticos para performance
    await queryRunner.query(`CREATE INDEX ON "workflow_instances" ("company_id", "status")`);
    await queryRunner.query(`CREATE INDEX ON "instance_steps" ("instance_id", "step_order")`);
    await queryRunner.query(`CREATE INDEX ON "instance_steps" ("sla_deadline") WHERE status = 'pending'`);
    await queryRunner.query(`CREATE INDEX ON "delegations" ("delegate_id", "expires_at") WHERE active = true`);
    await queryRunner.query(`CREATE INDEX ON "outbox_events" ("published", "created_at") WHERE published = false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delegations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "instance_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "template_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "templates"`);
  }
}
