# 🚀 Quick Start - Football AI Agent

## Installation Rapide (5 min)

### Prérequis
- Python 3.8+ installé
- Node.js 18+ installé
- Git (optionnel)

### Option 1: Script Automatique (Recommandé)

#### Windows:
```bash
# Double-cliquez sur start.bat
# OU depuis le terminal:
start.bat
```

#### Linux/Mac:
```bash
chmod +x start.sh
./start.sh
```

Le script va automatiquement:
1. ✅ Créer l'environnement virtuel Python
2. ✅ Installer toutes les dépendances backend
3. ✅ Installer Playwright et le navigateur Chromium
4. ✅ Démarrer le backend FastAPI sur le port 8000
5. ✅ Installer les dépendances npm du frontend
6. ✅ Démarrer le frontend React sur le port 5173

### Option 2: Installation Manuelle

#### 1. Backend (Python)

```bash
cd backend

# Créer environnement virtuel
python -m venv venv

# Activer l'environnement
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Installer dépendances
pip install -r requirements.txt

# Installer Playwright
playwright install chromium

# Lancer le backend
python -m api.main
```

Le backend sera disponible sur **http://localhost:8000**

#### 2. Frontend (React)

Dans un nouveau terminal:

```bash
cd frontend

# Installer dépendances
npm install

# Lancer le frontend
npm run dev
```

Le frontend sera disponible sur **http://localhost:5173**

## 🎯 Accès aux Services

Une fois démarré, vous pouvez accéder à:

- **Dashboard Frontend**: http://localhost:5173
- **API Backend**: http://localhost:8000
- **Documentation API**: http://localhost:8000/docs
- **API Alternative Docs**: http://localhost:8000/redoc

## 🧪 Test du Système

### 1. Test du Scraper Sofascore

```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m scrapers.sofascore_scraper
```

Ceci va:
- Se connecter à Sofascore
- Récupérer les matchs en direct
- Afficher les stats du premier match trouvé

### 2. Test de l'API

```bash
# Obtenir les matchs en direct
curl http://localhost:8000/api/live-matches

# Obtenir les stats d'un match spécifique
curl http://localhost:8000/api/match/12345/stats

# Obtenir l'analyse TES d'un match
curl http://localhost:8000/api/match/12345/analysis?time_elapsed=60
```

### 3. Test du WebSocket

Ouvrez la console du navigateur sur http://localhost:5173 et tapez:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/live-feed');
ws.onmessage = (event) => {
  console.log('Update:', JSON.parse(event.data));
};
```

Vous devriez recevoir des mises à jour toutes les 30 secondes.

## ⚙️ Configuration (Optionnel)

Créez un fichier `.env` dans le dossier `backend/` basé sur `.env.example`:

```bash
cd backend
cp .env.example .env
# Éditez .env avec vos configurations
```

Variables importantes:
- `SCRAPE_INTERVAL=30` - Intervalle de mise à jour en secondes
- `MAX_CONCURRENT_MATCHES=10` - Nombre max de matchs à analyser
- `HEADLESS_BROWSER=true` - Mode headless pour Playwright

## 🔔 Activer les Alertes (Optionnel)

### Telegram

1. Créez un bot avec [@BotFather](https://t.me/botfather)
2. Obtenez votre chat ID avec [@userinfobot](https://t.me/userinfobot)
3. Ajoutez dans `.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Discord

1. Créez un webhook dans votre serveur Discord
2. Ajoutez dans `.env`:
```env
DISCORD_WEBHOOK_URL=your_webhook_url
```

## 📊 Utilisation

1. **Ouvrez le dashboard** à http://localhost:5173
2. **Attendez** que les matchs en direct soient chargés
3. **Cliquez** sur un match pour voir les détails
4. **Observez** les recommandations TES en temps réel
5. Les alertes haute confiance (🔥 et ✅) s'affichent automatiquement

## 🎲 Comprendre les Stratégies TES

Le système analyse 4 types d'opportunités:

### 1. Corners - Forte Activité
- Prédit une forte activité de corners
- Seuil: ≥8 corners totaux après 55 min
- Confiance VERY_HIGH: ≥75%

### 2. Cartons
- Prédit un carton imminent
- Seuil: ≥20 fautes après 60 min
- Confiance VERY_HIGH: ≥75%

### 3. But Imminent
- Prédit un but dans les 10 prochaines minutes
- Seuil: ≥12 tirs après 50 min
- Confiance VERY_HIGH: ≥75%

### 4. Les Deux Équipes Marquent
- Prédit que chaque équipe marquera
- Seuil: Match équilibré après 40 min
- Confiance VERY_HIGH: ≥75%

## 🐛 Problèmes Courants

### Le backend ne démarre pas
```bash
# Vérifiez que Python est bien installé
python --version

# Réinstallez les dépendances
pip install --force-reinstall -r requirements.txt
```

### Erreur Playwright
```bash
# Réinstallez les navigateurs
playwright install chromium --force
```

### Le frontend ne démarre pas
```bash
# Supprimez node_modules et réinstallez
rm -rf node_modules package-lock.json
npm install
```

### Pas de matchs affichés
- Vérifiez qu'il y a bien des matchs en direct sur Sofascore
- Regardez les logs du backend pour voir les erreurs
- Le scraper met ~30 secondes à charger la première fois

### WebSocket ne se connecte pas
- Vérifiez que le backend est bien démarré
- Vérifiez qu'aucun firewall ne bloque le port 8000
- Regardez la console du navigateur pour les erreurs

## 📝 Notes Importantes

- **Première utilisation**: Le premier lancement peut prendre 2-3 minutes (installation de Chromium)
- **Matchs en direct**: Le système ne fonctionne que pendant les matchs en direct
- **Mises à jour**: Les données se mettent à jour automatiquement toutes les 30 secondes
- **Performance**: Limiter à 5-10 matchs simultanés pour de meilleures performances

## 🎯 Prochaines Étapes

1. ✅ Testez le système avec des matchs en direct
2. ⏳ Explorez les différentes recommandations TES
3. ⏳ Configurez les alertes Telegram/Discord
4. ⏳ Ajoutez d'autres scrapers (1xbet, BeSoccer, etc.)

## ⚠️ Avertissement

Ce système est destiné à des fins **éducatives et d'analyse sportive uniquement**.
- Vérifiez la légalité des paris dans votre juridiction
- Ne pariez que ce que vous pouvez perdre
- Utilisez ce système de manière responsable

## 💡 Support

Pour toute question ou problème:
- Consultez le [README.md](README.md) complet
- Vérifiez les logs du backend et frontend
- Testez les composants individuellement (scraper, API, WebSocket)

---

Bon match! ⚽🔥
