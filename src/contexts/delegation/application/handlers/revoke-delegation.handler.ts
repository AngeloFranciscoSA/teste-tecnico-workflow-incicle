import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { RevokeDelegationCommand } from '../commands/revoke-delegation.command';
import { IDelegationRepository, DELEGATION_REPOSITORY } from '../../domain/repositories/delegation.repository';

@CommandHandler(RevokeDelegationCommand)
export class RevokeDelegationHandler implements ICommandHandler<RevokeDelegationCommand> {
  constructor(
    @Inject(DELEGATION_REPOSITORY)
    private readonly delegationRepo: IDelegationRepository,
  ) {}

  async execute(command: RevokeDelegationCommand): Promise<void> {
    const { delegationId, tenantId, actorId } = command;

    const delegation = await this.delegationRepo.findById(delegationId, tenantId);
    if (!delegation) throw new NotFoundException(`Delegation "${delegationId}" not found`);

    if (delegation.delegatorId !== actorId) {
      throw new ForbiddenException('Only the delegator can revoke a delegation');
    }

    delegation.revoke();
    await this.delegationRepo.save(delegation);
  }
}
