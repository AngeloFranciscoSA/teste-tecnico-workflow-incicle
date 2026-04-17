import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('delegations')
export class DelegationOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'delegator_id' })
  delegatorId: string;

  @Column({ name: 'delegate_id' })
  delegateId: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
