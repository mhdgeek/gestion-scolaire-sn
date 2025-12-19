#!/bin/bash

# ============================================
# SCRIPT DE DÉPLOIEMENT AWS - GESTION-SCOLAIRE
# ============================================
# Ce script déploie toutes les ressources AWS
# pour le projet gestion-scolaire.
# UTILISATION : ./deploy-aws.sh
# ============================================

set -e # Arrête le script à la première erreur

# Variables de configuration
PROJECT_NAME="gestion-scolaire"
AWS_REGION="us-east-1"
ECR_REPO="gestion-scolaire-backend"
EB_ENV_NAME="gestion-scolaire-prod"
CF_STACK="gestion-scolaire-network"
GITHUB_REPO="https://github.com/VOTRE_USER/VOTRE_REPO.git"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}  DÉPLOIEMENT AWS - $PROJECT_NAME  ${NC}"
echo -e "${BLUE}==================================${NC}"

# ==================== FONCTIONS ====================
check_aws_auth() {
    echo -e "${BLUE}[VÉRIFICATION] Authentification AWS...${NC}"
    if ! aws sts get-caller-identity &>/dev/null; then
        echo -e "${RED}❌ AWS CLI non configurée ou non authentifiée${NC}"
        echo "Exécutez d'abord: aws configure"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS CLI configurée${NC}"
}

check_docker() {
    echo -e "${BLUE}[VÉRIFICATION] Docker...${NC}"
    if ! docker ps &>/dev/null; then
        echo -e "${RED}❌ Docker n'est pas en cours d'exécution${NC}"
        echo "Ouvrez Docker Desktop et attendez qu'il soit prêt"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker en cours d'exécution${NC}"
}

check_git_remote_codecommit() {
    echo -e "${BLUE}[VÉRIFICATION] git-remote-codecommit...${NC}"
    if ! command -v git-remote-codecommit &>/dev/null; then
        echo -e "${YELLOW}⚠️ Installation de git-remote-codecommit...${NC}"
        pip3 install git-remote-codecommit || {
            echo -e "${RED}❌ Échec de l'installation. Installez-le manuellement:${NC}"
            echo "pip3 install git-remote-codecommit"
            exit 1
        }
    fi
    
    # Configuration Git pour CodeCommit
    git config --global credential.helper "!git-remote-codecommit credential-helper $@"
    git config --global credential.UseHttpPath true
    echo -e "${GREEN}✅ git-remote-codecommit configuré${NC}"
}

# ==================== ÉTAPE 1: VÉRIFICATIONS ====================
echo -e "\n${BLUE}[1/7] VÉRIFICATIONS PRÉALABLES${NC}"

check_aws_auth
check_docker
check_git_remote_codecommit

# Vérifier les variables d'environnement nécessaires
echo -e "${BLUE}[VÉRIFICATION] Variables d'environnement...${NC}"
read -p "MongoDB Atlas URI (mongodb+srv://...): " MONGODB_URI
read -p "JWT Secret (tapez 'gen' pour en générer un): " JWT_SECRET

if [ "$JWT_SECRET" = "gen" ]; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || \
                 openssl rand -hex 64)
    echo -e "${GREEN}✅ JWT Secret généré: ${JWT_SECRET:0:20}...${NC}"
fi

if [ -z "$MONGODB_URI" ] || [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ MongoDB URI et JWT Secret sont requis${NC}"
    exit 1
fi

# ==================== ÉTAPE 2: INFRASTRUCTURE CLOUDFORMATION ====================
echo -e "\n${BLUE}[2/7] DÉPLOIEMENT DE L'INFRASTRUCTURE${NC}"

# Créer le réseau VPC via CloudFormation
echo "Création du réseau VPC..."
cat > /tmp/network-stack.yml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Réseau VPC pour gestion-scolaire'
Resources:
  VPC:
    Type: 'AWS::EC2::VPC'
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: gestion-scolaire-vpc
  PublicSubnet:
    Type: 'AWS::EC2::Subnet'
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: gestion-scolaire-public-subnet
  InternetGateway:
    Type: 'AWS::EC2::InternetGateway'
    Properties:
      Tags:
        - Key: Name
          Value: gestion-scolaire-igw
  GatewayAttachment:
    Type: 'AWS::EC2::VPCGatewayAttachment'
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway
Outputs:
  VpcId:
    Description: ID du VPC
    Value: !Ref VPC
EOF

# Déployer la stack
if ! aws cloudformation describe-stacks --stack-name $CF_STACK --region $AWS_REGION &>/dev/null; then
    echo "Déploiement de la stack CloudFormation..."
    aws cloudformation deploy \
        --template-file /tmp/network-stack.yml \
        --stack-name $CF_STACK \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION
    
    echo -e "${GREEN}✅ Infrastructure CloudFormation déployée${NC}"
else
    echo -e "${YELLOW}⚠️ Stack CloudFormation existe déjà, continuation...${NC}"
fi

# ==================== ÉTAPE 3: REGISTRE DOCKER ECR ====================
echo -e "\n${BLUE}[3/7] CONFIGURATION DU REGISTRE DOCKER (ECR)${NC}"

# Créer le repository ECR
if ! aws ecr describe-repositories --repository-names $ECR_REPO --region $AWS_REGION &>/dev/null; then
    echo "Création du repository ECR..."
    aws ecr create-repository \
        --repository-name $ECR_REPO \
        --region $AWS_REGION
    
    echo -e "${GREEN}✅ Repository ECR créé${NC}"
else
    echo -e "${YELLOW}⚠️ Repository ECR existe déjà, continuation...${NC}"
fi

# Obtenir l'URI ECR
ECR_URI=$(aws ecr describe-repositories --repository-names $ECR_REPO --region $AWS_REGION \
    --query 'repositories[0].repositoryUri' --output text)

echo "URI ECR: $ECR_URI"

# ==================== ÉTAPE 4: CONSTRUCTION ET PUSH DE L'IMAGE ====================
echo -e "\n${BLUE}[4/7] CONSTRUCTION DE L'IMAGE DOCKER${NC}"

# Vérifier que le Dockerfile existe
if [ ! -f "./backend/Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile introuvable dans ./backend/${NC}"
    echo "Création d'un Dockerfile minimal..."
    
    cat > ./backend/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
EOF
    echo -e "${GREEN}✅ Dockerfile créé${NC}"
fi

# Construire l'image
echo "Construction de l'image Docker..."
docker build -t $ECR_REPO:latest ./backend

# Authentifier Docker vers ECR
echo "Authentification vers ECR..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_URI

# Tagger et pousser l'image
echo "Envoi de l'image vers ECR..."
docker tag $ECR_REPO:latest $ECR_URI:latest
docker push $ECR_URI:latest

echo -e "${GREEN}✅ Image Docker poussée vers ECR${NC}"

# ==================== ÉTAPE 5: ELASTIC BEANSTALK ====================
echo -e "\n${BLUE}[5/7] DÉPLOIEMENT ELASTIC BEANSTALK${NC}"

# Initialiser EB si ce n'est pas déjà fait
if [ ! -f "./.elasticbeanstalk/config.yml" ]; then
    echo "Initialisation d'Elastic Beanstalk..."
    
    # Créer la configuration EB
    cat > ./.ebextensions/01-app.config << EOF
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
    RetentionInDays: 7
EOF
    
    # Initialiser EB
    eb init $PROJECT_NAME \
        --platform "Docker" \
        --region $AWS_REGION \
        --interactive=false
else
    echo -e "${YELLOW}⚠️ EB déjà initialisé, continuation...${NC}"
fi

# Créer ou mettre à jour l'environnement
echo "Configuration de l'environnement EB..."
if ! eb status $EB_ENV_NAME --region $AWS_REGION &>/dev/null; then
    echo "Création de l'environnement EB..."
    eb create $EB_ENV_NAME \
        --platform "Docker" \
        --region $AWS_REGION \
        --sample \
        --single \
        --timeout 20
    
    # Attendre que l'environnement soit prêt
    echo "Attente du déploiement EB (peut prendre 10-15 minutes)..."
    eb events --follow --region $AWS_REGION &
    EB_EVENTS_PID=$!
    
    # Vérifier périodiquement l'état
    for i in {1..30}; do
        STATUS=$(eb status $EB_ENV_NAME --region $AWS_REGION --output json | grep -o '"Status":"[^"]*"' | cut -d'"' -f4)
        if [ "$STATUS" = "Ready" ]; then
            kill $EB_EVENTS_PID 2>/dev/null
            break
        fi
        echo "Attente ($i/30)..."
        sleep 30
    done
else
    echo "Mise à jour de l'environnement EB existant..."
    eb deploy $EB_ENV_NAME --region $AWS_REGION --timeout 20
fi

echo -e "${GREEN}✅ Environnement EB déployé${NC}"

# ==================== ÉTAPE 6: CONFIGURATION DES VARIABLES ====================
echo -e "\n${BLUE}[6/7] CONFIGURATION DES VARIABLES D'ENVIRONNEMENT${NC}"

# Encoder l'URI MongoDB si nécessaire
ENCODED_MONGODB_URI=$(python3 -c "
import urllib.parse
uri = '$MONGODB_URI'
# Vérifier si l'URI commence bien par mongodb+srv://
if not uri.startswith('mongodb+srv://'):
    # Essayer de corriger si c'est une URI incomplète
    if '@' in uri:
        uri = 'mongodb+srv://' + uri
    else:
        print('URI MongoDB invalide')
        exit(1)
print(urllib.parse.quote(uri, safe=''))
" 2>/dev/null || echo "$MONGODB_URI")

echo "Configuration des variables d'environnement..."
eb setenv \
    MONGODB_URI="$ENCODED_MONGODB_URI" \
    JWT_SECRET="$JWT_SECRET" \
    NODE_ENV="production" \
    PORT="8080" \
    --region $AWS_REGION

echo -e "${GREEN}✅ Variables d'environnement configurées${NC}"

# ==================== ÉTAPE 7: CONFIGURATION CI/CD ====================
echo -e "\n${BLUE}[7/7] CONFIGURATION CI/CD (GITHUB ACTIONS)${NC}"

# Créer le dossier des workflows
mkdir -p ./.github/workflows

# Créer le fichier de workflow
cat > ./.github/workflows/deploy.yml << EOF
name: Deploy to AWS

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  AWS_REGION: $AWS_REGION
  ECR_REPOSITORY: $ECR_REPO
  EB_ENVIRONMENT: $EB_ENV_NAME

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd backend
        npm ci
        
    - name: Run tests
      run: |
        cd backend
        npm test
        
    - name: Build Docker image
      run: |
        docker build -t \${{ env.ECR_REPOSITORY }}:latest ./backend

  deploy:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: \${{ env.AWS_REGION }}
        
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
      
    - name: Build and push Docker image
      env:
        ECR_REGISTRY: \${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: \${{ github.sha }}
      run: |
        docker build -t \$ECR_REGISTRY/\${{ env.ECR_REPOSITORY }}:\$IMAGE_TAG ./backend
        docker push \$ECR_REGISTRY/\${{ env.ECR_REPOSITORY }}:\$IMAGE_TAG
        docker tag \$ECR_REGISTRY/\${{ env.ECR_REPOSITORY }}:\$IMAGE_TAG \$ECR_REGISTRY/\${{ env.ECR_REPOSITORY }}:latest
        docker push \$ECR_REGISTRY/\${{ env.ECR_REPOSITORY }}:latest
        echo "✅ Image poussée vers ECR"
        
    - name: Deploy to Elastic Beanstalk
      uses: einaregilsson/beanstalk-deploy@v21
      with:
        aws_access_key: \${{ secrets.AWS_ACCESS_KEY_ID }}
        aws_secret_key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
        application_name: $PROJECT_NAME
        environment_name: \${{ env.EB_ENVIRONMENT }}
        region: \${{ env.AWS_REGION }}
        version_label: v\${{ github.run_number }}-\${{ github.sha }}
        deployment_package: ./
        use_existing_version_if_available: true
        wait_for_environment_recovery: 300
EOF

echo "Création du fichier Dockerrun.aws.json..."
cat > ./Dockerrun.aws.json << EOF
{
  "AWSEBDockerrunVersion": "1",
  "Image": {
    "Name": "$ECR_URI:latest",
    "Update": "true"
  },
  "Ports": [
    {
      "ContainerPort": 8080
    }
  ]
}
EOF

echo -e "${GREEN}✅ Configuration CI/CD créée${NC}"

# ==================== FINALISATION ====================
echo -e "\n${GREEN}==================================${NC}"
echo -e "${GREEN}  DÉPLOIEMENT TERMINÉ AVEC SUCCÈS  ${NC}"
echo -e "${GREEN}==================================${NC}"

# Afficher les informations de déploiement
APP_URL=$(eb status $EB_ENV_NAME --region $AWS_REGION --output json | grep -o '"CNAME":"[^"]*"' | cut -d'"' -f4)

echo -e "\n${BLUE}📋 INFORMATIONS DE DÉPLOIEMENT:${NC}"
echo "Application URL: http://$APP_URL"
echo "ECR Repository: $ECR_URI"
echo "EB Environment: $EB_ENV_NAME"
echo "AWS Region: $AWS_REGION"

echo -e "\n${BLUE}🚀 PROCHAINES ÉTAPES:${NC}"
echo "1. Ajoutez vos secrets AWS à GitHub:"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "2. Poussez le code vers GitHub:"
echo "   git add ."
echo "   git commit -m 'Deploy to AWS'"
echo "   git push origin main"
echo "3. Vérifiez le déploiement:"
echo "   eb logs --stream --region $AWS_REGION"
echo "   eb open --region $AWS_REGION"

echo -e "\n${YELLOW}⚠️  IMPORTANT:${NC}"
echo "Vérifiez que votre base MongoDB Atlas autorise les connexions depuis:"
echo " - Toutes les IP (0.0.0.0/0) temporairement"
echo " - Ou l'IP de votre instance EB"

# Créer un fichier de résumé
cat > ./deploy-summary.txt << EOF
Déploiement AWS - $PROJECT_NAME
Date: $(date)
===============================
Application URL: http://$APP_URL
ECR Repository: $ECR_URI
EB Environment: $EB_ENV_NAME
AWS Region: $AWS_REGION
MongoDB URI: ${MONGODB_URI:0:30}...
JWT Secret: ${JWT_SECRET:0:20}...

Prochaines étapes:
1. Configurer les secrets GitHub
2. Pousser le code vers GitHub
3. Vérifier les logs EB: eb logs --stream
EOF

echo -e "\n${GREEN}Résumé sauvegardé dans: deploy-summary.txt${NC}"
