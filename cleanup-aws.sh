#!/bin/bash

# ============================================
# SCRIPT DE NETTOYAGE AWS - GESTION-SCOLAIRE
# ============================================
# Ce script supprime toutes les ressources AWS
# créées pour le projet gestion-scolaire.
# UTILISATION : ./cleanup-aws.sh
# ============================================

set -e # Arrête le script à la première erreur

# Variables du projet (À MODIFIER SI BESOIN)
PROJECT_NAME="gestion-scolaire"
AWS_REGION="us-east-1"
ECR_REPO="gestion-scolaire-backend"
EB_APP="gestion-scolaire"
CF_STACK="gestion-scolaire-network"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  NETTOYAGE AWS - $PROJECT_NAME  ${NC}"
echo -e "${BLUE}=================================${NC}"

# ==================== FONCTIONS ====================
confirm_action() {
    echo -e "${YELLOW}$1${NC}"
    read -p "Continuer? (oui/non): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
        echo -e "${RED}Annulé.${NC}"
        exit 1
    fi
}

check_resource_exists() {
    local cmd="$1"
    local resource="$2"
    if eval "$cmd" &>/dev/null; then
        return 0 # Existe
    else
        return 1 # N'existe pas
    fi
}

# ==================== ÉTAPE 1: ELASTIC BEANSTALK ====================
echo -e "\n${BLUE}[1/6] VÉRIFICATION ELASTIC BEANSTALK${NC}"

EB_ENV=""
if eb list --region $AWS_REGION &>/dev/null; then
    EB_ENV=$(eb list --region $AWS_REGION | grep -E "gestion-scolaire-|$PROJECT_NAME" | head -n1 | tr -d ' *')
fi

if [ -n "$EB_ENV" ]; then
    echo -e "Environnement EB trouvé: ${YELLOW}$EB_ENV${NC}"
    confirm_action "Cela va TERMINER l'environnement Elastic Beanstalk '$EB_ENV'"
    
    echo "Termination de l'environnement EB..."
    eb terminate $EB_ENV --force --region $AWS_REGION
    
    echo "Attente de la suppression (60s)..."
    sleep 60
    
    # Suppression de l'application si vide
    if [ "$(eb list --region $AWS_REGION | wc -l)" -eq 0 ]; then
        echo "Suppression de l'application EB..."
        aws elasticbeanstalk delete-application \
            --application-name $EB_APP \
            --terminate-env-by-force \
            --region $AWS_REGION 2>/dev/null || true
    fi
else
    echo -e "${GREEN}Aucun environnement EB trouvé.${NC}"
fi

# ==================== ÉTAPE 2: ECR (DOCKER REGISTRY) ====================
echo -e "\n${BLUE}[2/6] VÉRIFICATION ECR (DOCKER REGISTRY)${NC}"

if check_resource_exists "aws ecr describe-repositories --repository-names $ECR_REPO --region $AWS_REGION" "$ECR_REPO"; then
    echo -e "Repository ECR trouvé: ${YELLOW}$ECR_REPO${NC}"
    
    # Lister et supprimer toutes les images
    echo "Liste des images dans le repository..."
    IMAGES=$(aws ecr list-images --repository-name $ECR_REPO --region $AWS_REGION --query 'imageIds[*]' --output json 2>/dev/null || echo "[]")
    
    if [ "$IMAGES" != "[]" ]; then
        echo "Suppression des images Docker..."
        aws ecr batch-delete-image \
            --repository-name $ECR_REPO \
            --image-ids "$IMAGES" \
            --region $AWS_REGION 2>/dev/null || true
    fi
    
    confirm_action "Cela va SUPPRIMER le repository ECR '$ECR_REPO' et toutes ses images"
    
    echo "Suppression du repository ECR..."
    aws ecr delete-repository \
        --repository-name $ECR_REPO \
        --force \
        --region $AWS_REGION 2>/dev/null || true
else
    echo -e "${GREEN}Aucun repository ECR trouvé.${NC}"
fi

# ==================== ÉTAPE 3: CLOUDFORMATION ====================
echo -e "\n${BLUE}[3/6] VÉRIFICATION CLOUDFORMATION${NC}"

if check_resource_exists "aws cloudformation describe-stacks --stack-name $CF_STACK --region $AWS_REGION" "$CF_STACK"; then
    echo -e "Stack CloudFormation trouvée: ${YELLOW}$CF_STACK${NC}"
    confirm_action "Cela va SUPPRIMER la stack CloudFormation '$CF_STACK'"
    
    echo "Suppression de la stack CloudFormation..."
    aws cloudformation delete-stack \
        --stack-name $CF_STACK \
        --region $AWS_REGION
    
    echo "Attente de la suppression (30s)..."
    sleep 30
    
    # Supprimer aussi d'autres stacks liées au projet
    STACKS=$(aws cloudformation list-stacks --region $AWS_REGION --query "StackSummaries[?contains(StackName, '$PROJECT_NAME') && StackStatus!='DELETE_COMPLETE'].StackName" --output text)
    
    for stack in $STACKS; do
        echo "Suppression de la stack: $stack"
        aws cloudformation delete-stack --stack-name "$stack" --region $AWS_REGION 2>/dev/null || true
    done
else
    echo -e "${GREEN}Aucune stack CloudFormation trouvée.${NC}"
fi

# ==================== ÉTAPE 4: GROUPES DE SÉCURITÉ ====================
echo -e "\n${BLUE}[4/6] VÉRIFICATION GROUPES DE SÉCURITÉ${NC}"

# Trouver les groupes de sécurité créés par Elastic Beanstalk ou CloudFormation
SG_IDS=$(aws ec2 describe-security-groups --region $AWS_REGION \
    --query "SecurityGroups[?contains(GroupName, '$PROJECT_NAME') || contains(GroupName, 'awseb') || contains(Description, '$PROJECT_NAME')].GroupId" \
    --output text 2>/dev/null || echo "")

if [ -n "$SG_IDS" ]; then
    echo -e "Groupes de sécurité trouvés: ${YELLOW}$SG_IDS${NC}"
    
    # D'abord, retirer les règles de sécurité
    for sg_id in $SG_IDS; do
        echo "Nettoyage du groupe de sécurité: $sg_id"
        
        # Règles entrantes
        INGRESS=$(aws ec2 describe-security-groups --group-id $sg_id --region $AWS_REGION \
            --query "SecurityGroups[0].IpPermissions" --output json 2>/dev/null || echo "[]")
        
        if [ "$INGRESS" != "[]" ]; then
            aws ec2 revoke-security-group-ingress --group-id $sg_id --ip-permissions "$INGRESS" --region $AWS_REGION 2>/dev/null || true
        fi
        
        # Règles sortantes
        EGRESS=$(aws ec2 describe-security-groups --group-id $sg_id --region $AWS_REGION \
            --query "SecurityGroups[0].IpPermissionsEgress" --output json 2>/dev/null || echo "[]")
        
        if [ "$EGRESS" != "[]" ]; then
            aws ec2 revoke-security-group-egress --group-id $sg_id --ip-permissions "$EGRESS" --region $AWS_REGION 2>/dev/null || true
        fi
    done
    
    confirm_action "Cela va SUPPRIMER ces groupes de sécurité"
    
    # Attendre que les instances soient terminées
    echo "Attente avant suppression (15s)..."
    sleep 15
    
    # Supprimer les groupes
    for sg_id in $SG_IDS; do
        echo "Suppression du groupe de sécurité: $sg_id"
        aws ec2 delete-security-group --group-id $sg_id --region $AWS_REGION 2>/dev/null || true
    done
else
    echo -e "${GREEN}Aucun groupe de sécurité trouvé.${NC}"
fi

# ==================== ÉTAPE 5: LOGS CLOUDWATCH ====================
echo -e "\n${BLUE}[5/6] VÉRIFICATION LOGS CLOUDWATCH${NC}"

# Supprimer les groupes de logs liés au projet
LOG_GROUPS=$(aws logs describe-log-groups --region $AWS_REGION \
    --query "logGroups[?contains(logGroupName, '$PROJECT_NAME') || contains(logGroupName, '/aws/elasticbeanstalk/')].logGroupName" \
    --output text 2>/dev/null || echo "")

if [ -n "$LOG_GROUPS" ]; then
    echo "Groupes de logs CloudWatch trouvés"
    confirm_action "Cela va SUPPRIMER les logs CloudWatch du projet"
    
    for log_group in $LOG_GROUPS; do
        if [[ "$log_group" == *"$PROJECT_NAME"* ]] || [[ "$log_group" == *"/aws/elasticbeanstalk/"* ]]; then
            echo "Suppression du groupe de logs: $log_group"
            aws logs delete-log-group --log-group-name "$log_group" --region $AWS_REGION 2>/dev/null || true
        fi
    done
else
    echo -e "${GREEN}Aucun groupe de logs CloudWatch trouvé.${NC}"
fi

# ==================== ÉTAPE 6: VÉRIFICATION FINALE ====================
echo -e "\n${BLUE}[6/6] VÉRIFICATION FINALE${NC}"

echo "Vérification des ressources restantes..."
echo "----------------------------------------"

# Vérifier Elastic Beanstalk
echo -n "Elastic Beanstalk: "
if eb list --region $AWS_REGION 2>&1 | grep -q "$PROJECT_NAME"; then
    echo -e "${RED}RESSOURCES RESTANTES${NC}"
else
    echo -e "${GREEN}OK${NC}"
fi

# Vérifier ECR
echo -n "ECR Repository: "
if aws ecr describe-repositories --repository-names $ECR_REPO --region $AWS_REGION 2>&1 | grep -q "repositoryName"; then
    echo -e "${RED}RESSOURCES RESTANTES${NC}"
else
    echo -e "${GREEN}OK${NC}"
fi

# Vérifier CloudFormation
echo -n "CloudFormation: "
if aws cloudformation describe-stacks --stack-name $CF_STACK --region $AWS_REGION 2>&1 | grep -q "StackName"; then
    echo -e "${RED}RESSOURCES RESTANTES${NC}"
else
    echo -e "${GREEN}OK${NC}"
fi

# Vérifier le coût estimé (dernière heure)
echo -e "\n${BLUE}CONSEIL DE COÛT:${NC}"
echo "Vérifiez votre dashboard AWS Cost Explorer dans 24h"
echo "pour confirmer qu'aucun coût n'est généré."

echo -e "\n${GREEN}=================================${NC}"
echo -e "${GREEN}  NETTOYAGE TERMINÉ AVEC SUCCÈS  ${NC}"
echo -e "${GREEN}=================================${NC}"

# Message important pour MongoDB Atlas
echo -e "\n${YELLOW}⚠️  IMPORTANT:${NC}"
echo "Ce script n'a PAS supprimé votre base de données MongoDB Atlas."
echo "Pour éviter des coûts, allez sur https://cloud.mongodb.com et:"
echo "1. Allez dans votre cluster"
echo "2. Cliquez sur '...' → 'Terminate Cluster'"
echo "3. Confirmez la suppression"
