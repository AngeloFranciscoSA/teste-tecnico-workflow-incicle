import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { DecideStepDto } from './dto/decide-step.dto';
import { ApproveStepCommand } from '../../application/commands/approve-step.command';
import { RejectStepCommand } from '../../application/commands/reject-step.command';
import { GetInboxQuery } from '../../application/queries/get-inbox.query';
import { TenantId, ActorId } from '@shared/infra/http/tenant.decorators';

@ApiTags('Approvals')
@ApiBearerAuth('bearer')
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('inbox')
  @ApiOperation({ summary: 'Listar steps pendentes de aprovação para o usuário corrente' })
  @ApiResponse({ status: 200, description: 'Steps pendentes de aprovação' })
  async inbox(@ActorId() actorId: string, @TenantId() tenantId: string) {
    return this.queryBus.execute(new GetInboxQuery(actorId, tenantId));
  }

  @Post(':instanceId/steps/:stepId/approve')
  @ApiOperation({ summary: 'Aprovar step — idempotente, controla concorrência via optimistic lock' })
  @ApiParam({ name: 'instanceId', description: 'UUID da instância' })
  @ApiParam({ name: 'stepId', description: 'UUID do step' })
  @ApiResponse({ status: 201, description: 'Step aprovado', schema: { example: { approved: true } } })
  @ApiResponse({ status: 409, description: 'Conflito de concorrência — outra decisão foi registrada simultaneamente' })
  async approve(
    @ActorId() actorId: string,
    @TenantId() tenantId: string,
    @Param('instanceId') instanceId: string,
    @Param('stepId') stepId: string,
    @Body() dto: DecideStepDto,
  ) {
    await this.commandBus.execute(
      new ApproveStepCommand(instanceId, stepId, actorId, tenantId, dto.comment),
    );
    return { approved: true };
  }

  @Post(':instanceId/steps/:stepId/reject')
  @ApiOperation({ summary: 'Rejeitar step — idempotente, encerra o workflow com status rejected' })
  @ApiParam({ name: 'instanceId', description: 'UUID da instância' })
  @ApiParam({ name: 'stepId', description: 'UUID do step' })
  @ApiResponse({ status: 201, description: 'Step rejeitado', schema: { example: { rejected: true } } })
  @ApiResponse({ status: 409, description: 'Conflito de concorrência' })
  async reject(
    @ActorId() actorId: string,
    @TenantId() tenantId: string,
    @Param('instanceId') instanceId: string,
    @Param('stepId') stepId: string,
    @Body() dto: DecideStepDto,
  ) {
    await this.commandBus.execute(
      new RejectStepCommand(instanceId, stepId, actorId, tenantId, dto.comment),
    );
    return { rejected: true };
  }
}
