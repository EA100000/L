"""
TES Engine - Moteur d'analyse avec les stratégies TES
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


class BetType(Enum):
    """Types de paris disponibles"""
    CORNER = "corner"
    CARD = "card"
    GOAL = "goal"
    BOTH_TEAMS_SCORE = "both_teams_score"


class Confidence(Enum):
    """Niveaux de confiance"""
    VERY_HIGH = "very_high"  # 80-100%
    HIGH = "high"            # 60-80%
    MEDIUM = "medium"        # 40-60%
    LOW = "low"              # 20-40%
    VERY_LOW = "very_low"    # 0-20%


@dataclass
class BetRecommendation:
    """Recommandation de pari"""
    bet_type: BetType
    description: str
    confidence: Confidence
    probability: float
    reasoning: List[str]
    current_stats: Dict
    threshold_reached: bool


class TESEngine:
    """
    Moteur d'analyse TES (The Expert System)
    Applique vos stratégies sur les stats en temps réel
    """

    def __init__(self):
        # Seuils configurables pour chaque stratégie
        self.thresholds = {
            'corner_high_activity': {
                'total_corners': 8,
                'time_min': 60,
                'confidence_base': 0.75
            },
            'card_aggressive_match': {
                'total_fouls': 20,
                'yellow_cards': 3,
                'time_min': 45,
                'confidence_base': 0.70
            },
            'goal_high_pressure': {
                'shots_on_target': 5,
                'dangerous_attacks': 40,
                'time_min': 55,
                'confidence_base': 0.65
            },
            'both_score_balanced': {
                'possession_diff_max': 15,
                'shots_min_each': 3,
                'time_min': 50,
                'confidence_base': 0.68
            }
        }

    def analyze_match(self, match_stats: Dict, time_elapsed: int) -> List[BetRecommendation]:
        """
        Analyse un match et retourne les recommandations de paris

        Args:
            match_stats: Stats du match (format de base_scraper)
            time_elapsed: Temps écoulé en minutes

        Returns:
            List[BetRecommendation]: Liste des paris recommandés
        """
        recommendations = []

        # Analyser chaque stratégie
        recommendations.extend(self._analyze_corners(match_stats, time_elapsed))
        recommendations.extend(self._analyze_cards(match_stats, time_elapsed))
        recommendations.extend(self._analyze_goals(match_stats, time_elapsed))
        recommendations.extend(self._analyze_both_teams_score(match_stats, time_elapsed))

        # Trier par confiance décroissante
        recommendations.sort(key=lambda x: x.probability, reverse=True)

        return recommendations

    def _analyze_corners(self, stats: Dict, time: int) -> List[BetRecommendation]:
        """Stratégie d'analyse des corners"""
        recommendations = []

        corners = stats.get('corners', {'home': 0, 'away': 0})
        total_corners = corners['home'] + corners['away']

        threshold = self.thresholds['corner_high_activity']

        # Stratégie 1: Corners haute activité
        if time >= threshold['time_min']:
            reasoning = []
            probability = threshold['confidence_base']

            # Vérifier le seuil de corners
            if total_corners >= threshold['total_corners']:
                reasoning.append(f"✅ {total_corners} corners déjà marqués (seuil: {threshold['total_corners']})")
                probability += 0.10
            else:
                reasoning.append(f"⏳ {total_corners}/{threshold['total_corners']} corners")
                probability -= 0.10

            # Vérifier la tendance (corners/10min)
            corners_per_10min = (total_corners / time) * 10
            if corners_per_10min >= 1.5:
                reasoning.append(f"📈 Rythme élevé: {corners_per_10min:.1f} corners/10min")
                probability += 0.08
            else:
                reasoning.append(f"📉 Rythme faible: {corners_per_10min:.1f} corners/10min")

            # Vérifier la possession offensive
            possession = stats.get('possession', {'home': 50, 'away': 50})
            attacks = stats.get('attacks', {'home': 0, 'away': 0})
            total_attacks = attacks['home'] + attacks['away']

            if total_attacks >= 80:
                reasoning.append(f"⚡ Match offensif: {total_attacks} attaques")
                probability += 0.07

            # Créer la recommandation si la probabilité est suffisante
            if probability >= 0.60:
                confidence = self._get_confidence_level(probability)

                recommendations.append(BetRecommendation(
                    bet_type=BetType.CORNER,
                    description=f"Prochains corners (9+)",
                    confidence=confidence,
                    probability=probability,
                    reasoning=reasoning,
                    current_stats={'corners': total_corners, 'time': time},
                    threshold_reached=total_corners >= threshold['total_corners']
                ))

        return recommendations

    def _analyze_cards(self, stats: Dict, time: int) -> List[BetRecommendation]:
        """Stratégie d'analyse des cartons"""
        recommendations = []

        yellow_cards = stats.get('yellow_cards', {'home': 0, 'away': 0})
        red_cards = stats.get('red_cards', {'home': 0, 'away': 0})
        fouls = stats.get('fouls', {'home': 0, 'away': 0})

        total_yellows = yellow_cards['home'] + yellow_cards['away']
        total_reds = red_cards['home'] + red_cards['away']
        total_fouls = fouls['home'] + fouls['away']

        threshold = self.thresholds['card_aggressive_match']

        if time >= threshold['time_min']:
            reasoning = []
            probability = threshold['confidence_base']

            # Vérifier les fautes
            if total_fouls >= threshold['total_fouls']:
                reasoning.append(f"✅ Match rugueux: {total_fouls} fautes (seuil: {threshold['total_fouls']})")
                probability += 0.12
            else:
                reasoning.append(f"⏳ {total_fouls}/{threshold['total_fouls']} fautes")

            # Vérifier les cartons déjà distribués
            if total_yellows >= threshold['yellow_cards']:
                reasoning.append(f"🟨 {total_yellows} cartons jaunes déjà distribués")
                probability += 0.10

            # Taux de fautes par 10min
            fouls_per_10min = (total_fouls / time) * 10
            if fouls_per_10min >= 4.0:
                reasoning.append(f"⚠️ Rythme agressif: {fouls_per_10min:.1f} fautes/10min")
                probability += 0.08

            if probability >= 0.55:
                confidence = self._get_confidence_level(probability)

                recommendations.append(BetRecommendation(
                    bet_type=BetType.CARD,
                    description=f"Prochain carton (jaune ou rouge)",
                    confidence=confidence,
                    probability=probability,
                    reasoning=reasoning,
                    current_stats={'yellows': total_yellows, 'reds': total_reds, 'fouls': total_fouls},
                    threshold_reached=total_fouls >= threshold['total_fouls']
                ))

        return recommendations

    def _analyze_goals(self, stats: Dict, time: int) -> List[BetRecommendation]:
        """Stratégie d'analyse des buts"""
        recommendations = []

        shots = stats.get('shots', {'home': 0, 'away': 0})
        shots_on_target = stats.get('shots_on_target', {'home': 0, 'away': 0})
        dangerous_attacks = stats.get('dangerous_attacks', {'home': 0, 'away': 0})

        total_shots = shots['home'] + shots['away']
        total_on_target = shots_on_target['home'] + shots_on_target['away']
        total_dangerous = dangerous_attacks['home'] + dangerous_attacks['away']

        threshold = self.thresholds['goal_high_pressure']

        if time >= threshold['time_min']:
            reasoning = []
            probability = threshold['confidence_base']

            # Vérifier les tirs cadrés
            if total_on_target >= threshold['shots_on_target']:
                reasoning.append(f"🎯 {total_on_target} tirs cadrés (seuil: {threshold['shots_on_target']})")
                probability += 0.13
            else:
                reasoning.append(f"⏳ {total_on_target}/{threshold['shots_on_target']} tirs cadrés")

            # Vérifier les attaques dangereuses
            if total_dangerous >= threshold['dangerous_attacks']:
                reasoning.append(f"⚡ {total_dangerous} attaques dangereuses (seuil: {threshold['dangerous_attacks']})")
                probability += 0.10

            # Efficacité des tirs (% cadrés)
            if total_shots > 0:
                accuracy = (total_on_target / total_shots) * 100
                if accuracy >= 40:
                    reasoning.append(f"📊 Bonne précision: {accuracy:.0f}% de tirs cadrés")
                    probability += 0.07

            if probability >= 0.60:
                confidence = self._get_confidence_level(probability)

                recommendations.append(BetRecommendation(
                    bet_type=BetType.GOAL,
                    description="Prochain but imminent",
                    confidence=confidence,
                    probability=probability,
                    reasoning=reasoning,
                    current_stats={'shots_on_target': total_on_target, 'dangerous_attacks': total_dangerous},
                    threshold_reached=total_on_target >= threshold['shots_on_target']
                ))

        return recommendations

    def _analyze_both_teams_score(self, stats: Dict, time: int) -> List[BetRecommendation]:
        """Stratégie Both Teams to Score"""
        recommendations = []

        shots = stats.get('shots', {'home': 0, 'away': 0})
        shots_on_target = stats.get('shots_on_target', {'home': 0, 'away': 0})
        possession = stats.get('possession', {'home': 50, 'away': 50})

        threshold = self.thresholds['both_score_balanced']

        if time >= threshold['time_min']:
            reasoning = []
            probability = threshold['confidence_base']

            # Vérifier l'équilibre de possession
            poss_diff = abs(possession['home'] - possession['away'])
            if poss_diff <= threshold['possession_diff_max']:
                reasoning.append(f"⚖️ Match équilibré: {possession['home']}% - {possession['away']}% possession")
                probability += 0.10

            # Vérifier que les deux équipes attaquent
            if (shots_on_target['home'] >= threshold['shots_min_each'] and
                shots_on_target['away'] >= threshold['shots_min_each']):
                reasoning.append(f"🎯 Les deux équipes attaquent: {shots_on_target['home']} et {shots_on_target['away']} tirs cadrés")
                probability += 0.12

            # Vérifier les tirs totaux
            if shots['home'] >= 5 and shots['away'] >= 5:
                reasoning.append(f"⚽ Match ouvert: {shots['home']} et {shots['away']} tirs")
                probability += 0.08

            if probability >= 0.65:
                confidence = self._get_confidence_level(probability)

                recommendations.append(BetRecommendation(
                    bet_type=BetType.BOTH_TEAMS_SCORE,
                    description="Les deux équipes marquent",
                    confidence=confidence,
                    probability=probability,
                    reasoning=reasoning,
                    current_stats={'possession_diff': poss_diff},
                    threshold_reached=True
                ))

        return recommendations

    def _get_confidence_level(self, probability: float) -> Confidence:
        """Convertir une probabilité en niveau de confiance"""
        if probability >= 0.80:
            return Confidence.VERY_HIGH
        elif probability >= 0.70:
            return Confidence.HIGH
        elif probability >= 0.60:
            return Confidence.MEDIUM
        elif probability >= 0.50:
            return Confidence.LOW
        else:
            return Confidence.VERY_LOW
