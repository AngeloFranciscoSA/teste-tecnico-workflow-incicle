import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkflowTemplateOrmEntity } from './workflow-template.orm-entity';

@Entity('template_versions')
export class TemplateVersionOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @Column({ name: 'version_number' })
  versionNumber: number;

  @Column()
  status: string;

  @Column({ type: 'jsonb' })
  config: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => WorkflowTemplateOrmEntity, (t) => t.versions)
  @JoinColumn({ name: 'template_id' })
  template: WorkflowTemplateOrmEntity;
}
