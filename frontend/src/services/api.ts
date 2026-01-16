import { Match, MatchStats, BetRecommendation } from '../types';

const SOFASCORE_API = 'https://api.sofascore.com/api/v1';

// Proxy CORS - utiliser un proxy en production si nécessaire
const fetchWithProxy = async (url: string) => {
  try {
    // Essayer directement d'abord
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });
    return response;
  } catch {
    // Si CORS bloque, utiliser un proxy public
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetch(proxyUrl);
  }
};

export const fetchLiveMatches = async (): Promise<Match[]> => {
  try {
    const response = await fetchWithProxy(`${SOFASCORE_API}/sport/football/events/live`);
    const data = await response.json();

    const matches: Match[] = (data.events || []).slice(0, 20).map((event: any) => ({
      id: String(event.id),
      homeTeam: event.homeTeam?.name || 'Unknown',
      awayTeam: event.awayTeam?.name || 'Unknown',
      score: `${event.homeScore?.current || 0}-${event.awayScore?.current || 0}`,
      time: event.status?.description || '0',
      status: event.status?.type === 'inprogress' ? 'live' : event.status?.type || 'unknown',
      league: event.tournament?.name || 'Unknown League'
    }));

    return matches;
  } catch (error) {
    console.error('Erreur fetch matchs:', error);
    return [];
  }
};

export const fetchMatchStats = async (matchId: string): Promise<MatchStats> => {
  const defaultStats: MatchStats = {
    corners: { home: 0, away: 0 },
    shots: { home: 0, away: 0 },
    shotsOnTarget: { home: 0, away: 0 },
    possession: { home: 50, away: 50 },
    fouls: { home: 0, away: 0 },
    cards: { yellow: 0, red: 0 }
  };

  try {
    const response = await fetchWithProxy(`${SOFASCORE_API}/event/${matchId}/statistics`);
    const data = await response.json();

    const stats = { ...defaultStats };
    const statistics = data.statistics || [];

    for (const period of statistics) {
      const groups = period.groups || [];
      for (const group of groups) {
        const items = group.statisticsItems || [];
        for (const item of items) {
          const name = (item.name || '').toLowerCase();
          const homeVal = parseInt(String(item.home || '0').replace('%', '')) || 0;
          const awayVal = parseInt(String(item.away || '0').replace('%', '')) || 0;

          if (name.includes('corner')) {
            stats.corners = { home: homeVal, away: awayVal };
          } else if (name === 'total shots' || name === 'shots') {
            stats.shots = { home: homeVal, away: awayVal };
          } else if (name.includes('shots on target')) {
            stats.shotsOnTarget = { home: homeVal, away: awayVal };
          } else if (name.includes('possession')) {
            stats.possession = { home: homeVal, away: awayVal };
          } else if (name.includes('foul')) {
            stats.fouls = { home: homeVal, away: awayVal };
          } else if (name.includes('yellow')) {
            stats.cards.yellow = homeVal + awayVal;
          } else if (name.includes('red')) {
            stats.cards.red = homeVal + awayVal;
          }
        }
      }
    }

    return stats;
  } catch (error) {
    console.error('Erreur fetch stats:', error);
    return defaultStats;
  }
};

// TES Analysis Engine (client-side)
type Confidence = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

const getConfidence = (probability: number): Confidence => {
  if (probability >= 0.75) return 'VERY_HIGH';
  if (probability >= 0.65) return 'HIGH';
  if (probability >= 0.55) return 'MEDIUM';
  if (probability >= 0.45) return 'LOW';
  return 'VERY_LOW';
};

export const analyzeMatch = (stats: MatchStats, timeElapsed: number = 60): BetRecommendation[] => {
  const recommendations: BetRecommendation[] = [];

  // Analyze Corners
  if (timeElapsed >= 55) {
    const totalCorners = stats.corners.home + stats.corners.away;
    let probability = 0.62;
    const reasoning: string[] = [];

    if (totalCorners >= 8) {
      reasoning.push(`✅ ${totalCorners} corners déjà marqués`);
      probability += 0.10;
    }

    const cornersPerMin = totalCorners / timeElapsed * 10;
    if (cornersPerMin >= 1.5) {
      reasoning.push(`✅ Rythme de ${cornersPerMin.toFixed(1)} corners/10min`);
      probability += 0.08;
    }

    const totalShots = stats.shots.home + stats.shots.away;
    if (totalShots >= 15) {
      reasoning.push(`✅ Pression offensive (${totalShots} tirs)`);
      probability += 0.08;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'CORNER_HIGH_ACTIVITY',
        description: 'Plus de corners dans les 10 prochaines minutes',
        confidence: getConfidence(Math.min(probability, 0.88)),
        probability: Math.round(Math.min(probability, 0.88) * 100),
        reasoning,
        threshold_reached: totalCorners >= 8
      });
    }
  }

  // Analyze Cards
  if (timeElapsed >= 60) {
    const totalFouls = stats.fouls.home + stats.fouls.away;
    const totalCards = stats.cards.yellow + stats.cards.red;
    let probability = 0.58;
    const reasoning: string[] = [];

    if (totalFouls >= 20) {
      reasoning.push(`✅ ${totalFouls} fautes commises`);
      probability += 0.10;
    }

    if (totalCards >= 2) {
      reasoning.push(`✅ ${totalCards} cartons déjà distribués`);
      probability += 0.09;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'CARD_PREDICTION',
        description: 'Carton probable dans les 10 prochaines minutes',
        confidence: getConfidence(Math.min(probability, 0.85)),
        probability: Math.round(Math.min(probability, 0.85) * 100),
        reasoning,
        threshold_reached: totalFouls >= 20
      });
    }
  }

  // Analyze Goals
  if (timeElapsed >= 50) {
    const totalShots = stats.shots.home + stats.shots.away;
    const totalOnTarget = stats.shotsOnTarget.home + stats.shotsOnTarget.away;
    let probability = 0.55;
    const reasoning: string[] = [];

    if (totalShots >= 12) {
      reasoning.push(`✅ ${totalShots} tirs tentés`);
      probability += 0.08;
    }

    if (totalOnTarget >= 5) {
      reasoning.push(`✅ ${totalOnTarget} tirs cadrés`);
      probability += 0.10;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'GOAL_IMMINENT',
        description: 'But probable dans les 10 prochaines minutes',
        confidence: getConfidence(Math.min(probability, 0.82)),
        probability: Math.round(Math.min(probability, 0.82) * 100),
        reasoning,
        threshold_reached: totalOnTarget >= 5
      });
    }
  }

  // Analyze BTTS
  if (timeElapsed >= 40) {
    const homeOnTarget = stats.shotsOnTarget.home;
    const awayOnTarget = stats.shotsOnTarget.away;
    let probability = 0.52;
    const reasoning: string[] = [];

    if (homeOnTarget >= 3 && awayOnTarget >= 3) {
      reasoning.push(`✅ Les 2 équipes cadrent (${homeOnTarget} vs ${awayOnTarget})`);
      probability += 0.12;
    }

    const possDiff = Math.abs(stats.possession.home - stats.possession.away);
    if (possDiff < 15) {
      reasoning.push(`✅ Match équilibré (diff: ${possDiff}%)`);
      probability += 0.08;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'BOTH_TEAMS_SCORE',
        description: 'Les deux équipes vont marquer',
        confidence: getConfidence(Math.min(probability, 0.78)),
        probability: Math.round(Math.min(probability, 0.78) * 100),
        reasoning,
        threshold_reached: homeOnTarget >= 3 && awayOnTarget >= 3
      });
    }
  }

  // Sort by probability
  recommendations.sort((a, b) => b.probability - a.probability);

  return recommendations;
};
