import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGinIndexApprovers1700000000001 implements MigrationInterface {
  name = 'AddGinIndexApprovers1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_instance_steps_approvers_gin"
       ON "instance_steps" USING gin("approvers")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_instance_steps_approvers_gin"`);
  }
}
