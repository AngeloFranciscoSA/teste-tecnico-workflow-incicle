import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

/**
 * Captura erros de domínio (Error simples) que borbulham até a camada HTTP
 * e os converte em 422 Unprocessable Entity com a mensagem original.
 * Exceções NestJS (HttpException) já têm tratamento próprio e são ignoradas.
 */
@Catch(Error)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json(exception.getResponse());
    }

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: exception.message,
      error: 'Unprocessable Entity',
    });
  }
}
