#!/bin/bash
# scripts/sre/load-test.sh
# Script de test de charge pour validation SLO

set -e

APP_URL="https://votre-app.elasticbeanstalk.com"
DURATION="5m"
VUS="50"  # Virtual Users

echo "🧪 Démarrage du test de charge SLO pour $APP_URL"
echo "Durée: $DURATION | Utilisateurs: $VUS"

# Installation de k6 si nécessaire
if ! command -v k6 &> /dev/null; then
    echo "Installation de k6..."
    brew install k6  # Sur macOS
fi

# Création du script de test
cat > /tmp/load-test.js << 'K6SCRIPT'
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métriques custom
const errorRate = new Rate('errors');
const p95Latency = new Trend('p95_latency');

// Options
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Montée en charge
    { duration: '3m', target: 50 },   // Charge normale
    { duration: '1m', target: 0 },    // Descalade
  ],
  thresholds: {
    // SLO: Latence P95 < 500ms
    'http_req_duration{type:api}': ['p(95)<500'],
    
    // SLO: Taux d'erreur < 0.1%
    'errors': ['rate<0.001'],
    
    // SLO: Disponibilité > 99.9%
    'http_req_failed': ['rate<0.001'],
  },
};

export default function () {
  // Test 1: Health check
  group('Health checks', function () {
    const res = http.get(`${__ENV.APP_URL}/health`);
    check(res, {
      'health status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
    });
    errorRate.add(res.status !== 200);
  });

  // Test 2: API principale
  group('API endpoints', function () {
    // Endpoint étudiants (GET)
    const studentsRes = http.get(`${__ENV.APP_URL}/api/students`, {
      tags: { type: 'api' }
    });
    check(studentsRes, {
      'students API status 200': (r) => r.status === 200,
    });
    errorRate.add(studentsRes.status !== 200);
    p95Latency.add(studentsRes.timings.duration);

    // Endpoint création (POST)
    const createRes = http.post(
      `${__ENV.APP_URL}/api/students`,
      JSON.stringify({
        name: `Test Student ${Math.random()}`,
        email: `test${Math.random()}@example.com`
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'api' }
      }
    );
    check(createRes, {
      'create API status 201': (r) => r.status === 201,
    });
    errorRate.add(createRes.status !== 201);
    
    sleep(0.5); // Pause entre requêtes
  });
  
  // Test 3: Métriques Prometheus
  group('Metrics endpoint', function () {
    const metricsRes = http.get(`${__ENV.APP_URL}/metrics`);
    check(metricsRes, {
      'metrics status 200': (r) => r.status === 200,
    });
  });
}
K6SCRIPT

echo "Exécution du test de charge..."
k6 run --out json=results.json \
  --env APP_URL="$APP_URL" \
  /tmp/load-test.js

echo "📊 Analyse des résultats..."
echo ""

# Analyse des résultats
if [ -f results.json ]; then
  echo "=== RÉSULTATS DU TEST DE CHARGE ==="
  echo ""
  
  # Extraire les métriques clés
  TOTAL_REQUESTS=$(jq '.metrics.http_reqs.value' results.json)
  ERROR_RATE=$(jq '.metrics.http_req_failed.value' results.json)
  P95_LATENCY=$(jq '.metrics.http_req_duration.values["p(95)"]' results.json)
  
  echo "Requêtes totales: $TOTAL_REQUESTS"
  printf "Taux d'erreur: %.4f%%\n" $(echo "$ERROR_RATE * 100" | bc -l)
  printf "Latence P95: %.2f ms\n" $P95_LATENCY
  echo ""
  
  # Vérification des SLOs
  echo "=== VÉRIFICATION SLOs ==="
  
  if (( $(echo "$ERROR_RATE < 0.001" | bc -l) )); then
    echo "✅ SLO Taux d'erreur (<0.1%): PASS"
  else
    echo "❌ SLO Taux d'erreur (<0.1%): FAIL"
  fi
  
  if (( $(echo "$P95_LATENCY < 500" | bc -l) )); then
    echo "✅ SLO Latence P95 (<500ms): PASS"
  else
    echo "❌ SLO Latence P95 (<500ms): FAIL"
  fi
  
  # Générer un rapport
  cat > load-test-report-$(date +%Y%m%d).md << 'REPORT'
# Rapport de Test de Charge - $(date)

## Résumé
- **Application**: $APP_URL
- **Durée**: $DURATION
- **Utilisateurs simulés**: $VUS

## Métriques
- Requêtes totales: $TOTAL_REQUESTS
- Taux d'erreur: $(echo "$ERROR_RATE * 100" | bc -l)%
- Latence P95: $P95_LATENCY ms

## SLOs
1. Taux d'erreur < 0.1%: $(if (( $(echo "$ERROR_RATE < 0.001" | bc -l) )); then echo "✅ PASS"; else echo "❌ FAIL"; fi)
2. Latence P95 < 500ms: $(if (( $(echo "$P95_LATENCY < 500" | bc -l) )); then echo "✅ PASS"; else echo "❌ FAIL"; fi)

## Recommandations
$(if (( $(echo "$P95_LATENCY > 400" | bc -l) )); then echo "- Optimiser les requêtes database"; fi)
$(if (( $(echo "$ERROR_RATE > 0.0005" | bc -l) )); then echo "- Améliorer la gestion des erreurs"; fi)
REPORT
  
  echo ""
  echo "📝 Rapport généré: load-test-report-$(date +%Y%m%d).md"
else
  echo "❌ Erreur: Fichier de résultats non trouvé"
  exit 1
fi

echo ""
echo "✅ Test de charge terminé avec succès"
