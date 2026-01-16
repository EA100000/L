"""
API Endpoint: GET /api/match/[id]/analysis
Analyse TES d'un match et retourne les recommandations
"""

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
import urllib.request
import urllib.parse
import ssl
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Optional


class BetType(Enum):
    CORNER_HIGH_ACTIVITY = "CORNER_HIGH_ACTIVITY"
    CARD_PREDICTION = "CARD_PREDICTION"
    GOAL_IMMINENT = "GOAL_IMMINENT"
    BOTH_TEAMS_SCORE = "BOTH_TEAMS_SCORE"


class Confidence(Enum):
    VERY_HIGH = "VERY_HIGH"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    VERY_LOW = "VERY_LOW"


@dataclass
class BetRecommendation:
    bet_type: BetType
    description: str
    confidence: Confidence
    probability: float
    reasoning: List[str] = field(default_factory=list)
    current_stats: Dict = field(default_factory=dict)
    threshold_reached: bool = False


def get_confidence(probability: float) -> Confidence:
    if probability >= 0.75:
        return Confidence.VERY_HIGH
    elif probability >= 0.65:
        return Confidence.HIGH
    elif probability >= 0.55:
        return Confidence.MEDIUM
    elif probability >= 0.45:
        return Confidence.LOW
    else:
        return Confidence.VERY_LOW


def analyze_corners(stats: Dict, time: int) -> Optional[BetRecommendation]:
    """Analyse stratégie corners"""
    if time < 55:
        return None

    corners = stats.get('corners', {'home': 0, 'away': 0})
    total_corners = corners['home'] + corners['away']

    probability = 0.62
    reasoning = []

    if total_corners >= 8:
        reasoning.append(f"✅ {total_corners} corners déjà marqués")
        probability += 0.10

    corners_per_10min = (total_corners / time) * 10 if time > 0 else 0
    if corners_per_10min >= 1.5:
        reasoning.append(f"✅ Rythme de {corners_per_10min:.1f} corners/10min")
        probability += 0.08

    shots = stats.get('shots', {'home': 0, 'away': 0})
    total_shots = shots['home'] + shots['away']
    if total_shots >= 15:
        reasoning.append(f"✅ Pression offensive élevée ({total_shots} tirs)")
        probability += 0.08

    if len(reasoning) == 0:
        return None

    return BetRecommendation(
        bet_type=BetType.CORNER_HIGH_ACTIVITY,
        description="Plus de 2.5 corners sur les 10 prochaines minutes",
        confidence=get_confidence(probability),
        probability=min(probability, 0.88),
        reasoning=reasoning,
        current_stats={'total_corners': total_corners, 'rhythm': round(corners_per_10min, 2)},
        threshold_reached=total_corners >= 8
    )


def analyze_cards(stats: Dict, time: int) -> Optional[BetRecommendation]:
    """Analyse stratégie cartons"""
    if time < 60:
        return None

    fouls = stats.get('fouls', {'home': 0, 'away': 0})
    total_fouls = fouls['home'] + fouls['away']
    cards = stats.get('cards', {'yellow': 0, 'red': 0})
    total_cards = cards['yellow'] + cards['red']

    probability = 0.58
    reasoning = []

    if total_fouls >= 20:
        reasoning.append(f"✅ {total_fouls} fautes commises")
        probability += 0.10

    fouls_per_10min = (total_fouls / time) * 10 if time > 0 else 0
    if fouls_per_10min >= 3:
        reasoning.append(f"✅ Rythme de {fouls_per_10min:.1f} fautes/10min")
        probability += 0.08

    if total_cards >= 2:
        reasoning.append(f"✅ Déjà {total_cards} cartons dans le match")
        probability += 0.09

    if len(reasoning) == 0:
        return None

    return BetRecommendation(
        bet_type=BetType.CARD_PREDICTION,
        description="Carton probable dans les 10 prochaines minutes",
        confidence=get_confidence(probability),
        probability=min(probability, 0.85),
        reasoning=reasoning,
        current_stats={'total_fouls': total_fouls, 'total_cards': total_cards},
        threshold_reached=total_fouls >= 20
    )


def analyze_goals(stats: Dict, time: int) -> Optional[BetRecommendation]:
    """Analyse stratégie but imminent"""
    if time < 50:
        return None

    shots = stats.get('shots', {'home': 0, 'away': 0})
    total_shots = shots['home'] + shots['away']
    shots_on_target = stats.get('shotsOnTarget', {'home': 0, 'away': 0})
    total_on_target = shots_on_target['home'] + shots_on_target['away']

    probability = 0.55
    reasoning = []

    if total_shots >= 12:
        reasoning.append(f"✅ {total_shots} tirs tentés")
        probability += 0.08

    if total_on_target >= 5:
        reasoning.append(f"✅ {total_on_target} tirs cadrés")
        probability += 0.10

    possession = stats.get('possession', {'home': 50, 'away': 50})
    if max(possession['home'], possession['away']) >= 55:
        dominant = 'Domicile' if possession['home'] > possession['away'] else 'Extérieur'
        reasoning.append(f"✅ {dominant} domine la possession ({max(possession['home'], possession['away'])}%)")
        probability += 0.07

    if len(reasoning) == 0:
        return None

    return BetRecommendation(
        bet_type=BetType.GOAL_IMMINENT,
        description="But probable dans les 10 prochaines minutes",
        confidence=get_confidence(probability),
        probability=min(probability, 0.82),
        reasoning=reasoning,
        current_stats={'shots': total_shots, 'on_target': total_on_target},
        threshold_reached=total_on_target >= 5
    )


def analyze_btts(stats: Dict, time: int) -> Optional[BetRecommendation]:
    """Analyse stratégie Both Teams Score"""
    if time < 40:
        return None

    shots_on_target = stats.get('shotsOnTarget', {'home': 0, 'away': 0})
    possession = stats.get('possession', {'home': 50, 'away': 50})

    probability = 0.52
    reasoning = []

    if shots_on_target['home'] >= 3 and shots_on_target['away'] >= 3:
        reasoning.append(f"✅ Les 2 équipes cadrent ({shots_on_target['home']} vs {shots_on_target['away']})")
        probability += 0.12

    poss_diff = abs(possession['home'] - possession['away'])
    if poss_diff < 15:
        reasoning.append(f"✅ Match équilibré (diff possession: {poss_diff}%)")
        probability += 0.08

    shots = stats.get('shots', {'home': 0, 'away': 0})
    if shots['home'] >= 5 and shots['away'] >= 5:
        reasoning.append(f"✅ Les 2 équipes tirent ({shots['home']} vs {shots['away']})")
        probability += 0.06

    if len(reasoning) == 0:
        return None

    return BetRecommendation(
        bet_type=BetType.BOTH_TEAMS_SCORE,
        description="Les deux équipes vont marquer",
        confidence=get_confidence(probability),
        probability=min(probability, 0.78),
        reasoning=reasoning,
        current_stats={'home_shots_on_target': shots_on_target['home'], 'away_shots_on_target': shots_on_target['away']},
        threshold_reached=shots_on_target['home'] >= 3 and shots_on_target['away'] >= 3
    )


def analyze_match(stats: Dict, time_elapsed: int) -> List[BetRecommendation]:
    """Analyse complète du match"""
    recommendations = []

    analyzers = [analyze_corners, analyze_cards, analyze_goals, analyze_btts]

    for analyzer in analyzers:
        rec = analyzer(stats, time_elapsed)
        if rec:
            recommendations.append(rec)

    # Trier par probabilité décroissante
    recommendations.sort(key=lambda x: x.probability, reverse=True)
    return recommendations


def get_match_stats(match_id: str) -> Dict:
    """Récupère les stats d'un match"""
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        url = f"https://api.sofascore.com/api/v1/event/{match_id}/statistics"

        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

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

        statistics = data.get('statistics', [])
        for period in statistics:
            groups = period.get('groups', [])
            for group in groups:
                items = group.get('statisticsItems', [])
                for item in items:
                    name = item.get('name', '').lower()
                    try:
                        home_int = int(str(item.get('home', '0')).replace('%', ''))
                        away_int = int(str(item.get('away', '0')).replace('%', ''))
                    except:
                        continue

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
        # Extraire l'ID du match et les paramètres
        path_parts = self.path.split('?')[0].split('/')
        match_id = None
        for i, part in enumerate(path_parts):
            if part == 'match' and i + 1 < len(path_parts):
                match_id = path_parts[i + 1]
                break

        # Parser les query params
        query_string = self.path.split('?')[1] if '?' in self.path else ''
        params = urllib.parse.parse_qs(query_string)
        time_elapsed = int(params.get('time_elapsed', ['60'])[0])

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        if match_id:
            stats = get_match_stats(match_id)
            recommendations = analyze_match(stats, time_elapsed)

            response = {
                "success": True,
                "match_id": match_id,
                "time_elapsed": time_elapsed,
                "recommendations": [
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
                ],
                "stats": stats,
                "timestamp": datetime.now().isoformat()
            }
        else:
            response = {
                "success": False,
                "error": "Match ID required",
                "recommendations": []
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
