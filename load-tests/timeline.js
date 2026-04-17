/**
 * Teste de carga: GET /instances/:id/timeline
 *
 * Simula múltiplos usuários consultando a linha do tempo de instâncias.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, HEADERS, randomSeedInstanceId, DEFAULT_THRESHOLDS } from './config.js';

const timelineDuration = new Trend('timeline_duration', true);
const timelineErrors = new Rate('timeline_errors');

export const options = {
  stages: [
    { duration: '30s', target: 30 },
    { duration: '2m',  target: 80 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    timeline_duration: ['p(95)<500'],
  },
};

export default function () {
  const instanceId = randomSeedInstanceId();

  const res = http.get(`${BASE_URL}/instances/${instanceId}/timeline`, { headers: HEADERS });

  timelineDuration.add(res.timings.duration);
  timelineErrors.add(res.status !== 200);

  check(res, {
    'timeline: status 200': (r) => r.status === 200,
    'timeline: resposta é array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch { return false; }
    },
  });

  sleep(0.3);
}
