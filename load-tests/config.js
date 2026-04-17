import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const JWT_SECRET = __ENV.JWT_SECRET || 'change-me';

// Tenant criado pelo seed
export const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

// Aprovadores definidos no seed
export const APPROVERS = ['user-manager-1', 'user-director-1', 'user-director-2'];

function createJwt(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = encoding.b64encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'rawurl');
  const payload = encoding.b64encode(
    JSON.stringify({
      sub: userId,
      companyId: TENANT_ID,
      iat: now,
      exp: now + 3600,
    }),
    'rawurl',
  );
  const data = `${header}.${payload}`;
  const signature = crypto.hmac('sha256', JWT_SECRET, data, 'base64rawurl');
  return `${data}.${signature}`;
}

export function authHeaders(userId) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${createJwt(userId)}`,
  };
}

export const HEADERS = authHeaders(APPROVERS[0]);

// IDs das 10k instâncias criadas pelo seed
// Formato: b0000000-0000-0000-0000-000000000000 a b0000000-0000-0000-0000-000000009999
export function randomSeedInstanceId() {
  const n = Math.floor(Math.random() * 10_000);
  return `b0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}

export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<500'],   // p95 < 500ms
  http_req_failed: ['rate<0.02'],     // taxa de erro < 2%
};
