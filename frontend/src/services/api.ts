import { Match, MatchStats, BetRecommendation } from '../types';

// ==========================================
// SOURCES DE DONNÉES MULTIPLES
// ==========================================

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest='
];

let currentProxyIndex = 0;

// Fonction pour fetch avec proxy CORS rotatif
const fetchWithProxy = async (url: string): Promise<Response> => {
  // Essayer d'abord directement
  try {
    const directResponse = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      mode: 'cors'
    });
    if (directResponse.ok) return directResponse;
  } catch {}

  // Sinon, utiliser les proxies
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyIndex = (currentProxyIndex + i) % CORS_PROXIES.length;
    const proxyUrl = CORS_PROXIES[proxyIndex] + encodeURIComponent(url);

    try {
      const response = await fetch(proxyUrl);
      if (response.ok) {
        currentProxyIndex = proxyIndex;
        return response;
      }
    } catch {}
  }

  throw new Error('Toutes les sources ont échoué');
};

// ==========================================
// SOURCE 1: SOFASCORE (API publique)
// ==========================================

const SOFASCORE_API = 'https://api.sofascore.com/api/v1';

const fetchSofascoreMatches = async (): Promise<Match[]> => {
  try {
    const response = await fetchWithProxy(`${SOFASCORE_API}/sport/football/events/live`);
    const data = await response.json();

    return (data.events || []).slice(0, 30).map((event: any) => ({
      id: `sofascore_${event.id}`,
      homeTeam: event.homeTeam?.name || 'Unknown',
      awayTeam: event.awayTeam?.name || 'Unknown',
      score: `${event.homeScore?.current || 0}-${event.awayScore?.current || 0}`,
      time: event.status?.description || '0',
      status: event.status?.type === 'inprogress' ? 'live' : event.status?.type || 'unknown',
      league: event.tournament?.name || 'Unknown League',
      source: 'sofascore'
    }));
  } catch (error) {
    console.error('Sofascore error:', error);
    return [];
  }
};

const fetchSofascoreStats = async (matchId: string): Promise<MatchStats | null> => {
  const realId = matchId.replace('sofascore_', '');

  try {
    const response = await fetchWithProxy(`${SOFASCORE_API}/event/${realId}/statistics`);
    const data = await response.json();

    const stats: MatchStats = {
      corners: { home: 0, away: 0 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
      possession: { home: 50, away: 50 },
      fouls: { home: 0, away: 0 },
      cards: { yellow: 0, red: 0 }
    };

    for (const period of (data.statistics || [])) {
      for (const group of (period.groups || [])) {
        for (const item of (group.statisticsItems || [])) {
          const name = (item.name || '').toLowerCase();
          const homeVal = parseInt(String(item.home || '0').replace('%', '')) || 0;
          const awayVal = parseInt(String(item.away || '0').replace('%', '')) || 0;

          if (name.includes('corner')) stats.corners = { home: homeVal, away: awayVal };
          else if (name === 'total shots' || name === 'shots') stats.shots = { home: homeVal, away: awayVal };
          else if (name.includes('shots on target')) stats.shotsOnTarget = { home: homeVal, away: awayVal };
          else if (name.includes('possession')) stats.possession = { home: homeVal, away: awayVal };
          else if (name.includes('foul')) stats.fouls = { home: homeVal, away: awayVal };
          else if (name.includes('yellow')) stats.cards.yellow = homeVal + awayVal;
          else if (name.includes('red')) stats.cards.red = homeVal + awayVal;
        }
      }
    }

    return stats;
  } catch (error) {
    console.error('Sofascore stats error:', error);
    return null;
  }
};

// ==========================================
// SOURCE 2: LIVESCORE API (alternative)
// ==========================================

const LIVESCORE_API = 'https://livescore-api.com/api-client/scores/live.json';

const fetchLivescoreMatches = async (): Promise<Match[]> => {
  try {
    // Note: Cette API nécessite une clé API gratuite de livescore-api.com
    // Pour le moment, on retourne un tableau vide si pas de clé
    const API_KEY = ''; // Ajouter votre clé ici

    if (!API_KEY) return [];

    const response = await fetchWithProxy(`${LIVESCORE_API}?key=${API_KEY}&secret=YOUR_SECRET`);
    const data = await response.json();

    return (data.data?.match || []).map((match: any) => ({
      id: `livescore_${match.id}`,
      homeTeam: match.home_name || 'Unknown',
      awayTeam: match.away_name || 'Unknown',
      score: `${match.score || '0-0'}`,
      time: match.time || '0',
      status: 'live',
      league: match.competition?.name || 'Unknown League',
      source: 'livescore'
    }));
  } catch (error) {
    console.error('Livescore error:', error);
    return [];
  }
};

// ==========================================
// SOURCE 3: FOOTBALL-DATA.ORG (gratuit avec clé)
// ==========================================

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4';

const fetchFootballDataMatches = async (): Promise<Match[]> => {
  try {
    // Cette API nécessite une clé API gratuite de football-data.org
    const API_KEY = ''; // Ajouter votre clé ici

    if (!API_KEY) return [];

    const response = await fetch(`${FOOTBALL_DATA_API}/matches?status=IN_PLAY`, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    const data = await response.json();

    return (data.matches || []).map((match: any) => ({
      id: `footballdata_${match.id}`,
      homeTeam: match.homeTeam?.name || 'Unknown',
      awayTeam: match.awayTeam?.name || 'Unknown',
      score: `${match.score?.fullTime?.home || 0}-${match.score?.fullTime?.away || 0}`,
      time: match.minute || '0',
      status: 'live',
      league: match.competition?.name || 'Unknown League',
      source: 'football-data'
    }));
  } catch (error) {
    console.error('Football-data error:', error);
    return [];
  }
};

// ==========================================
// FONCTION PRINCIPALE: AGRÉGATION DES SOURCES
// ==========================================

export const fetchLiveMatches = async (): Promise<Match[]> => {
  try {
    // Récupérer de toutes les sources en parallèle
    const [sofascoreMatches, livescoreMatches, footballDataMatches] = await Promise.allSettled([
      fetchSofascoreMatches(),
      fetchLivescoreMatches(),
      fetchFootballDataMatches()
    ]);

    // Combiner les résultats
    const allMatches: Match[] = [];

    if (sofascoreMatches.status === 'fulfilled') {
      allMatches.push(...sofascoreMatches.value);
    }
    if (livescoreMatches.status === 'fulfilled') {
      allMatches.push(...livescoreMatches.value);
    }
    if (footballDataMatches.status === 'fulfilled') {
      allMatches.push(...footballDataMatches.value);
    }

    // Dédupliquer par nom d'équipes (éviter les doublons entre sources)
    const uniqueMatches = allMatches.reduce((acc: Match[], match) => {
      const key = `${match.homeTeam.toLowerCase()}_${match.awayTeam.toLowerCase()}`;
      if (!acc.find(m => `${m.homeTeam.toLowerCase()}_${m.awayTeam.toLowerCase()}` === key)) {
        acc.push(match);
      }
      return acc;
    }, []);

    console.log(`Matchs trouvés: ${uniqueMatches.length} (Sofascore: ${sofascoreMatches.status === 'fulfilled' ? sofascoreMatches.value.length : 0})`);

    return uniqueMatches;
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
    // Déterminer la source
    if (matchId.startsWith('sofascore_')) {
      const stats = await fetchSofascoreStats(matchId);
      return stats || defaultStats;
    }

    // Pour les autres sources, on utilise les stats par défaut pour l'instant
    // On pourrait ajouter d'autres fetchers de stats ici
    return defaultStats;
  } catch (error) {
    console.error('Erreur fetch stats:', error);
    return defaultStats;
  }
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

  // ==========================================
  // STRATÉGIE 1: CORNERS - Forte Activité
  // ==========================================
  if (timeElapsed >= 55) {
    const totalCorners = stats.corners.home + stats.corners.away;
    let probability = 0.62;
    const reasoning: string[] = [];

    if (totalCorners >= 8) {
      reasoning.push(`✅ ${totalCorners} corners déjà marqués (seuil: 8)`);
      probability += 0.10;
    }

    const cornersPerMin = timeElapsed > 0 ? (totalCorners / timeElapsed) * 10 : 0;
    if (cornersPerMin >= 1.5) {
      reasoning.push(`✅ Rythme élevé: ${cornersPerMin.toFixed(1)} corners/10min`);
      probability += 0.08;
    }

    const totalShots = stats.shots.home + stats.shots.away;
    if (totalShots >= 15) {
      reasoning.push(`✅ Pression offensive: ${totalShots} tirs`);
      probability += 0.08;
    }

    // Bonus si possession déséquilibrée (équipe dominante attaque)
    const possDiff = Math.abs(stats.possession.home - stats.possession.away);
    if (possDiff >= 15) {
      reasoning.push(`✅ Domination: ${Math.max(stats.possession.home, stats.possession.away)}% possession`);
      probability += 0.05;
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

  // ==========================================
  // STRATÉGIE 2: CARTONS - Prédiction
  // ==========================================
  if (timeElapsed >= 60) {
    const totalFouls = stats.fouls.home + stats.fouls.away;
    const totalCards = stats.cards.yellow + stats.cards.red;
    let probability = 0.58;
    const reasoning: string[] = [];

    if (totalFouls >= 20) {
      reasoning.push(`✅ Match tendu: ${totalFouls} fautes (seuil: 20)`);
      probability += 0.10;
    }

    const foulsPerMin = timeElapsed > 0 ? (totalFouls / timeElapsed) * 10 : 0;
    if (foulsPerMin >= 3) {
      reasoning.push(`✅ Rythme fautes: ${foulsPerMin.toFixed(1)}/10min`);
      probability += 0.07;
    }

    if (totalCards >= 2) {
      reasoning.push(`✅ Arbitre sévère: ${totalCards} cartons déjà`);
      probability += 0.09;
    }

    // Score serré = plus de tension
    const [homeScore, awayScore] = [0, 0]; // On n'a pas le score dans les stats
    if (Math.abs(homeScore - awayScore) <= 1 && timeElapsed >= 70) {
      reasoning.push(`✅ Fin de match serrée`);
      probability += 0.05;
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

  // ==========================================
  // STRATÉGIE 3: BUT IMMINENT
  // ==========================================
  if (timeElapsed >= 50) {
    const totalShots = stats.shots.home + stats.shots.away;
    const totalOnTarget = stats.shotsOnTarget.home + stats.shotsOnTarget.away;
    let probability = 0.55;
    const reasoning: string[] = [];

    if (totalShots >= 12) {
      reasoning.push(`✅ Beaucoup de tirs: ${totalShots} (seuil: 12)`);
      probability += 0.08;
    }

    if (totalOnTarget >= 5) {
      reasoning.push(`✅ Tirs cadrés: ${totalOnTarget} (seuil: 5)`);
      probability += 0.10;
    }

    // Ratio tirs cadrés / tirs totaux
    const accuracyRatio = totalShots > 0 ? totalOnTarget / totalShots : 0;
    if (accuracyRatio >= 0.4) {
      reasoning.push(`✅ Précision: ${Math.round(accuracyRatio * 100)}% cadrés`);
      probability += 0.06;
    }

    // Possession dominante
    const maxPoss = Math.max(stats.possession.home, stats.possession.away);
    if (maxPoss >= 60) {
      reasoning.push(`✅ Domination: ${maxPoss}% possession`);
      probability += 0.05;
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

  // ==========================================
  // STRATÉGIE 4: BOTH TEAMS TO SCORE
  // ==========================================
  if (timeElapsed >= 40) {
    const homeOnTarget = stats.shotsOnTarget.home;
    const awayOnTarget = stats.shotsOnTarget.away;
    const homeShots = stats.shots.home;
    const awayShots = stats.shots.away;
    let probability = 0.52;
    const reasoning: string[] = [];

    if (homeOnTarget >= 3 && awayOnTarget >= 3) {
      reasoning.push(`✅ 2 équipes cadrent: ${homeOnTarget} vs ${awayOnTarget}`);
      probability += 0.12;
    }

    if (homeShots >= 5 && awayShots >= 5) {
      reasoning.push(`✅ 2 équipes tirent: ${homeShots} vs ${awayShots}`);
      probability += 0.06;
    }

    const possDiff = Math.abs(stats.possession.home - stats.possession.away);
    if (possDiff < 15) {
      reasoning.push(`✅ Match équilibré: diff possession ${possDiff}%`);
      probability += 0.08;
    }

    // Faibles corners = jeu plus ouvert
    const totalCorners = stats.corners.home + stats.corners.away;
    if (totalCorners < 6 && homeShots >= 4 && awayShots >= 4) {
      reasoning.push(`✅ Jeu ouvert, peu de corners`);
      probability += 0.04;
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

  // Trier par probabilité décroissante
  recommendations.sort((a, b) => b.probability - a.probability);

  return recommendations;
};

// ==========================================
// EXPORT DES INFORMATIONS SUR LES SOURCES
// ==========================================

export const getDataSourcesInfo = () => ({
  sources: [
    {
      name: 'Sofascore',
      url: 'sofascore.com',
      status: 'active',
      features: ['Live scores', 'Statistics', 'Lineups']
    },
    {
      name: 'Football-Data.org',
      url: 'football-data.org',
      status: 'requires_api_key',
      features: ['Live scores', 'Fixtures', 'Standings']
    },
    {
      name: 'Livescore API',
      url: 'livescore-api.com',
      status: 'requires_api_key',
      features: ['Live scores', 'Odds', 'Events']
    }
  ],
  note: 'Pour activer plus de sources, ajoutez vos clés API dans le fichier api.ts'
});
