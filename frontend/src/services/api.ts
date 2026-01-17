import { Match, MatchStats, BetRecommendation } from '../types';

// ==========================================
// CONFIGURATION ET PROXIES CORS
// ==========================================

// Proxies CORS gratuits qui fonctionnent
const fetchWithProxy = async (url: string): Promise<any> => {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      console.log(`Trying proxy: ${proxyUrl.substring(0, 50)}...`);
      const response = await fetch(proxyUrl);

      if (response.ok) {
        const data = await response.json();
        // allorigins retourne {contents: "..."}
        if (data.contents) {
          return JSON.parse(data.contents);
        }
        return data;
      }
    } catch (error) {
      console.log(`Proxy failed, trying next...`);
    }
  }

  throw new Error('All proxies failed');
};

// ==========================================
// SOFASCORE API
// ==========================================

const SOFASCORE_API = 'https://api.sofascore.com/api/v1';

export const fetchLiveMatches = async (): Promise<Match[]> => {
  try {
    console.log('Fetching live matches from Sofascore...');

    const data = await fetchWithProxy(`${SOFASCORE_API}/sport/football/events/live`);

    if (!data || !data.events) {
      console.log('No events found in response');
      return [];
    }

    console.log(`Found ${data.events.length} live events`);

    const matches: Match[] = data.events.slice(0, 25).map((event: any) => ({
      id: `sofascore_${event.id}`,
      homeTeam: event.homeTeam?.name || event.homeTeam?.shortName || 'Home',
      awayTeam: event.awayTeam?.name || event.awayTeam?.shortName || 'Away',
      score: `${event.homeScore?.current ?? 0}-${event.awayScore?.current ?? 0}`,
      time: event.status?.description || String(event.time?.currentPeriodStartTimestamp || '0'),
      status: event.status?.type === 'inprogress' ? 'live' : (event.status?.type || 'unknown'),
      league: event.tournament?.name || event.tournament?.uniqueTournament?.name || 'League'
    }));

    return matches;
  } catch (error) {
    console.error('Error fetching matches:', error);

    // Retourner des matchs de démonstration si l'API échoue
    return getDemoMatches();
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
    const realId = matchId.replace('sofascore_', '').replace('demo_', '');

    // Pour les matchs de démo, retourner des stats simulées
    if (matchId.startsWith('demo_')) {
      return generateDemoStats();
    }

    const data = await fetchWithProxy(`${SOFASCORE_API}/event/${realId}/statistics`);

    if (!data || !data.statistics) {
      return defaultStats;
    }

    const stats = { ...defaultStats };

    for (const period of data.statistics) {
      for (const group of (period.groups || [])) {
        for (const item of (group.statisticsItems || [])) {
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
    console.error('Error fetching stats:', error);
    return matchId.startsWith('demo_') ? generateDemoStats() : defaultStats;
  }
};

// ==========================================
// DONNÉES DE DÉMONSTRATION
// ==========================================

const getDemoMatches = (): Match[] => {
  console.log('Using demo matches...');
  return [
    {
      id: 'demo_1',
      homeTeam: 'Manchester United',
      awayTeam: 'Liverpool',
      score: '2-1',
      time: "67'",
      status: 'live',
      league: 'Premier League'
    },
    {
      id: 'demo_2',
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      score: '1-1',
      time: "54'",
      status: 'live',
      league: 'La Liga'
    },
    {
      id: 'demo_3',
      homeTeam: 'PSG',
      awayTeam: 'Marseille',
      score: '3-0',
      time: "78'",
      status: 'live',
      league: 'Ligue 1'
    },
    {
      id: 'demo_4',
      homeTeam: 'Bayern Munich',
      awayTeam: 'Dortmund',
      score: '2-2',
      time: "82'",
      status: 'live',
      league: 'Bundesliga'
    },
    {
      id: 'demo_5',
      homeTeam: 'Juventus',
      awayTeam: 'Inter Milan',
      score: '1-0',
      time: "45'",
      status: 'live',
      league: 'Serie A'
    }
  ];
};

const generateDemoStats = (): MatchStats => {
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  return {
    corners: { home: rand(3, 8), away: rand(2, 7) },
    shots: { home: rand(8, 18), away: rand(6, 15) },
    shotsOnTarget: { home: rand(3, 8), away: rand(2, 6) },
    possession: { home: rand(40, 60), away: rand(40, 60) },
    fouls: { home: rand(8, 18), away: rand(7, 16) },
    cards: { yellow: rand(1, 5), red: rand(0, 1) }
  };
};

// ==========================================
// MOTEUR TES (The Expert System)
// ==========================================

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

  // STRATÉGIE 1: CORNERS
  if (timeElapsed >= 50) {
    const totalCorners = stats.corners.home + stats.corners.away;
    let probability = 0.60;
    const reasoning: string[] = [];

    if (totalCorners >= 7) {
      reasoning.push(`✅ ${totalCorners} corners déjà (seuil: 7)`);
      probability += 0.12;
    }

    const cornersPerMin = timeElapsed > 0 ? (totalCorners / timeElapsed) * 10 : 0;
    if (cornersPerMin >= 1.3) {
      reasoning.push(`✅ Rythme: ${cornersPerMin.toFixed(1)} corners/10min`);
      probability += 0.08;
    }

    const totalShots = stats.shots.home + stats.shots.away;
    if (totalShots >= 14) {
      reasoning.push(`✅ Pression: ${totalShots} tirs`);
      probability += 0.06;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'CORNER_HIGH_ACTIVITY',
        description: 'Plus de corners attendus',
        confidence: getConfidence(Math.min(probability, 0.88)),
        probability: Math.round(Math.min(probability, 0.88) * 100),
        reasoning,
        threshold_reached: totalCorners >= 7
      });
    }
  }

  // STRATÉGIE 2: CARTONS
  if (timeElapsed >= 55) {
    const totalFouls = stats.fouls.home + stats.fouls.away;
    const totalCards = stats.cards.yellow + stats.cards.red;
    let probability = 0.55;
    const reasoning: string[] = [];

    if (totalFouls >= 18) {
      reasoning.push(`✅ Match tendu: ${totalFouls} fautes`);
      probability += 0.12;
    }

    if (totalCards >= 2) {
      reasoning.push(`✅ Arbitre strict: ${totalCards} cartons`);
      probability += 0.10;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'CARD_PREDICTION',
        description: 'Carton probable',
        confidence: getConfidence(Math.min(probability, 0.85)),
        probability: Math.round(Math.min(probability, 0.85) * 100),
        reasoning,
        threshold_reached: totalFouls >= 18
      });
    }
  }

  // STRATÉGIE 3: BUT IMMINENT
  if (timeElapsed >= 45) {
    const totalShots = stats.shots.home + stats.shots.away;
    const totalOnTarget = stats.shotsOnTarget.home + stats.shotsOnTarget.away;
    let probability = 0.52;
    const reasoning: string[] = [];

    if (totalShots >= 12) {
      reasoning.push(`✅ ${totalShots} tirs tentés`);
      probability += 0.10;
    }

    if (totalOnTarget >= 5) {
      reasoning.push(`✅ ${totalOnTarget} tirs cadrés`);
      probability += 0.12;
    }

    const maxPoss = Math.max(stats.possession.home, stats.possession.away);
    if (maxPoss >= 58) {
      reasoning.push(`✅ Domination: ${maxPoss}%`);
      probability += 0.06;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'GOAL_IMMINENT',
        description: 'But probable bientôt',
        confidence: getConfidence(Math.min(probability, 0.82)),
        probability: Math.round(Math.min(probability, 0.82) * 100),
        reasoning,
        threshold_reached: totalOnTarget >= 5
      });
    }
  }

  // STRATÉGIE 4: BTTS
  if (timeElapsed >= 35) {
    const homeOnTarget = stats.shotsOnTarget.home;
    const awayOnTarget = stats.shotsOnTarget.away;
    let probability = 0.50;
    const reasoning: string[] = [];

    if (homeOnTarget >= 2 && awayOnTarget >= 2) {
      reasoning.push(`✅ 2 équipes cadrent: ${homeOnTarget} vs ${awayOnTarget}`);
      probability += 0.15;
    }

    const possDiff = Math.abs(stats.possession.home - stats.possession.away);
    if (possDiff < 12) {
      reasoning.push(`✅ Match équilibré`);
      probability += 0.08;
    }

    if (reasoning.length > 0) {
      recommendations.push({
        bet_type: 'BOTH_TEAMS_SCORE',
        description: 'Les 2 équipes vont marquer',
        confidence: getConfidence(Math.min(probability, 0.78)),
        probability: Math.round(Math.min(probability, 0.78) * 100),
        reasoning,
        threshold_reached: homeOnTarget >= 2 && awayOnTarget >= 2
      });
    }
  }

  // Trier par probabilité
  recommendations.sort((a, b) => b.probability - a.probability);

  return recommendations;
};
