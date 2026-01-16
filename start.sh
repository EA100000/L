#!/bin/bash

# Script de démarrage pour Football AI Agent
# Lance le backend Python et le frontend React en parallèle

echo "🚀 Démarrage de Football AI Agent..."
echo ""

# Vérifier si Python est installé
if ! command -v python &> /dev/null; then
    echo "❌ Python n'est pas installé. Veuillez installer Python 3.8+"
    exit 1
fi

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js 18+"
    exit 1
fi

# Fonction pour nettoyer les processus en arrière-plan à la sortie
cleanup() {
    echo ""
    echo "🛑 Arrêt des services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Démarrer le backend Python
echo "📡 Démarrage du backend Python (FastAPI)..."
cd backend

# Créer l'environnement virtuel s'il n'existe pas
if [ ! -d "venv" ]; then
    echo "Création de l'environnement virtuel Python..."
    python -m venv venv
fi

# Activer l'environnement virtuel
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

# Installer les dépendances si nécessaire
if [ ! -f "venv/.installed" ]; then
    echo "Installation des dépendances Python..."
    pip install -q -r requirements.txt
    playwright install chromium
    touch venv/.installed
fi

# Lancer le backend
python -m api.main &
BACKEND_PID=$!
echo "✅ Backend démarré (PID: $BACKEND_PID) - http://localhost:8000"

cd ..

# Attendre que le backend soit prêt
echo "⏳ Attente du backend..."
sleep 3

# Démarrer le frontend React
echo ""
echo "🎨 Démarrage du frontend React (Vite)..."
cd frontend

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "Installation des dépendances npm..."
    npm install
fi

# Lancer le frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend démarré (PID: $FRONTEND_PID) - http://localhost:5173"

cd ..

echo ""
echo "🎉 Football AI Agent est prêt!"
echo ""
echo "📍 Accès:"
echo "   - Frontend: http://localhost:5173"
echo "   - Backend API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter tous les services"
echo ""

# Attendre que les processus se terminent
wait
