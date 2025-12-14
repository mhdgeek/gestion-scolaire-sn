#!/bin/bash
echo "👤 Création d'un administrateur..."
curl -X POST http://localhost:5000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Admin",
    "prenom": "System",
    "email": "admin@ecole.sn",
    "password": "admin123"
  }'
echo ""
echo "✅ Admin créé: email: admin@ecole.sn, mot de passe: admin123"
