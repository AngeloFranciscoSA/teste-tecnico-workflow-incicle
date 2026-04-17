import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { SubmitInstanceCommand } from '../../application/commands/submit-instance.command';
import { GetInstanceQuery } from '../../application/queries/get-instance.query';
import { GetTimelineQuery } from '../../application/queries/get-timeline.query';
import { WorkflowInstance } from '../../domain/aggregates/workflow-instance/workflow-instance.aggregate';
import { IWorkflowInstanceRepository, WORKFLOW_INSTANCE_REPOSITORY } from '../../domain/repositories/workflow-instance.repository';
import { TenantId, ActorId } from '@shared/infra/http/tenant.decorators';

@ApiTags('Instances')
@ApiBearerAuth('bearer')
@Controller('instances')
export class InstancesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: IWorkflowInstanceRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar instância de workflow (ainda em rascunho)' })
  @ApiResponse({ status: 201, description: 'Instância criada', schema: { example: { id: 'uuid', status: 'active' } } })
  async create(
    @TenantId() tenantId: string,
    @ActorId() actorId: string,
    @Body() dto: CreateInstanceDto,
  ) {
    const instance = new WorkflowInstance({
      id: dto.id,
      tenantId,
      templateId: dto.templateId,
      versionId: dto.versionId,
      createdBy: actorId,
    });
    await this.instanceRepo.save(instance);
    return { id: instance.id, status: instance.status };
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submeter instância — congela snapshot e inicia o fluxo de aprovação' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 201, description: 'Instância submetida', schema: { example: { submitted: true } } })
  @ApiResponse({ status: 400, description: 'Versão não publicada ou instância inválida' })
  async submit(
    @TenantId() tenantId: string,
    @ActorId() actorId: string,
    @Param('id') id: string,
  ) {
    await this.commandBus.execute(new SubmitInstanceCommand(id, tenantId, actorId));
    return { submitted: true };
  }

  @Get()
  @ApiOperation({ summary: 'Listar instâncias do tenant' })
  @ApiQuery({ name: 'status', required: false, example: 'active', description: 'Filtrar por status' })
  @ApiResponse({ status: 200, description: 'Lista de instâncias' })
  async findAll(@TenantId() tenantId: string, @Query('status') status?: string) {
    const instances = await this.instanceRepo.findAll(tenantId, { status });
    return instances.map((i) => ({
      id: i.id,
      status: i.status,
      templateId: i.templateId,
      createdBy: i.createdBy,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar instância com steps e decisões' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Instância encontrada' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    const instance: WorkflowInstance = await this.queryBus.execute(
      new GetInstanceQuery(id, tenantId),
    );
    return {
      id: instance.id,
      status: instance.status,
      snapshot: instance.snapshot
        ? {
            templateId: instance.snapshot.templateId,
            versionId: instance.snapshot.versionId,
            versionNumber: instance.snapshot.versionNumber,
            steps: instance.snapshot.steps.map((s) => ({
              stepOrder: s.stepOrder,
              stepName: s.stepName,
              approvers: s.approvers,
              slaHours: s.slaHours,
            })),
          }
        : null,
      steps: instance.steps.map((s) => ({
        id: s.id,
        stepName: s.stepName,
        status: s.status,
        approvers: s.approvers,
        slaHours: s.slaHours,
        slaDeadline: s.slaDeadline,
        slaBreached: s.slaBreached,
        decisions: s.decisions,
      })),
    };
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline auditável da instância (todos os eventos em ordem cronológica)' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Timeline de eventos' })
  async timeline(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.queryBus.execute(new GetTimelineQuery(id, tenantId));
  }
}
