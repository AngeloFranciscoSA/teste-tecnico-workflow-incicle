import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  IWorkflowInstanceRepository,
  WORKFLOW_INSTANCE_REPOSITORY,
} from '../../../workflow/domain/repositories/workflow-instance.repository';
import { InstanceStatus } from '../../../workflow/domain/aggregates/workflow-instance/workflow-instance.aggregate';
import { StepStatus } from '../../../workflow/domain/aggregates/workflow-instance/instance-step.entity';
import { TenantId } from '@shared/infra/http/tenant.decorators';

@ApiTags('Analytics')
@ApiBearerAuth('bearer')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: IWorkflowInstanceRepository,
  ) {}

  @Get('sla-compliance')
  @ApiOperation({ summary: 'Relatório de conformidade de SLA por tenant' })
  @ApiResponse({
    status: 200,
    description: 'Métricas de SLA',
    schema: {
      example: {
        totalInstances: 150,
        completedInstances: 120,
        pendingInstances: 30,
        totalSteps: 450,
        breachedSteps: 12,
        complianceRate: '97.33%',
      },
    },
  })
  async slaCompliance(@TenantId() tenantId: string) {
    const instances = await this.instanceRepo.findAll(tenantId);

    let totalSteps = 0;
    let breachedSteps = 0;
    let completedInstances = 0;
    let pendingInstances = 0;

    for (const instance of instances) {
      if (instance.status === InstanceStatus.COMPLETED) completedInstances++;
      if (instance.status === InstanceStatus.ACTIVE) pendingInstances++;

      for (const step of instance.steps) {
        totalSteps++;
        if (step.status === StepStatus.PENDING && step.isSlaBreached()) {
          breachedSteps++;
        }
      }
    }

    const complianceRate = totalSteps > 0
      ? (((totalSteps - breachedSteps) / totalSteps) * 100).toFixed(2)
      : '100.00';

    return {
      totalInstances: instances.length,
      completedInstances,
      pendingInstances,
      totalSteps,
      breachedSteps,
      complianceRate: `${complianceRate}%`,
    };
  }
}
