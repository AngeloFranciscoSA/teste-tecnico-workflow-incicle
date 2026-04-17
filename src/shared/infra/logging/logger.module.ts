import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';

const logsDir = path.resolve(process.cwd(), 'logs');

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        // Console — JSON colorido em dev, puro em prod
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            process.env.NODE_ENV === 'production'
              ? winston.format.json()
              : winston.format.combine(
                  winston.format.colorize(),
                  winston.format.printf(({ timestamp, level, message, context, stack }) => {
                    const ctx = context ? ` [${context}]` : '';
                    return `${timestamp} ${level}${ctx}: ${stack ?? message}`;
                  }),
                ),
          ),
        }),

        // Arquivo geral — todos os níveis
        new winston.transports.File({
          filename: path.join(logsDir, 'app.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
          maxsize: 10 * 1024 * 1024, // 10 MB
          maxFiles: 5,
          tailable: true,
        }),

        // Arquivo de erros — apenas warn/error
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'warn',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          tailable: true,
        }),
      ],
    }),
  ],
})
export class LoggerModule {}
