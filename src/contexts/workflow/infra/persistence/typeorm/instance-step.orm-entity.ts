import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkflowInstanceOrmEntity } from './workflow-instance.orm-entity';

@Entity('instance_steps')
export class InstanceStepOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'instance_id' })
  instanceId: string;

  @Column({ name: 'step_order' })
  stepOrder: number;

  @Column({ name: 'step_name' })
  stepName: string;

  @Column({ name: 'approval_rule' })
  approvalRule: string;

  @Column({ name: 'quorum_count', type: 'int', nullable: true })
  quorumCount: number | null;

  @Column({ type: 'jsonb' })
  approvers: string[];

  @Column({ name: 'sla_hours' })
  slaHours: number;

  @Column({ name: 'sla_deadline', type: 'timestamptz', nullable: true })
  slaDeadline: Date | null;

  @Column({ name: 'sla_breached', default: false })
  slaBreached: boolean;

  @Column()
  status: string;

  @Column({ default: 0 })
  version: number;

  @Column({ type: 'jsonb', default: '[]' })
  decisions: Record<string, any>[];

  @ManyToOne(() => WorkflowInstanceOrmEntity, (i) => i.steps)
  @JoinColumn({ name: 'instance_id' })
  instance: WorkflowInstanceOrmEntity;
}
