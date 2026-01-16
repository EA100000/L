# Football AI Agent - Système d'Analyse Temps Réel

Système intelligent d'analyse de matchs de football en temps réel avec stratégies TES (The Expert System).

## 🎯 Fonctionnalités

- 🔍 **Scraping multi-sites** - Sofascore, 1xbet, BeSoccer, WhoScored
- ⚡ **Détection matchs LIVE** - Détection automatique en temps réel
- 📊 **Extraction stats complètes** - Corners, fautes, cartons, touches, tirs
- 🤖 **Moteur TES** - Application automatique de 4 stratégies expertes
- 📈 **Dashboard temps réel** - WebSocket avec mise à jour toutes les 30s
- 🚨 **Alertes intelligentes** - Notifications paris haute probabilité

## 🏗️ Architecture

```
football-ai-agent/
├── backend/
│   ├── api/
│   │   └── main.py              # FastAPI + WebSocket
│   ├── scrapers/
│   │   ├── base_scraper.py      # Classe abstraite
│   │   ├── sofascore_scraper.py # Implémentation Sofascore
│   │   ├── onebet_scraper.py    # TODO
│   │   └── besoccer_scraper.py  # TODO
│   ├── strategies/
│   │   └── tes_engine.py        # Moteur TES
│   ├── models/
│   │   └── database.py          # SQLAlchemy models
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── LiveMatchCard.tsx
    │   │   ├── StatsPanel.tsx
    │   │   └── AlertsPanel.tsx
    │   └── hooks/
    │       └── useWebSocket.ts
    └── package.json
```

## 🚀 Démarrage Rapide

### Option 1: Script Automatique (Recommandé)

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

Le script lance automatiquement:
- ✅ Backend FastAPI sur http://localhost:8000
- ✅ Frontend React sur http://localhost:5173
- ✅ Installation de toutes les dépendances

### Option 2: Installation Manuelle

**Backend (Python):**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
python -m api.main
```

**Frontend (React):**
```bash
cd frontend
npm install
npm run dev
```

**Pour plus de détails, consultez [QUICKSTART.md](QUICKSTART.md)**

## 📡 API Endpoints

### REST Endpoints

**GET `/api/live-matches`**
```json
{
  "success": true,
  "count": 5,
  "matches": [
    {
      "id": "12345",
      "homeTeam": "PSG",
      "awayTeam": "Marseille",
      "score": "2-1",
      "time": 67,
      "status": "live"
    }
  ]
}
```

**GET `/api/match/{match_id}/stats`**
```json
{
  "success": true,
  "stats": {
    "corners": {"home": 8, "away": 5},
    "cards": {"yellow": 3, "red": 0},
    "shots": {"home": 15, "away": 9},
    "possession": {"home": 58, "away": 42}
  }
}
```

**GET `/api/match/{match_id}/analysis?time_elapsed=60`**
```json
{
  "success": true,
  "recommendations": [
    {
      "bet_type": "CORNER_HIGH_ACTIVITY",
      "description": "Plus de 2.5 corners sur les 10 prochaines minutes",
      "confidence": "VERY_HIGH",
      "probability": 78.5,
      "reasoning": [
        "✅ 13 corners déjà marqués",
        "✅ Rythme de 1.95 corners/10min",
        "✅ Pression offensive élevée"
      ]
    }
  ]
}
```

### WebSocket

**Endpoint**: `ws://localhost:8000/ws/live-feed`

Reçoit des mises à jour toutes les 30 secondes:
```json
{
  "type": "match_update",
  "match": {...},
  "stats": {...},
  "recommendations": [...],
  "timestamp": "2025-01-15T14:30:00"
}
```

## 🎲 Stratégies TES

### 1. Corner High Activity
**But**: Prédire forte activité de corners

**Seuils**:
- Temps minimum: 55 min
- Total corners: ≥ 8
- Rythme: ≥ 1.5 corners/10min
- Pression offensive: ≥ 60%

**Probabilité**: Base 0.62 + bonus jusqu'à 0.88

### 2. Card Prediction
**But**: Prédire carton(s) imminent(s)

**Seuils**:
- Temps minimum: 60 min
- Fautes: ≥ 20
- Rythme fautes: ≥ 3/10min
- Cartons déjà: ≥ 2

**Probabilité**: Base 0.58 + bonus jusqu'à 0.85

### 3. Goal Imminent
**But**: Prédire but dans les 10 prochaines minutes

**Seuils**:
- Temps minimum: 50 min
- Tirs: ≥ 12
- Tirs cadrés: ≥ 5
- Possession dominante: ≥ 55%

**Probabilité**: Base 0.55 + bonus jusqu'à 0.82

### 4. Both Teams Score
**But**: Prédire but de chaque équipe

**Seuils**:
- Temps minimum: 40 min
- Tirs équilibrés: ratio < 1.5
- Tirs cadrés chaque équipe: ≥ 3
- Match ouvert: différence possession < 15%

**Probabilité**: Base 0.52 + bonus jusqu'à 0.78

## 📊 Niveaux de Confiance

| Niveau | Probabilité | Description |
|--------|-------------|-------------|
| 🔥 VERY_HIGH | ≥ 75% | Signal très fort, action recommandée |
| ✅ HIGH | 65-74% | Signal fort, bon potentiel |
| ⚠️ MEDIUM | 55-64% | Signal modéré, à surveiller |
| 🔍 LOW | 45-54% | Signal faible, attendre confirmation |
| ❌ VERY_LOW | < 45% | Signal très faible, éviter |

## 🧪 Test du Système

### Test Scraper Sofascore

```bash
cd backend
python -m scrapers.sofascore_scraper
```

### Test API

```bash
# Lancer l'API
python -m api.main

# Dans un autre terminal
curl http://localhost:8000/api/live-matches
curl http://localhost:8000/api/match/12345/analysis?time_elapsed=65
```

### Test WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/live-feed');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Match update:', data);
};
```

## ⚙️ Configuration

Créer un fichier `.env` dans `backend/`:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost/football_ai
REDIS_URL=redis://localhost:6379

# Scraping
SCRAPE_INTERVAL=30
MAX_CONCURRENT_MATCHES=10
HEADLESS_BROWSER=true

# Alerts
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
ALERT_MIN_CONFIDENCE=HIGH
```

## 🔔 Système d'Alertes

Le système peut envoyer des alertes via:
- Telegram Bot
- Discord Webhook
- Email (SendGrid)
- Notification navigateur (WebSocket)

Exemple configuration Telegram:
```python
from telegram import Bot

bot = Bot(token=TELEGRAM_BOT_TOKEN)

async def send_alert(recommendation):
    if recommendation.confidence in ['VERY_HIGH', 'HIGH']:
        message = f"""
🚨 ALERTE PARIS FOOTBALL

{recommendation.description}
📊 Probabilité: {recommendation.probability}%
🎯 Confiance: {recommendation.confidence}

Raisons:
{chr(10).join(recommendation.reasoning)}
        """
        await bot.send_message(chat_id=CHAT_ID, text=message)
```

## 📈 Roadmap

### Phase 1: MVP ✅ COMPLET
- [x] Scraper Sofascore avec Playwright
- [x] Moteur TES avec 4 stratégies
- [x] API REST complète
- [x] WebSocket temps réel
- [x] Dashboard React avec composants temps réel
- [x] Hook WebSocket custom
- [x] Scripts de démarrage automatique

### Phase 2: Expansion
- [ ] Scrapers 1xbet, BeSoccer, WhoScored
- [ ] Base de données historique
- [ ] Machine Learning predictions
- [ ] Backtest stratégies

### Phase 3: Production
- [ ] Système d'alertes complet
- [ ] Authentification utilisateurs
- [ ] Gestion bankroll
- [ ] Tracking ROI

## ⚠️ Avertissement Légal

Ce système est destiné à des fins **éducatives et d'analyse sportive uniquement**.

- Vérifiez la légalité des paris sportifs dans votre juridiction
- Ne pariez que ce que vous pouvez vous permettre de perdre
- Les performances passées ne garantissent pas les résultats futurs
- Utilisez ce système de manière responsable

## 📝 Licence

MIT License - Voir [LICENSE](LICENSE) pour plus de détails.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
