import { Match, MatchStats, BetRecommendation } from '../types';
import { analyzeMatchAdvanced, getDefaultPreMatchData, PreMatchData } from './tes-engine';

// Re-export pour compatibilité
export { analyzeMatchAdvanced, getDefaultPreMatchData };
export type { PreMatchData };

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
      // Vérifier si on a atteint la limite
      if (data.errors?.requests) {
        console.error('API limit reached:', data.errors.requests);
        throw new Error('API limit reached');
      }
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
// FLASHSCORE PARSER
// ==========================================

const parseFlashScoreData = (data: string): Match[] => {
  const matches: Match[] = [];
  const lines = data.split('~');

  let currentLeague = '';

  for (const line of lines) {
    if (line.startsWith('ZA÷')) {
      // Nouvelle league
      currentLeague = line.split('¬')[0].replace('ZA÷', '');
    }

    if (line.startsWith('AA÷')) {
      // Match data
      const parts = line.split('¬');
      const matchData: Record<string, string> = {};

      for (const part of parts) {
        const [key, value] = part.split('÷');
        if (key && value) {
          matchData[key] = value;
        }
      }

      // AC = status (1=not started, 2=live, 3=finished)
      // AE = home team, AF = away team
      // AG = home score, AH = away score
      // AB = match id

      const status = matchData['AC'];
      const homeTeam = matchData['AE'] || matchData['CX'] || 'Home';
      const awayTeam = matchData['AF'] || 'Away';
      const homeScore = matchData['AG'] || '0';
      const awayScore = matchData['AH'] || '0';
      const matchId = matchData['AA'] || '';
      const elapsed = matchData['BK'] || matchData['BO'] || '';

      let matchStatus: 'live' | 'scheduled' | 'finished' | 'unknown' = 'unknown';
      let timeDisplay = '';

      if (status === '2' || status === '3' && elapsed) {
        matchStatus = 'live';
        timeDisplay = elapsed ? `${elapsed}'` : 'LIVE';
      } else if (status === '1') {
        matchStatus = 'scheduled';
        // AD = timestamp
        if (matchData['AD']) {
          const kickoff = new Date(parseInt(matchData['AD']) * 1000);
          timeDisplay = kickoff.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
      } else if (status === '3') {
        matchStatus = 'finished';
        timeDisplay = 'Terminé';
      }

      if (homeTeam && awayTeam && matchId) {
        matches.push({
          id: `flash_${matchId}`,
          homeTeam,
          awayTeam,
          score: `${homeScore}-${awayScore}`,
          time: timeDisplay,
          status: matchStatus,
          league: currentLeague
        });
      }
    }
  }

  return matches;
};

const fetchFromFlashScore = async (): Promise<Match[]> => {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.flashscore.com/x/feed/f_1_0_3_en-gb_1')}`;
    const response = await fetch(proxyUrl);

    if (response.ok) {
      const data = await response.json();
      if (data.contents) {
        return parseFlashScoreData(data.contents);
      }
    }
  } catch (error) {
    console.error('FlashScore error:', error);
  }
  return [];
};

// ==========================================
// FETCH LIVE MATCHES - Multi-source
// ==========================================

export const fetchLiveMatches = async (): Promise<Match[]> => {
  const apiKey = getApiKey();

  // Essayer API-Football (si clé configurée)
  if (apiKey) {
    try {
      // Toujours chercher les matchs du jour
      console.log('Fetching today\'s fixtures from API-Football...');
      const today = new Date().toISOString().split('T')[0];
      const todayData = await fetchFromAPIFootball(`/fixtures?date=${today}`);

      if (todayData?.response?.length > 0) {
        console.log(`API-Football: ${todayData.response.length} fixtures today`);

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

        // Si 25+ matchs en direct, afficher seulement les lives
        if (live.length >= 25) {
          console.log(`${live.length} live matches - showing only live`);
          const matches: Match[] = live.map((fixture: any) => ({
            id: `apifb_${fixture.fixture.id}`,
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            score: `${fixture.goals.home ?? 0}-${fixture.goals.away ?? 0}`,
            time: fixture.fixture.status.short === 'HT' ? 'MT' : `${fixture.fixture.status.elapsed || 0}'`,
            status: 'live' as const,
            league: fixture.league.name
          }));
          return matches;
        }

        // Sinon, afficher tous les matchs du jour (live en premier)
        const sorted = [...live, ...upcoming, ...finished];

        const matches: Match[] = sorted.map((fixture: any) => {
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

  // Fallback sur FlashScore
  try {
    console.log('Fetching from FlashScore...');
    const flashMatches = await fetchFromFlashScore();

    if (flashMatches.length > 0) {
      console.log(`FlashScore: ${flashMatches.length} matches`);
      return flashMatches;
    }
  } catch (error) {
    console.error('FlashScore failed:', error);
  }

  // Fallback sur Sofascore via proxy
  try {
    console.log('Fetching from Sofascore...');
    const data = await fetchWithProxy(`${SOFASCORE_API}/sport/football/events/live`);

    if (data?.events?.length > 0) {
      console.log(`Sofascore: ${data.events.length} live events`);

      const matches: Match[] = data.events.map((event: any) => ({
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

  // Si aucun match, retourner liste vide
  console.log('No matches available from any source');
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
// MOTEUR TES - Wrapper pour compatibilité
// ==========================================

export const analyzeMatch = (
  stats: MatchStats,
  timeElapsed: number = 60,
  currentScore: { home: number; away: number } = { home: 0, away: 0 }
): BetRecommendation[] => {
  // Utiliser le moteur TES avancé
  return analyzeMatchAdvanced(stats, timeElapsed, currentScore, getDefaultPreMatchData());
};
