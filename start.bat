@echo off
REM Script de démarrage pour Football AI Agent (Windows)
REM Lance le backend Python et le frontend React

echo.
echo ========================================
echo    Football AI Agent - Demarrage
echo ========================================
echo.

REM Vérifier si Python est installé
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installe. Veuillez installer Python 3.8+
    pause
    exit /b 1
)

REM Vérifier si Node.js est installé
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe. Veuillez installer Node.js 18+
    pause
    exit /b 1
)

echo [1/4] Preparation du backend Python...
cd backend

REM Créer l'environnement virtuel s'il n'existe pas
if not exist "venv" (
    echo Création de l'environnement virtuel...
    python -m venv venv
)

REM Activer l'environnement virtuel
call venv\Scripts\activate.bat

REM Installer les dépendances si nécessaire
if not exist "venv\.installed" (
    echo Installation des dependances Python...
    pip install -q -r requirements.txt
    playwright install chromium
    echo. > venv\.installed
)

echo [2/4] Demarrage du backend FastAPI...
start "Football AI Backend" cmd /k "cd /d %CD% && venv\Scripts\activate.bat && python -m api.main"
timeout /t 3 /nobreak >nul

cd ..

echo [3/4] Preparation du frontend React...
cd frontend

REM Installer les dépendances npm si nécessaire
if not exist "node_modules" (
    echo Installation des dependances npm...
    call npm install
)

echo [4/4] Demarrage du frontend Vite...
start "Football AI Frontend" cmd /k "cd /d %CD% && npm run dev"

cd ..

echo.
echo ========================================
echo    Services demarres avec succes!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Fermez les fenetres pour arreter les services
echo.
pause
