"""
API Serverless - Vercel Entry Point
"""

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = {
            "message": "Football AI Agent API",
            "version": "1.0.0",
            "status": "running",
            "timestamp": datetime.now().isoformat(),
            "endpoints": {
                "live_matches": "/api/live-matches",
                "match_stats": "/api/match/[id]/stats",
                "match_analysis": "/api/match/[id]/analysis"
            }
        }

        self.wfile.write(json.dumps(response).encode())
        return
