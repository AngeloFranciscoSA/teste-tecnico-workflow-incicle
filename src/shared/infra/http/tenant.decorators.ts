import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface AuthRequest {
  auth?: {
    companyId: string;
    userId: string;
  };
}

/**
 * Extrai o company_id validado do JWT.
 */
export const TenantId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    return req.auth!.companyId;
  },
);

/**
 * Extrai o user_id validado do JWT.
 */
export const ActorId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    return req.auth!.userId;
  },
);
