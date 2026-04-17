import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { InstanceStepOrmEntity } from './instance-step.orm-entity';

@Entity('workflow_instances')
export class WorkflowInstanceOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @Column({ name: 'version_id' })
  versionId: string;

  @Column()
  status: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => InstanceStepOrmEntity, (s) => s.instance, { cascade: true, eager: true })
  steps: InstanceStepOrmEntity[];
}
