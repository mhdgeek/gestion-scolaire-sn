#!/bin/bash
echo "🔧 Configuration avec Application Existante"
echo "=========================================="

# 1. Nettoyer
rm -rf .elasticbeanstalk .ebextensions 2>/dev/null

# 2. Vérifier les applications existantes
echo "📋 Applications EB existantes :"
aws elasticbeanstalk describe-applications \
  --region us-east-1 \
  --query 'Applications[*].ApplicationName' \
  --output table

# 3. Initialiser avec l'application existante
echo ""
echo "🏗️ Initialisation avec 'gestion-scolaire'..."
eb init \
  --platform "Docker" \
  --region "us-east-1" \
  <<< "$(echo -e "1\n1\nn\n")"

# 4. Vérifier la config
echo ""
echo "✅ Configuration locale :"
cat .elasticbeanstalk/config.yml 2>/dev/null || echo "Config non créée"

# 5. Créer un nouvel environnement (nom unique)
NEW_ENV="gestion-scolaire-prod-$(date +%Y%m%d-%H%M)"
echo ""
echo "🌱 Création environnement : $NEW_ENV"
eb create $NEW_ENV --platform "Docker" --sample --single

echo ""
echo "📌 Prochaines étapes :"
echo "1. Mettre à jour GitHub Actions avec le nom: $NEW_ENV"
echo "2. eb deploy pour déployer votre code"
echo "3. eb setenv pour les variables"
