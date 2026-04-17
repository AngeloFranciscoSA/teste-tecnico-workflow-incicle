import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { WorkflowTemplate } from '../../domain/aggregates/workflow-template/workflow-template.aggregate';
import { TemplateVersion, VersionStatus } from '../../domain/aggregates/workflow-template/template-version.entity';
import { ApprovalRule } from '../../domain/value-objects/approval-rule.vo';
import {
  IWorkflowTemplateRepository,
  WORKFLOW_TEMPLATE_REPOSITORY,
} from '../../domain/repositories/workflow-template.repository';
import { TenantId, ActorId } from '@shared/infra/http/tenant.decorators';

@ApiTags('Templates')
@ApiBearerAuth('bearer')
@Controller('templates')
export class TemplatesController {
  constructor(
    @Inject(WORKFLOW_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IWorkflowTemplateRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar template de workflow' })
  @ApiResponse({ status: 201, description: 'Template criado', schema: { example: { id: 'uuid' } } })
  async create(@TenantId() tenantId: string, @Body() dto: CreateTemplateDto) {
    const template = new WorkflowTemplate({ id: dto.id, tenantId, name: dto.name });
    await this.templateRepo.save(template);
    return { id: template.id };
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Adicionar versão (draft) ao template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 201, description: 'Versão criada', schema: { example: { id: 'uuid', versionNumber: 1 } } })
  async createVersion(
    @TenantId() tenantId: string,
    @Param('id') templateId: string,
    @Body() dto: CreateVersionDto,
  ) {
    const template = await this.templateRepo.findById(templateId, tenantId);
    if (!template) throw new NotFoundException('Template not found');

    const version = new TemplateVersion({
      id: dto.id,
      templateId,
      versionNumber: template.versions.length + 1,
      status: VersionStatus.DRAFT,
      steps: dto.steps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        stepName: s.stepName,
        approvalRule: s.approvalRule === 'QUORUM'
          ? ApprovalRule.quorum(s.quorumCount!)
          : s.approvalRule === 'ANY'
          ? ApprovalRule.any()
          : ApprovalRule.all(),
        approvers: s.approvers,
        slaHours: s.slaHours,
      })),
    });

    template.addVersion(version);
    await this.templateRepo.save(template);
    return { id: version.id, versionNumber: version.versionNumber };
  }

  @Post(':id/versions/:versionId/publish')
  @ApiOperation({ summary: 'Publicar versão do template (imutável após publicação)' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiParam({ name: 'versionId', description: 'UUID da versão' })
  @ApiResponse({ status: 201, description: 'Versão publicada', schema: { example: { published: true } } })
  async publish(
    @TenantId() tenantId: string,
    @Param('id') templateId: string,
    @Param('versionId') versionId: string,
  ) {
    const template = await this.templateRepo.findById(templateId, tenantId);
    if (!template) throw new NotFoundException('Template not found');
    template.publish(versionId);
    await this.templateRepo.save(template);
    return { published: true };
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os templates do tenant' })
  @ApiResponse({ status: 200, description: 'Lista de templates' })
  async findAll(@TenantId() tenantId: string) {
    const templates = await this.templateRepo.findAll(tenantId);
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      versions: t.versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber, status: v.status })),
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar template por ID com suas versões e steps' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template encontrado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    const template = await this.templateRepo.findById(id, tenantId);
    if (!template) throw new NotFoundException('Template not found');
    return {
      id: template.id,
      name: template.name,
      versions: template.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        steps: v.steps,
      })),
    };
  }
}
