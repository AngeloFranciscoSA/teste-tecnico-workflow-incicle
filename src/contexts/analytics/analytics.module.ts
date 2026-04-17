import { Module } from '@nestjs/common';
import { AnalyticsController } from './infra/http/analytics.controller';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
