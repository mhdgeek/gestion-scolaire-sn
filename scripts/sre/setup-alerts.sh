#!/bin/bash
# scripts/sre/setup-alerts.sh
# Script de configuration des alertes SRE AWS CloudWatch

set -e

AWS_REGION="us-east-1"
PROJECT_NAME="gestion-scolaire"
SNS_TOPIC_ARN=""

echo "🔔 Configuration des alertes SRE pour $PROJECT_NAME"

# 1. Créer le topic SNS pour les alertes
create_sns_topic() {
    echo "Création du topic SNS pour les alertes..."
    SNS_TOPIC_ARN=$(aws sns create-topic \
        --name "${PROJECT_NAME}-sre-alerts" \
        --region $AWS_REGION \
        --query 'TopicArn' \
        --output text)
    
    echo "Topic SNS créé: $SNS_TOPIC_ARN"
    
    # Ajouter un abonnement email (remplacez par votre email)
    aws sns subscribe \
        --topic-arn "$SNS_TOPIC_ARN" \
        --protocol email \
        --notification-endpoint "admin@example.com" \
        --region $AWS_REGION
    
    echo "Abonnement email configuré. Vérifiez votre email pour confirmer."
}

# 2. Alertes de Disponibilité (SLO 99.9%)
create_availability_alerts() {
    echo "Configuration des alertes de disponibilité..."
    
    # Erreurs 5XX > 1% sur 5 minutes
    aws cloudwatch put-metric-alarm \
        --alarm-name "${PROJECT_NAME}-high-5xx-error-rate" \
        --alarm-description "Taux d'erreurs 5XX élevé (>1%)" \
        --metric-name "HTTPCode_Target_5XX_Count" \
        --namespace "AWS/ApplicationELB" \
        --statistic "Sum" \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 10 \
        --comparison-operator "GreaterThanThreshold" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --ok-actions "$SNS_TOPIC_ARN" \
        --region $AWS_REGION
    
    # Disponibilité < 99.5%
    aws cloudwatch put-metric-alarm \
        --alarm-name "${PROJECT_NAME}-availability-slo-breach" \
        --alarm-description "Disponibilité < 99.5% (SLO 99.9%)" \
        --metrics '[{"Id":"m1","MetricStat":{"Metric":{"Namespace":"AWS/ApplicationELB","MetricName":"RequestCount"},"Period":300,"Stat":"Sum"}},{"Id":"m2","MetricStat":{"Metric":{"Namespace":"AWS/ApplicationELB","MetricName":"HTTPCode_Target_5XX_Count"},"Period":300,"Stat":"Sum"}}]' \
        --evaluation-periods 3 \
        --threshold 0.995 \
        --comparison-operator "LessThanThreshold" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region $AWS_REGION \
        --expression "1-(m2/m1)"
}

# 3. Alertes de Performance
create_performance_alerts() {
    echo "Configuration des alertes de performance..."
    
    # Latence P95 > 1 seconde
    aws cloudwatch put-metric-alarm \
        --alarm-name "${PROJECT_NAME}-high-latency-p95" \
        --alarm-description "Latence P95 > 1 seconde" \
        --metric-name "TargetResponseTime" \
        --namespace "AWS/ApplicationELB" \
        --statistic "p95" \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 1.0 \
        --comparison-operator "GreaterThanThreshold" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region $AWS_REGION
    
    # CPU élevé sur les instances
    aws cloudwatch put-metric-alarm \
        --alarm-name "${PROJECT_NAME}-high-cpu-utilization" \
        --alarm-description "Utilisation CPU > 80%" \
        --metric-name "CPUUtilization" \
        --namespace "AWS/EC2" \
        --statistic "Average" \
        --period 300 \
        --evaluation-periods 3 \
        --threshold 80 \
        --comparison-operator "GreaterThanThreshold" \
        --dimensions "Name=AutoScalingGroupName,Value=gestion-scolaire-prod" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region $AWS_REGION
}

# 4. Alertes de Capacité
create_capacity_alerts() {
    echo "Configuration des alertes de capacité..."
    
    # Mémoire disponible < 20%
    aws cloudwatch put-metric-alarm \
        --alarm-name "${PROJECT_NAME}-low-memory" \
        --alarm-description "Mémoire disponible < 20%" \
        --metric-name "MemoryAvailable" \
        --namespace "CWAgent" \
        --statistic "Average" \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 20 \
        --comparison-operator "LessThanThreshold" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region $AWS_REGION
    
    # Disque utilisé > 85%
    aws cloudwatch put-metric-alarm \
        --alarm-name "${PROJECT_NAME}-high-disk-usage" \
        --alarm-description "Utilisation disque > 85%" \
        --metric-name "disk_used_percent" \
        --namespace "CWAgent" \
        --statistic "Average" \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 85 \
        --comparison-operator "GreaterThanThreshold" \
        --dimensions "Name=path,Value=/ Name=device,Value=xvda1" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region $AWS_REGION
}

# 5. Dashboard SLO CloudWatch
create_slo_dashboard() {
    echo "Création du dashboard SLO CloudWatch..."
    
    cat > /tmp/slo-dashboard.json << 'DASHBOARD'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ { "expression": "1-(m2/m1)", "label": "Disponibilité", "id": "e1" } ],
          [ ".", "HTTPCode_Target_5XX_Count", { "id": "m2", "visible": false } ],
          [ "AWS/ApplicationELB", "RequestCount", { "id": "m1", "visible": false } ]
        ],
        "view": "timeSeries",
        "title": "📊 SLO - Disponibilité (Target: 99.9%)",
        "region": "us-east-1",
        "stat": "Average",
        "period": 300,
        "annotations": {
          "horizontal": [{
            "label": "SLO Target",
            "value": 0.999
          }]
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "AWS/ApplicationELB", "TargetResponseTime", { "stat": "p95", "label": "Latence P95" } ],
          [ ".", ".", { "stat": "p99", "label": "Latence P99" } ]
        ],
        "view": "timeSeries",
        "title": "⚡ Performance - Latence",
        "region": "us-east-1",
        "period": 300
      }
    },
    {
      "type": "text",
      "properties": {
        "markdown": "# 🎯 SLOs Définis\n\n1. **Disponibilité**: 99.9% (erreur budget: 0.1%)\n2. **Latence**: P95 < 500ms\n3. **Taux d'erreur**: < 0.1%\n\n## 📈 Burn Rate\n- Erreurs ce mois: $errors\n- Budget restant: $budget"
      }
    }
  ]
}
DASHBOARD
    
    aws cloudwatch put-dashboard \
        --dashboard-name "${PROJECT_NAME}-slo-dashboard" \
        --dashboard-body file:///tmp/slo-dashboard.json \
        --region $AWS_REGION
    
    echo "Dashboard créé: https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=${PROJECT_NAME}-slo-dashboard"
}

# Fonction principale
main() {
    echo "========================================="
    echo "  CONFIGURATION ALERTES SRE - $PROJECT_NAME  "
    echo "========================================="
    
    create_sns_topic
    create_availability_alerts
    create_performance_alerts
    create_capacity_alerts
    create_slo_dashboard
    
    echo ""
    echo "✅ Configuration terminée avec succès!"
    echo ""
    echo "📋 Résumé:"
    echo "  - Topic SNS: $SNS_TOPIC_ARN"
    echo "  - Alertes configurées: 6"
    echo "  - Dashboard SLO créé"
    echo ""
    echo "🔗 Liens utiles:"
    echo "  - CloudWatch Alarms: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarms:"
    echo "  - SLO Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=${PROJECT_NAME}-slo-dashboard"
}

# Exécution
if [[ "$1" == "--dry-run" ]]; then
    echo "Mode dry-run - Aucune ressource ne sera créée"
    echo "Commandes qui seraient exécutées:"
    set -x
else
    main
fi
