#!/bin/bash
# Executa todos os scripts k6 e salva os resultados em JSON
# Uso: ./load-tests/run-all.sh [BASE_URL]

BASE_URL=${1:-http://localhost:3000}
RESULTS_DIR="load-tests/results"
mkdir -p "$RESULTS_DIR"

echo "=== Teste de Carga InCicle Workflow ==="
echo "Base URL: $BASE_URL"
echo ""

echo "[1/3] Testando GET /approvals/inbox..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/inbox.json" \
  --summary-export="$RESULTS_DIR/inbox-summary.json" \
  load-tests/inbox.js

echo ""
echo "[2/3] Testando POST /approvals/approve..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/approve.json" \
  --summary-export="$RESULTS_DIR/approve-summary.json" \
  load-tests/approve.js

echo ""
echo "[3/3] Testando GET /instances/:id/timeline..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/timeline.json" \
  --summary-export="$RESULTS_DIR/timeline-summary.json" \
  load-tests/timeline.js

echo ""
echo "=== Resultados salvos em $RESULTS_DIR ==="
