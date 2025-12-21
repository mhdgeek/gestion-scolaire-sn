#!/bin/bash
echo "🔧 Configuration ECR complète"
echo "============================="

AWS_REGION="us-east-1"
ECR_REPO="gestion-scolaire-backend"

echo ""
echo "1. Vérification des credentials AWS..."
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS CLI non configurée"
  echo "   Exécutez: aws configure"
  exit 1
fi
echo "✅ AWS CLI configurée"

echo ""
echo "2. Vérification du repository ECR..."
if aws ecr describe-repositories \
  --repository-names "$ECR_REPO" \
  --region "$AWS_REGION" &>/dev/null; then
  echo "✅ Repository ECR existe déjà"
else
  echo "🔧 Création du repository ECR..."
  aws ecr create-repository \
    --repository-name "$ECR_REPO" \
    --region "$AWS_REGION"
  echo "✅ Repository ECR créé"
fi

echo ""
echo "3. URI du repository ECR:"
ECR_URI=$(aws ecr describe-repositories \
  --repository-names "$ECR_REPO" \
  --region "$AWS_REGION" \
  --query 'repositories[0].repositoryUri' \
  --output text)
echo "   $ECR_URI"

echo ""
echo "4. Test d'authentification Docker..."
if aws ecr get-login-password --region "$AWS_REGION" | \
   docker login --username AWS --password-stdin "$ECR_URI"; then
  echo "✅ Authentification Docker réussie"
else
  echo "❌ Échec d'authentification"
fi

echo ""
echo "✅ Configuration ECR terminée !"
