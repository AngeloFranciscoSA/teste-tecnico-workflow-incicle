import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { TemplateVersionOrmEntity } from './template-version.orm-entity';

@Entity('templates')
export class WorkflowTemplateOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => TemplateVersionOrmEntity, (v) => v.template, { cascade: true, eager: true })
  versions: TemplateVersionOrmEntity[];
}
