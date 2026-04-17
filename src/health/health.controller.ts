import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RABBITMQ_CLIENT } from '../shared/infra/messaging/outbox-publisher.service';
import { Public } from '../shared/infra/auth/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(RABBITMQ_CLIENT)
    private readonly brokerClient: ClientProxy,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness probe — verifica se a aplicação está em pé' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok', timestamp: '2026-04-15T00:00:00.000Z' } } })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe — verifica se banco de dados e broker estão acessíveis' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        status: 'ok',
        checks: { database: 'ok', broker: 'ok' },
        timestamp: '2026-04-15T00:00:00.000Z',
      },
    },
  })
  async readiness() {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'unavailable';
    }

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );
      await Promise.race([this.brokerClient.connect(), timeout]);
      checks.broker = 'ok';
    } catch {
      checks.broker = 'unavailable';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    return {
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
