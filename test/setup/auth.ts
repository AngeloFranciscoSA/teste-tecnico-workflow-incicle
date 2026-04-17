import { createHmac } from 'crypto';

interface TestJwtPayload {
  sub: string;
  companyId: string;
  iat?: number;
  exp?: number;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function signTestJwt(payload: TestJwtPayload): string {
  const secret = process.env.JWT_SECRET ?? 'test-secret';
  const now = Math.floor(Date.now() / 1000);
  const completePayload = {
    iat: now,
    exp: now + 3600,
    ...payload,
  };

  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(completePayload));
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function authHeader(userId: string, companyId = 'tenant-test') {
  return {
    Authorization: `Bearer ${signTestJwt({ sub: userId, companyId })}`,
  };
}
