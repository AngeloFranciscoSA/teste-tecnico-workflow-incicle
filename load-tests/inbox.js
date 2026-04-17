/**
 * Teste de carga: GET /approvals/inbox
 *
 * Simula aprovadores consultando sua caixa de entrada simultaneamente.
 * Base: 10k instâncias ativas criadas pelo seed.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, HEADERS, DEFAULT_THRESHOLDS } from './config.js';

const inboxDuration = new Trend('inbox_duration', true);
const inboxErrors = new Rate('inbox_errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up
    { duration: '1m',  target: 50 },   // carga sustentada
    { duration: '30s', target: 100 },  // pico
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    inbox_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/approvals/inbox`, { headers: HEADERS });

  inboxDuration.add(res.timings.duration);
  inboxErrors.add(res.status !== 200);

  check(res, {
    'inbox: status 200': (r) => r.status === 200,
    'inbox: resposta é array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch { return false; }
    },
  });

  sleep(0.5);
}
