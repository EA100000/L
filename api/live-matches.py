"""
API Endpoint: GET /api/live-matches
Récupère les matchs en direct depuis Sofascore
"""

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
import urllib.request
import ssl


def get_live_matches():
    """Récupère les matchs en direct via l'API Sofascore"""
    try:
        # Créer un contexte SSL qui ne vérifie pas les certificats
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        url = "https://api.sofascore.com/api/v1/sport/football/events/live"

        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        req.add_header('Accept', 'application/json')

        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            data = json.loads(response.read().decode())

        matches = []
        events = data.get('events', [])

        for event in events[:20]:  # Limiter à 20 matchs
            home_team = event.get('homeTeam', {})
            away_team = event.get('awayTeam', {})
            home_score = event.get('homeScore', {})
            away_score = event.get('awayScore', {})
            status = event.get('status', {})

            match = {
                'id': str(event.get('id', '')),
                'homeTeam': home_team.get('name', 'Unknown'),
                'awayTeam': away_team.get('name', 'Unknown'),
                'score': f"{home_score.get('current', 0)}-{away_score.get('current', 0)}",
                'time': status.get('description', '0'),
                'status': 'live' if status.get('type') == 'inprogress' else status.get('type', 'unknown'),
                'league': event.get('tournament', {}).get('name', 'Unknown League')
            }
            matches.append(match)

        return matches
    except Exception as e:
        print(f"Erreur: {e}")
        return []


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

        matches = get_live_matches()

        response = {
            "success": True,
            "count": len(matches),
            "matches": matches,
            "timestamp": datetime.now().isoformat()
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
