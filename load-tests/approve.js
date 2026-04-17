/**
 * Teste de carga: POST /approvals/:instanceId/steps/:stepId/approve
 *
 * Simula aprovações em instâncias distintas (sem colisão proposital).
 * Usa o endpoint de GET para descobrir o stepId antes de aprovar.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE_URL, HEADERS, authHeaders, randomSeedInstanceId, DEFAULT_THRESHOLDS } from './config.js';

const approveDuration = new Trend('approve_duration', true);
const approveErrors = new Rate('approve_errors');
const approveConflicts = new Counter('approve_conflicts');

export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '1m',  target: 30 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    approve_duration: ['p(95)<500'],
  },
};

export default function () {
  const instanceId = randomSeedInstanceId();

  // 1. Busca a instância para obter stepId
  const getRes = http.get(`${BASE_URL}/instances/${instanceId}`, { headers: HEADERS });
  if (getRes.status !== 200) {
    approveErrors.add(1);
    sleep(0.2);
    return;
  }

  const instance = JSON.parse(getRes.body);
  const pendingStep = instance.steps?.find((s) => s.status === 'pending');
  if (!pendingStep) {
    sleep(0.2);
    return;
  }

  // 2. Aprova
  const approverId = pendingStep.approvers?.[0];
  if (!approverId) {
    approveErrors.add(1);
    sleep(0.2);
    return;
  }

  const res = http.post(
    `${BASE_URL}/approvals/${instanceId}/steps/${pendingStep.id}/approve`,
    JSON.stringify({}),
    { headers: authHeaders(approverId) },
  );

  approveDuration.add(res.timings.duration);

  if (res.status === 409) {
    approveConflicts.add(1);
  } else {
    approveErrors.add(res.status >= 500);
  }

  check(res, {
    'approve: status 2xx ou 409 ou 400': (r) => r.status < 300 || r.status === 409 || r.status === 400,
  });

  sleep(0.3);
}
