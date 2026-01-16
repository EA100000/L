"""
Sofascore Scraper - Extraction de données depuis Sofascore
"""

from typing import Dict, List
import json
from .base_scraper import BaseScraper


class SofascoreScraper(BaseScraper):
    """Scraper pour Sofascore.com"""

    BASE_URL = "https://www.sofascore.com"
    API_URL = "https://api.sofascore.com/api/v1"

    async def get_live_matches(self) -> List[Dict]:
        """Récupère tous les matchs de football en cours"""
        matches = []

        try:
            # Sofascore a une API publique qu'on peut utiliser
            await self.page.goto(f"{self.API_URL}/sport/football/events/live")
            await self.page.wait_for_load_state("networkidle")

            # Récupérer le JSON de la réponse
            content = await self.page.content()
            # Parser le JSON qui est dans une balise <pre>
            pre_element = await self.page.query_selector("pre")
            if pre_element:
                json_text = await pre_element.inner_text()
                data = json.loads(json_text)

                if "events" in data:
                    for event in data["events"]:
                        match = {
                            'id': str(event.get('id', '')),
                            'home_team': event.get('homeTeam', {}).get('name', ''),
                            'away_team': event.get('awayTeam', {}).get('name', ''),
                            'score': f"{event.get('homeScore', {}).get('current', 0)}-{event.get('awayScore', {}).get('current', 0)}",
                            'time': event.get('time', {}).get('currentPeriodStartTimestamp', ''),
                            'competition': event.get('tournament', {}).get('name', ''),
                            'status': event.get('status', {}).get('description', 'LIVE'),
                            'source': 'sofascore'
                        }
                        matches.append(match)

        except Exception as e:
            print(f"Erreur lors de la récupération des matchs live: {e}")

        return matches

    async def get_match_stats(self, match_id: str) -> Dict:
        """Récupère les statistiques détaillées d'un match"""
        stats = {
            'corners': {'home': 0, 'away': 0},
            'yellow_cards': {'home': 0, 'away': 0},
            'red_cards': {'home': 0, 'away': 0},
            'fouls': {'home': 0, 'away': 0},
            'shots': {'home': 0, 'away': 0},
            'shots_on_target': {'home': 0, 'away': 0},
            'possession': {'home': 0, 'away': 0},
            'offsides': {'home': 0, 'away': 0},
            'throw_ins': {'home': 0, 'away': 0},
            'dangerous_attacks': {'home': 0, 'away': 0},
            'attacks': {'home': 0, 'away': 0},
            'source': 'sofascore'
        }

        try:
            # API endpoint pour les stats
            await self.page.goto(f"{self.API_URL}/event/{match_id}/statistics")
            await self.page.wait_for_load_state("networkidle")

            pre_element = await self.page.query_selector("pre")
            if pre_element:
                json_text = await pre_element.inner_text()
                data = json.loads(json_text)

                if "statistics" in data:
                    for period_stats in data["statistics"]:
                        groups = period_stats.get("groups", [])

                        for group in groups:
                            stats_items = group.get("statisticsItems", [])

                            for item in stats_items:
                                stat_name = item.get("name", "").lower()
                                home_value = int(item.get("homeValue", 0) or 0)
                                away_value = int(item.get("awayValue", 0) or 0)

                                # Mapper les noms de stats
                                if "corner" in stat_name:
                                    stats['corners']['home'] += home_value
                                    stats['corners']['away'] += away_value

                                elif "yellow card" in stat_name:
                                    stats['yellow_cards']['home'] += home_value
                                    stats['yellow_cards']['away'] += away_value

                                elif "red card" in stat_name:
                                    stats['red_cards']['home'] += home_value
                                    stats['red_cards']['away'] += away_value

                                elif "foul" in stat_name:
                                    stats['fouls']['home'] += home_value
                                    stats['fouls']['away'] += away_value

                                elif "total shot" in stat_name or stat_name == "shots":
                                    stats['shots']['home'] += home_value
                                    stats['shots']['away'] += away_value

                                elif "on target" in stat_name:
                                    stats['shots_on_target']['home'] += home_value
                                    stats['shots_on_target']['away'] += away_value

                                elif "ball possession" in stat_name:
                                    stats['possession']['home'] = home_value
                                    stats['possession']['away'] = away_value

                                elif "offside" in stat_name:
                                    stats['offsides']['home'] += home_value
                                    stats['offsides']['away'] += away_value

                                elif "throw" in stat_name:
                                    stats['throw_ins']['home'] += home_value
                                    stats['throw_ins']['away'] += away_value

                                elif "dangerous attack" in stat_name:
                                    stats['dangerous_attacks']['home'] += home_value
                                    stats['dangerous_attacks']['away'] += away_value

                                elif "attack" in stat_name and "dangerous" not in stat_name:
                                    stats['attacks']['home'] += home_value
                                    stats['attacks']['away'] += away_value

        except Exception as e:
            print(f"Erreur lors de la récupération des stats du match {match_id}: {e}")

        return stats


# Test du scraper
async def test_sofascore():
    """Fonction de test"""
    async with SofascoreScraper(headless=False) as scraper:
        print("🔍 Récupération des matchs live...")
        matches = await scraper.get_live_matches()

        print(f"\n✅ {len(matches)} matchs trouvés\n")

        for match in matches[:5]:  # Afficher les 5 premiers
            print(f"⚽ {match['home_team']} vs {match['away_team']}")
            print(f"   Score: {match['score']}")
            print(f"   Competition: {match['competition']}")
            print(f"   ID: {match['id']}\n")

        # Tester les stats du premier match
        if matches:
            first_match = matches[0]
            print(f"\n📊 Stats pour {first_match['home_team']} vs {first_match['away_team']}...")
            stats = await scraper.get_match_stats(first_match['id'])

            print(f"\nCorners: {stats['corners']['home']} - {stats['corners']['away']}")
            print(f"Cartons jaunes: {stats['yellow_cards']['home']} - {stats['yellow_cards']['away']}")
            print(f"Fautes: {stats['fouls']['home']} - {stats['fouls']['away']}")
            print(f"Possession: {stats['possession']['home']}% - {stats['possession']['away']}%")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_sofascore())
