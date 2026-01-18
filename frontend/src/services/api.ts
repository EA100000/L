import { Match, MatchStats, BetRecommendation } from '../types';

// ==========================================
// API-FOOTBALL - Données réelles
// ==========================================

// Clé API stockée dans localStorage
const API_KEY_STORAGE = 'football_api_key';

// Récupérer la clé depuis localStorage ou env
export const getApiKey = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_API_FOOTBALL_KEY || '';
  }
  return import.meta.env.VITE_API_FOOTBALL_KEY || '';
};

// Sauvegarder la clé dans localStorage
export const setApiKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  }
};

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';

// ==========================================
// FETCH AVEC PLUSIEURS SOURCES
// ==========================================

const fetchFromAPIFootball = async (endpoint: string): Promise<any> => {
  const apiKey = getApiKey();
  try {
    const response = await fetch(`https://${API_FOOTBALL_HOST}${endpoint}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error('API-Football request failed');
  } catch (error) {
    console.error('API-Football error:', error);
    throw error;
  }
};

// Proxies CORS pour Sofascore (fallback)
const fetchWithProxy = async (url: string): Promise<any> => {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      console.log(`Trying proxy: ${proxyUrl.substring(0, 50)}...`);
      const response = await fetch(proxyUrl);

      if (response.ok) {
        const data = await response.json();
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

const SOFASCORE_API = 'https://api.sofascore.com/api/v1';

// ==========================================
// FETCH LIVE MATCHES - Multi-source
// ==========================================

export const fetchLiveMatches = async (): Promise<Match[]> => {
  const apiKey = getApiKey();

  // Essayer API-Football d'abord (si clé configurée)
  if (apiKey) {
    try {
      // D'abord essayer les matchs en direct
      console.log('Fetching live matches from API-Football...');
      const liveData = await fetchFromAPIFootball('/fixtures?live=all');

      if (liveData?.response?.length > 0) {
        console.log(`API-Football: ${liveData.response.length} live matches`);

        const matches: Match[] = liveData.response.map((fixture: any) => ({
          id: `apifb_${fixture.fixture.id}`,
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          score: `${fixture.goals.home ?? 0}-${fixture.goals.away ?? 0}`,
          time: `${fixture.fixture.status.elapsed || 0}'`,
          status: 'live' as const,
          league: fixture.league.name
        }));

        return matches;
      }

      // Si pas de matchs en direct, chercher les matchs du jour
      console.log('No live matches, fetching today\'s fixtures...');
      const today = new Date().toISOString().split('T')[0];
      const todayData = await fetchFromAPIFootball(`/fixtures?date=${today}`);

      if (todayData?.response?.length > 0) {
        console.log(`API-Football: ${todayData.response.length} fixtures today`);

        // Filtrer et trier: en cours > à venir > terminés
        const fixtures = todayData.response;

        // Séparer par statut
        const live = fixtures.filter((f: any) =>
          ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(f.fixture.status.short)
        );
        const upcoming = fixtures.filter((f: any) =>
          ['NS', 'TBD'].includes(f.fixture.status.short)
        );
        const finished = fixtures.filter((f: any) =>
          ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)
        );

        // Prendre les plus importants (top leagues)
        const topLeagues = [39, 140, 135, 78, 61, 2, 3, 848, 1]; // PL, La Liga, Serie A, Bundesliga, L1, UCL, UEL, Conf League, World Cup

        const sortByLeague = (a: any, b: any) => {
          const aTop = topLeagues.indexOf(a.league.id);
          const bTop = topLeagues.indexOf(b.league.id);
          if (aTop !== -1 && bTop === -1) return -1;
          if (aTop === -1 && bTop !== -1) return 1;
          if (aTop !== -1 && bTop !== -1) return aTop - bTop;
          return 0;
        };

        const sorted = [...live, ...upcoming.sort(sortByLeague), ...finished.sort(sortByLeague).reverse()];

        // Afficher tous les matchs (max 500 pour performance)
        const matches: Match[] = sorted.slice(0, 500).map((fixture: any) => {
          const status = fixture.fixture.status.short;
          let matchStatus: 'live' | 'scheduled' | 'finished' | 'unknown' = 'unknown';
          let timeDisplay = '';

          if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status)) {
            matchStatus = 'live';
            timeDisplay = status === 'HT' ? 'MT' : `${fixture.fixture.status.elapsed || 0}'`;
          } else if (['NS', 'TBD'].includes(status)) {
            matchStatus = 'scheduled';
            const kickoff = new Date(fixture.fixture.date);
            timeDisplay = kickoff.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          } else if (['FT', 'AET', 'PEN'].includes(status)) {
            matchStatus = 'finished';
            timeDisplay = 'Terminé';
          }

          return {
            id: `apifb_${fixture.fixture.id}`,
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            score: `${fixture.goals.home ?? 0}-${fixture.goals.away ?? 0}`,
            time: timeDisplay,
            status: matchStatus,
            league: fixture.league.name
          };
        });

        return matches;
      }
    } catch (error) {
      console.log('API-Football failed, trying Sofascore...', error);
    }
  } else {
    console.log('No API-Football key, using Sofascore...');
  }

  // Fallback sur Sofascore via proxy
  try {
    console.log('Fetching from Sofascore...');
    const data = await fetchWithProxy(`${SOFASCORE_API}/sport/football/events/live`);

    if (data?.events?.length > 0) {
      console.log(`Sofascore: ${data.events.length} live events`);

      const matches: Match[] = data.events.slice(0, 25).map((event: any) => ({
        id: `sofascore_${event.id}`,
        homeTeam: event.homeTeam?.name || event.homeTeam?.shortName || 'Home',
        awayTeam: event.awayTeam?.name || event.awayTeam?.shortName || 'Away',
        score: `${event.homeScore?.current ?? 0}-${event.awayScore?.current ?? 0}`,
        time: event.status?.description || `${event.time?.played || 0}'`,
        status: event.status?.type === 'inprogress' ? 'live' : (event.status?.type || 'unknown'),
        league: event.tournament?.name || event.tournament?.uniqueTournament?.name || 'League'
      }));

      return matches;
    }
  } catch (error) {
    console.error('Sofascore also failed:', error);
  }

  // Si aucun match en direct, retourner liste vide (pas de démo)
  console.log('No live matches available from any source');
  return [];
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

  // Essayer API-Football pour les stats
  if (matchId.startsWith('apifb_')) {
    try {
      const realId = matchId.replace('apifb_', '');
      const data = await fetchFromAPIFootball(`/fixtures/statistics?fixture=${realId}`);

      if (data?.response?.length >= 2) {
        const homeStats = data.response[0].statistics;
        const awayStats = data.response[1].statistics;

        const getStat = (stats: any[], name: string): number => {
          const stat = stats.find((s: any) => s.type === name);
          if (!stat?.value) return 0;
          return parseInt(String(stat.value).replace('%', '')) || 0;
        };

        return {
          corners: {
            home: getStat(homeStats, 'Corner Kicks'),
            away: getStat(awayStats, 'Corner Kicks')
          },
          shots: {
            home: getStat(homeStats, 'Total Shots'),
            away: getStat(awayStats, 'Total Shots')
          },
          shotsOnTarget: {
            home: getStat(homeStats, 'Shots on Goal'),
            away: getStat(awayStats, 'Shots on Goal')
          },
          possession: {
            home: getStat(homeStats, 'Ball Possession'),
            away: getStat(awayStats, 'Ball Possession')
          },
          fouls: {
            home: getStat(homeStats, 'Fouls'),
            away: getStat(awayStats, 'Fouls')
          },
          cards: {
            yellow: getStat(homeStats, 'Yellow Cards') + getStat(awayStats, 'Yellow Cards'),
            red: getStat(homeStats, 'Red Cards') + getStat(awayStats, 'Red Cards')
          }
        };
      }
    } catch (error) {
      console.error('API-Football stats error:', error);
    }
  }

  // Fallback Sofascore
  if (matchId.startsWith('sofascore_')) {
    try {
      const realId = matchId.replace('sofascore_', '');
      const data = await fetchWithProxy(`${SOFASCORE_API}/event/${realId}/statistics`);

      if (data?.statistics) {
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
      }
    } catch (error) {
      console.error('Sofascore stats error:', error);
    }
  }

  return defaultStats;
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
