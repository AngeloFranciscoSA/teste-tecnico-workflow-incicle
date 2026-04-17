import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from './public.decorator';

interface JwtPayload {
  sub: string;
  companyId: string;
  exp?: number;
  nbf?: number;
  iat?: number;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function decodeBase64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authorization header must be Bearer token');
    }

    const payload = this.verifyToken(token);
    request.auth = {
      userId: payload.sub,
      companyId: payload.companyId,
      tokenPayload: payload,
    };

    return true;
  }

  private verifyToken(token: string): JwtPayload {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET is not configured');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid JWT format');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    let header: { alg?: string; typ?: string };
    let payload: JwtPayload;

    try {
      header = JSON.parse(decodeBase64Url(encodedHeader));
      payload = JSON.parse(decodeBase64Url(encodedPayload));
    } catch {
      throw new UnauthorizedException('Invalid JWT encoding');
    }

    if (header.alg !== 'HS256') {
      throw new UnauthorizedException('Unsupported JWT algorithm');
    }

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = Buffer.from(
      encodeBase64Url(createHmac('sha256', secret).update(data).digest()),
      'utf8',
    );
    const receivedSignature = Buffer.from(
      encodeBase64Url(decodeBase64UrlToBuffer(encodedSignature)),
      'utf8',
    );

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      throw new UnauthorizedException('Invalid JWT signature');
    }

    if (!payload.sub || !payload.companyId) {
      throw new UnauthorizedException('JWT payload must contain sub and companyId');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.nbf && payload.nbf > now) {
      throw new UnauthorizedException('JWT not active yet');
    }
    if (payload.exp && payload.exp <= now) {
      throw new UnauthorizedException('JWT expired');
    }

    return payload;
  }
}
