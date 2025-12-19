# 🚨 RUNBOOK - Incident: Disponibilité < 99.9% SLO

## 🔍 Détection
- **Métrique**: `availability < 0.999` sur 5 minutes
- **Alerte**: CloudWatch → SNS → Slack #incidents
- **Dashboard**: SLO Dashboard widget rouge

## 🚨 Classification
- **Severité**: SEV-1 (Critique)
- **Impact**: Application inaccessible ou très lente
- **Urgence**: Immédiate

## 🎯 Objectif de Résolution
- **MTTR Target**: < 30 minutes
- **Restauration**: Retour à > 99.5% dans 15 minutes

## 🔧 Procédure de Diagnostic

### Étape 1: Analyse Initiale (0-5 min)
```bash
# 1. Vérifier le statut Elastic Beanstalk
eb status gestion-scolaire-prod --region us-east-1

# 2. Vérifier les health checks
curl -f https://votre-app.elasticbeanstalk.com/health

# 3. Vérifier les métriques CloudWatch
aws cloudwatch get-metric-data \
  --metric-data-queries file://queries.json \
  --start-time "$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --region us-east-1
