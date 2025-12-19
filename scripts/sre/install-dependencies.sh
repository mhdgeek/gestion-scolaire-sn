#!/bin/bash
# scripts/sre/install-dependencies.sh

echo "📦 Installation des dépendances SRE..."

# Backend dependencies
cd backend
npm install prom-client diskusage

# Outils CLI
echo "Installation des outils SRE..."
brew install k6 jq  # Sur macOS
# ou pour Linux: sudo apt-get install k6 jq

echo "✅ Dépendances SRE installées avec succès"
