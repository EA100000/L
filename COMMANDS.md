# 🎯 Commandes Rapides

## Démarrage

### Démarrage Automatique
```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

### Démarrage Manuel

#### Backend seul
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m api.main
```

#### Frontend seul
```bash
cd frontend
npm run dev
```

## Tests

### Test Scraper Sofascore
```bash
cd backend
source venv/bin/activate
python -m scrapers.sofascore_scraper
```

### Test API avec curl

```bash
# Health check
curl http://localhost:8000/api/health

# Matchs en direct
curl http://localhost:8000/api/live-matches

# Stats d'un match
curl http://localhost:8000/api/match/12345/stats

# Analyse TES
curl "http://localhost:8000/api/match/12345/analysis?time_elapsed=60"
```

### Test WebSocket (Browser Console)
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/live-feed');
ws.onopen = () => console.log('✅ Connecté');
ws.onmessage = (e) => console.log('📨 Update:', JSON.parse(e.data));
ws.onerror = (e) => console.error('❌ Erreur:', e);
```

## Développement

### Backend

```bash
# Installer nouvelle dépendance
cd backend
source venv/bin/activate
pip install package_name
pip freeze > requirements.txt

# Lancer en mode debug
python -m api.main --reload

# Formater le code
black .
isort .
```

### Frontend

```bash
cd frontend

# Installer nouvelle dépendance
npm install package_name

# Build pour production
npm run build

# Preview du build
npm run preview

# Lint
npm run lint
```

## Maintenance

### Nettoyer les caches
```bash
# Backend
cd backend
rm -rf __pycache__ */__pycache__ */*/__pycache__
rm -rf .pytest_cache

# Frontend
cd frontend
rm -rf node_modules dist .vite
npm install
```

### Réinstaller tout
```bash
# Backend
cd backend
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Logs & Debug

### Voir les logs en temps réel

**Backend:**
```bash
# Dans le terminal du backend, les logs s'affichent directement
tail -f logs/backend.log  # Si logs activés
```

**Frontend:**
- Ouvrir Developer Tools (F12)
- Onglet Console
- Filtrer par "WebSocket" ou "Update"

### Debug Playwright

```bash
cd backend
source venv/bin/activate

# Lancer en mode headed (avec navigateur visible)
HEADLESS=false python -m scrapers.sofascore_scraper

# Ou modifier dans le code:
# scraper = SofascoreScraper(headless=False)
```

## Base de données (Optionnel)

Si vous ajoutez PostgreSQL:

```bash
# Créer la base
createdb football_ai

# Migrations avec Alembic
cd backend
alembic init alembic
alembic revision --autogenerate -m "Initial"
alembic upgrade head
```

## Production

### Build Frontend
```bash
cd frontend
npm run build
# Les fichiers sont dans dist/
```

### Servir en production
```bash
# Backend avec Gunicorn
cd backend
gunicorn -w 4 -k uvicorn.workers.UvicornWorker api.main:app

# Frontend avec serve
npm install -g serve
serve -s dist -l 5173
```

### Docker (À venir)
```bash
# Build
docker-compose build

# Run
docker-compose up

# Stop
docker-compose down
```

## Raccourcis Utiles

```bash
# Tout installer d'un coup
cd backend && pip install -r requirements.txt && playwright install chromium && cd ../frontend && npm install && cd ..

# Lancer les deux en même temps (Linux/Mac)
(cd backend && source venv/bin/activate && python -m api.main) & (cd frontend && npm run dev)

# Kill tous les processus Python et Node
pkill -f "python -m api.main"
pkill -f "vite"
```

## Variables d'environnement

Créer `.env` dans `backend/`:

```env
# Scraping
SCRAPE_INTERVAL=30
HEADLESS_BROWSER=true
MAX_CONCURRENT_MATCHES=10

# Alertes
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
DISCORD_WEBHOOK_URL=your_webhook
```

## URLs Importantes

- 🎨 **Frontend**: http://localhost:5173
- 🔌 **Backend API**: http://localhost:8000
- 📚 **API Docs (Swagger)**: http://localhost:8000/docs
- 📖 **API Docs (ReDoc)**: http://localhost:8000/redoc
- 🔄 **WebSocket**: ws://localhost:8000/ws/live-feed

## Problèmes Courants

### Port déjà utilisé
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Playwright ne fonctionne pas
```bash
playwright install chromium --force
```

### WebSocket ne se connecte pas
- Vérifier que le backend est bien lancé
- Vérifier dans la console browser pour les erreurs
- Essayer ws://127.0.0.1:8000/ws/live-feed

### Pas de matchs
- Vérifier qu'il y a des matchs en direct sur Sofascore
- Le scraper prend 30s-1min pour charger
- Regarder les logs du backend

---

💡 **Astuce**: Gardez ce fichier ouvert dans un onglet pendant le développement!
