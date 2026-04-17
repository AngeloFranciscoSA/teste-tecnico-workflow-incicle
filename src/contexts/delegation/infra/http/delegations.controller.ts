import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiProperty, ApiBearerAuth } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';
import { Inject } from '@nestjs/common';
import { CreateDelegationCommand } from '../../application/commands/create-delegation.command';
import { RevokeDelegationCommand } from '../../application/commands/revoke-delegation.command';
import { IDelegationRepository, DELEGATION_REPOSITORY } from '../../domain/repositories/delegation.repository';
import { TenantId, ActorId } from '@shared/infra/http/tenant.decorators';

class CreateDelegationDto {
  @ApiProperty({ example: 'del-uuid-001', description: 'UUID da delegação' })
  @IsString() @IsNotEmpty() id: string;

  @ApiProperty({ example: 'user-uuid-002', description: 'UUID do usuário que receberá a delegação' })
  @IsString() @IsNotEmpty() delegateId: string;

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z', description: 'Início da vigência (ISO 8601)' })
  @IsDateString() startsAt: string;

  @ApiProperty({ example: '2026-04-30T23:59:59.000Z', description: 'Expiração da vigência (ISO 8601)' })
  @IsDateString() expiresAt: string;
}

@ApiTags('Delegations')
@ApiBearerAuth('bearer')
@Controller('delegations')
export class DelegationsController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(DELEGATION_REPOSITORY)
    private readonly delegationRepo: IDelegationRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar delegação de aprovação — detecta ciclos automaticamente' })
  @ApiResponse({ status: 201, description: 'Delegação criada', schema: { example: { id: 'uuid' } } })
  @ApiResponse({ status: 422, description: 'Ciclo de delegação detectado (A→B→C→A)' })
  async create(
    @TenantId() tenantId: string,
    @ActorId() delegatorId: string,
    @Body() dto: CreateDelegationDto,
  ) {
    await this.commandBus.execute(
      new CreateDelegationCommand(
        dto.id,
        tenantId,
        delegatorId,
        dto.delegateId,
        new Date(dto.startsAt),
        new Date(dto.expiresAt),
      ),
    );
    return { id: dto.id };
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as delegações do tenant (ativas e inativas)' })
  @ApiResponse({ status: 200, description: 'Lista de delegações' })
  async findAll(@TenantId() tenantId: string) {
    const delegations = await this.delegationRepo.findAll(tenantId);
    return delegations.map((d) => ({
      id: d.id,
      delegatorId: d.delegatorId,
      delegateId: d.delegateId,
      isActive: d.isActive(),
      expiresAt: d.period.expiresAt,
    }));
  }

  @Get('active')
  @ApiOperation({ summary: 'Listar apenas delegações ativas e dentro do prazo de vigência' })
  @ApiResponse({ status: 200, description: 'Delegações ativas' })
  async findActive(@TenantId() tenantId: string) {
    const delegations = await this.delegationRepo.findActive(tenantId);
    return delegations.map((d) => ({
      id: d.id,
      delegatorId: d.delegatorId,
      delegateId: d.delegateId,
      expiresAt: d.period.expiresAt,
    }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revogar delegação' })
  @ApiParam({ name: 'id', description: 'UUID da delegação' })
  @ApiResponse({ status: 200, description: 'Delegação revogada', schema: { example: { revoked: true } } })
  async revoke(
    @TenantId() tenantId: string,
    @ActorId() actorId: string,
    @Param('id') id: string,
  ) {
    await this.commandBus.execute(new RevokeDelegationCommand(id, tenantId, actorId));
    return { revoked: true };
  }
}
