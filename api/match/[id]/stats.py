"""
API Endpoint: GET /api/match/[id]/stats
Récupère les statistiques d'un match spécifique
"""

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
import urllib.request
import ssl


def get_match_stats(match_id: str):
    """Récupère les stats d'un match via l'API Sofascore"""
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        url = f"https://api.sofascore.com/api/v1/event/{match_id}/statistics"

        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        req.add_header('Accept', 'application/json')

        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            data = json.loads(response.read().decode())

        stats = {
            'corners': {'home': 0, 'away': 0},
            'shots': {'home': 0, 'away': 0},
            'shotsOnTarget': {'home': 0, 'away': 0},
            'possession': {'home': 50, 'away': 50},
            'fouls': {'home': 0, 'away': 0},
            'cards': {'yellow': 0, 'red': 0}
        }

        # Parser les statistiques
        statistics = data.get('statistics', [])
        for period in statistics:
            groups = period.get('groups', [])
            for group in groups:
                items = group.get('statisticsItems', [])
                for item in items:
                    name = item.get('name', '').lower()
                    home_val = item.get('home', '0')
                    away_val = item.get('away', '0')

                    # Convertir en int si possible
                    try:
                        home_int = int(str(home_val).replace('%', ''))
                        away_int = int(str(away_val).replace('%', ''))
                    except:
                        home_int = 0
                        away_int = 0

                    if 'corner' in name:
                        stats['corners'] = {'home': home_int, 'away': away_int}
                    elif name == 'total shots' or name == 'shots':
                        stats['shots'] = {'home': home_int, 'away': away_int}
                    elif 'shots on target' in name:
                        stats['shotsOnTarget'] = {'home': home_int, 'away': away_int}
                    elif 'possession' in name:
                        stats['possession'] = {'home': home_int, 'away': away_int}
                    elif 'foul' in name:
                        stats['fouls'] = {'home': home_int, 'away': away_int}
                    elif 'yellow' in name:
                        stats['cards']['yellow'] = home_int + away_int
                    elif 'red' in name:
                        stats['cards']['red'] = home_int + away_int

        return stats
    except Exception as e:
        print(f"Erreur stats: {e}")
        return {
            'corners': {'home': 0, 'away': 0},
            'shots': {'home': 0, 'away': 0},
            'shotsOnTarget': {'home': 0, 'away': 0},
            'possession': {'home': 50, 'away': 50},
            'fouls': {'home': 0, 'away': 0},
            'cards': {'yellow': 0, 'red': 0}
        }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Extraire l'ID du match depuis l'URL
        path_parts = self.path.split('/')
        match_id = None
        for i, part in enumerate(path_parts):
            if part == 'match' and i + 1 < len(path_parts):
                match_id = path_parts[i + 1]
                break

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        if match_id:
            stats = get_match_stats(match_id)
            response = {
                "success": True,
                "match_id": match_id,
                "stats": stats,
                "timestamp": datetime.now().isoformat()
            }
        else:
            response = {
                "success": False,
                "error": "Match ID required",
                "stats": None
            }

        self.wfile.write(json.dumps(response).encode())
        return

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        return
