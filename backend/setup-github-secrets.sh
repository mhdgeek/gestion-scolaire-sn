#!/bin/bash
echo "🔧 Assistant de Configuration GitHub Secrets"
echo "=========================================="

echo ""
echo "📋 Vous devez ajouter CES 5 SECRETS sur GitHub :"
echo ""

# 1. MONGODB_URI
echo "1. 🔗 MONGODB_URI"
echo "   Valeur : mongodb+srv://mhd:mohamed@cluster0.8dlnbfe.mongodb.net/gestion_scolaire?retryWrites=true&w=majority"
echo ""

# 2. AWS_ACCESS_KEY_ID
AWS_ACCESS_KEY=$(aws configure get aws_access_key_id 2>/dev/null || echo "NON_CONFIGURÉ")
echo "2. 🔑 AWS_ACCESS_KEY_ID"
echo "   Valeur : ${AWS_ACCESS_KEY}"
if [ "$AWS_ACCESS_KEY" = "NON_CONFIGURÉ" ]; then
  echo "   ⚠️  Configurez AWS CLI d'abord : aws configure"
fi
echo ""

# 3. AWS_SECRET_ACCESS_KEY
echo "3. 🔑 AWS_SECRET_ACCESS_KEY"
echo "   Valeur : [Votre Secret Access Key depuis AWS]"
echo "   📍 Trouvez-la : AWS IAM → Users → Security credentials"
echo ""

# 4. JWT_SECRET
JWT_SECRET=$(openssl rand -hex 64 2>/dev/null || echo "Générez avec: openssl rand -hex 64")
echo "4. 🎫 JWT_SECRET"
echo "   Valeur : ${JWT_SECRET}"
echo ""

# 5. EB_APPLICATION
echo "5. 🚀 EB_APPLICATION"
echo "   Valeur : gestion-scolaire"
echo ""

echo "📌 INSTRUCTIONS :"
echo "================"
echo "1. Ouvrez : https://github.com/mhdgeek/gestion-scolaire-sn/settings/secrets/actions"
echo ""
echo "2. Pour CHAQUE secret ci-dessus :"
echo "   • Cliquez 'New repository secret'"
echo "   • Copiez le NOM et la VALEUR"
echo "   • Cliquez 'Add secret'"
echo ""
echo "3. Vérifiez que vous avez 5 secrets :"
echo "   ✓ MONGODB_URI"
echo "   ✓ AWS_ACCESS_KEY_ID"
echo "   ✓ AWS_SECRET_ACCESS_KEY"
echo "   ✓ JWT_SECRET"
echo "   ✓ EB_APPLICATION"
echo ""
echo "✅ Une fois terminé, votre CI/CD fonctionnera automatiquement !"
