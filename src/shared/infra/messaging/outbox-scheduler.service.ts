import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxPublisherService } from './outbox-publisher.service';

@Injectable()
export class OutboxSchedulerService {
  private readonly logger = new Logger(OutboxSchedulerService.name);

  constructor(private readonly outboxPublisher: OutboxPublisherService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async publishPendingEvents(): Promise<void> {
    this.logger.debug('Polling outbox for pending events...');
    await this.outboxPublisher.publishPending();
  }
}
