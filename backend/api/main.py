"""
API FastAPI - Point d'entrée principal
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import asyncio
import json
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrapers.sofascore_scraper import SofascoreScraper
from strategies.tes_engine import TESEngine, BetRecommendation

app = FastAPI(
    title="Football AI Agent API",
    description="API d'analyse en temps réel de matchs de football",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifier les origins autorisées
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instances globales
tes_engine = TESEngine()
active_connections: List[WebSocket] = []


class ConnectionManager:
    """Gestionnaire de connexions WebSocket"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.get("/")
async def root():
    """Endpoint racine"""
    return {
        "message": "Football AI Agent API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    """Vérification de l'état de l'API"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_connections": len(manager.active_connections)
    }


@app.get("/api/live-matches")
async def get_live_matches():
    """Récupérer tous les matchs en cours"""
    try:
        async with SofascoreScraper(headless=True) as scraper:
            matches = await scraper.get_live_matches()
            return {
                "success": True,
                "count": len(matches),
                "matches": matches,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "matches": []
        }


@app.get("/api/match/{match_id}/stats")
async def get_match_stats(match_id: str):
    """Récupérer les stats d'un match spécifique"""
    try:
        async with SofascoreScraper(headless=True) as scraper:
            stats = await scraper.get_match_stats(match_id)
            return {
                "success": True,
                "match_id": match_id,
                "stats": stats,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "stats": None
        }


@app.get("/api/match/{match_id}/analysis")
async def get_match_analysis(match_id: str, time_elapsed: int = 60):
    """
    Analyser un match et obtenir les recommandations TES

    Args:
        match_id: ID du match
        time_elapsed: Temps écoulé en minutes
    """
    try:
        async with SofascoreScraper(headless=True) as scraper:
            stats = await scraper.get_match_stats(match_id)

            # Analyser avec TES Engine
            recommendations = tes_engine.analyze_match(stats, time_elapsed)

            # Convertir en dict pour le JSON
            recommendations_dict = [
                {
                    "bet_type": rec.bet_type.value,
                    "description": rec.description,
                    "confidence": rec.confidence.value,
                    "probability": round(rec.probability * 100, 1),
                    "reasoning": rec.reasoning,
                    "current_stats": rec.current_stats,
                    "threshold_reached": rec.threshold_reached
                }
                for rec in recommendations
            ]

            return {
                "success": True,
                "match_id": match_id,
                "time_elapsed": time_elapsed,
                "recommendations": recommendations_dict,
                "stats": stats,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "recommendations": []
        }


@app.websocket("/ws/live-feed")
async def websocket_live_feed(websocket: WebSocket):
    """
    WebSocket pour le flux en temps réel
    Envoie les mises à jour des matchs toutes les 30 secondes
    """
    await manager.connect(websocket)

    try:
        # Boucle de mise à jour en temps réel
        while True:
            try:
                # Récupérer les matchs live
                async with SofascoreScraper(headless=True) as scraper:
                    matches = await scraper.get_live_matches()

                    # Pour chaque match, obtenir les stats et l'analyse
                    for match in matches[:5]:  # Limiter à 5 matchs pour la démo
                        match_id = match['id']

                        # Récupérer les stats
                        stats = await scraper.get_match_stats(match_id)

                        # Analyser avec TES (supposons 60 min de jeu)
                        recommendations = tes_engine.analyze_match(stats, 60)

                        # Préparer le message
                        message = {
                            "type": "match_update",
                            "match": match,
                            "stats": stats,
                            "recommendations": [
                                {
                                    "bet_type": rec.bet_type.value,
                                    "description": rec.description,
                                    "confidence": rec.confidence.value,
                                    "probability": round(rec.probability * 100, 1),
                                    "reasoning": rec.reasoning
                                }
                                for rec in recommendations
                            ],
                            "timestamp": datetime.now().isoformat()
                        }

                        # Envoyer à tous les clients connectés
                        await manager.broadcast(message)

                # Attendre 30 secondes avant la prochaine mise à jour
                await asyncio.sleep(30)

            except Exception as e:
                print(f"Erreur dans la boucle WebSocket: {e}")
                await asyncio.sleep(5)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client déconnecté")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
