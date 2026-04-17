import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnprocessableEntityException } from '@nestjs/common';
import { CreateDelegationCommand } from '../commands/create-delegation.command';
import { IDelegationRepository, DELEGATION_REPOSITORY } from '../../domain/repositories/delegation.repository';
import { CycleDetectorService } from '../../domain/services/cycle-detector.service';
import { Delegation } from '../../domain/aggregates/delegation.aggregate';
import { DelegationPeriod } from '../../domain/value-objects/delegation-period.vo';
import { AuditService } from '../../../../shared/infra/audit/audit.service';

@CommandHandler(CreateDelegationCommand)
export class CreateDelegationHandler implements ICommandHandler<CreateDelegationCommand> {
  constructor(
    @Inject(DELEGATION_REPOSITORY)
    private readonly delegationRepo: IDelegationRepository,
    private readonly cycleDetector: CycleDetectorService,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateDelegationCommand): Promise<void> {
    const { id, tenantId, delegatorId, delegateId, startsAt, expiresAt } = command;

    const activeEdges = await this.delegationRepo.findAllActiveEdges(tenantId);

    if (this.cycleDetector.wouldCreateCycle(delegatorId, delegateId, activeEdges)) {
      throw new UnprocessableEntityException(
        `Criar esta delegação introduziria um ciclo (${delegatorId} → ${delegateId})`,
      );
    }

    const period = new DelegationPeriod({ startsAt, expiresAt });
    const delegation = Delegation.create({ id, tenantId, delegatorId, delegateId, period });

    await this.delegationRepo.save(delegation);

    await this.auditService.log({
      companyId: tenantId,
      entityType: 'Delegation',
      entityId: id,
      action: 'CREATED',
      actorId: delegatorId,
      payload: { delegateId, startsAt, expiresAt },
    });
  }
}
