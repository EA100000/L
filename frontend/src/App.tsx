import { useState, useEffect, useCallback } from 'react';
import { LiveMatchCard } from './components/LiveMatchCard';
import { StatsPanel } from './components/StatsPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { Match, MatchStats, BetRecommendation } from './types';
import { Activity, RefreshCw, Clock, Key, Settings, X, Check } from 'lucide-react';
import { fetchLiveMatches, fetchMatchStats, analyzeMatch, setApiKey, getApiKey } from './services/api';

interface MatchData {
  match: Match;
  stats?: MatchStats;
  recommendations?: BetRecommendation[];
  lastUpdate?: string;
}

function App() {
  const [matchesData, setMatchesData] = useState<Map<string, MatchData>>(new Map());
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Fonction pour récupérer les matchs
  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);

      // Récupérer tous les matchs
      const matches = await fetchLiveMatches();

      if (matches.length > 0) {
        const newMatchesData = new Map<string, MatchData>();

        // Ajouter tous les matchs sans charger les stats (trop de requêtes)
        for (const match of matches) {
          newMatchesData.set(match.id, { match });
        }

        setMatchesData(newMatchesData);

        // Sélectionner le premier match par défaut
        if (!selectedMatchId) {
          setSelectedMatchId(matches[0].id);
        }

        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Erreur fetch matchs:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMatchId]);

  // Charger les stats quand on sélectionne un match
  const loadMatchStats = useCallback(async (matchId: string) => {
    const matchData = matchesData.get(matchId);
    if (!matchData || matchData.stats) return; // Déjà chargé

    try {
      const stats = await fetchMatchStats(matchId);
      const timeElapsed = parseInt(String(matchData.match.time)) || 60;
      const recommendations = analyzeMatch(stats, timeElapsed);

      setMatchesData(prev => {
        const newMap = new Map(prev);
        newMap.set(matchId, {
          ...matchData,
          stats,
          recommendations,
          lastUpdate: new Date().toISOString(),
        });
        return newMap;
      });
    } catch (err) {
      console.error(`Erreur stats pour match ${matchId}:`, err);
    }
  }, [matchesData]);

  // Charger les stats du match sélectionné
  useEffect(() => {
    if (selectedMatchId) {
      loadMatchStats(selectedMatchId);
    }
  }, [selectedMatchId, loadMatchStats]);

  // Fetch initial et refresh automatique
  useEffect(() => {
    fetchData();

    // Refresh toutes les 60 secondes
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const matchesArray = Array.from(matchesData.values());
  const selectedMatch = selectedMatchId ? matchesData.get(selectedMatchId) : null;

  // Compter les alertes haute priorité
  const highPriorityAlertsCount = matchesArray.reduce((count, matchData) => {
    const highPriorityRecs = matchData.recommendations?.filter(
      (r) => r.confidence === 'VERY_HIGH' || r.confidence === 'HIGH'
    ) || [];
    return count + highPriorityRecs.length;
  }, 0);

  // Sauvegarder la clé API
  const handleSaveApiKey = () => {
    setApiKey(apiKeyInput);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
    // Recharger les données avec la nouvelle clé
    fetchData();
  };

  const hasApiKey = !!getApiKey();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Football AI Agent</h1>
                <p className="text-sm text-gray-500">Analyse en temps réel avec TES</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Bouton Settings */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  hasApiKey
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                <Key className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {hasApiKey ? 'API OK' : 'Config API'}
                </span>
              </button>

              {/* Bouton refresh */}
              <button
                onClick={fetchData}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Actualiser</span>
              </button>

              {/* Dernière mise à jour */}
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{lastRefresh.toLocaleTimeString('fr-FR')}</span>
              </div>

              {/* Compteur alertes */}
              {highPriorityAlertsCount > 0 && (
                <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold">
                    {highPriorityAlertsCount} Alerte{highPriorityAlertsCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">Configuration API-Football</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Pour obtenir les vraies données des matchs, crée une clé gratuite sur{' '}
                  <a
                    href="https://www.api-football.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    api-football.com
                  </a>
                  {' '}(100 requêtes/jour gratuites)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Colle ta clé API ici..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {apiKeySaved ? <Check className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                    <span>{apiKeySaved ? 'Sauvegardé!' : 'Sauvegarder'}</span>
                  </button>
                </div>
                {!hasApiKey && (
                  <p className="text-xs text-orange-600 mt-2">
                    Sans clé API, l'app utilise un proxy CORS (moins fiable)
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Chargement des matchs en direct...</p>
          </div>
        ) : matchesArray.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 mb-4">
              <Activity className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Aucun match en direct
            </h3>
            <p className="text-gray-500 mb-4">
              Les matchs apparaîtront ici dès qu'ils commenceront.
            </p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Actualiser
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne gauche - Liste des matchs */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Matchs du jour ({matchesArray.length})
                </h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {matchesArray.map((matchData) => (
                    <button
                      key={matchData.match.id}
                      onClick={() => setSelectedMatchId(matchData.match.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedMatchId === matchData.match.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <LiveMatchCard
                        match={matchData.match}
                        stats={matchData.stats}
                        recommendations={matchData.recommendations}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Colonnes droite - Détails du match sélectionné */}
            <div className="lg:col-span-2 space-y-6">
              {selectedMatch ? (
                <>
                  {/* Stats détaillées */}
                  {selectedMatch.stats && (
                    <StatsPanel
                      stats={selectedMatch.stats}
                      homeTeam={selectedMatch.match.homeTeam}
                      awayTeam={selectedMatch.match.awayTeam}
                    />
                  )}

                  {/* Alertes et recommandations */}
                  {selectedMatch.recommendations && (
                    <AlertsPanel recommendations={selectedMatch.recommendations} />
                  )}

                  {/* Info dernière mise à jour */}
                  {selectedMatch.lastUpdate && (
                    <div className="text-center text-xs text-gray-500">
                      Dernière mise à jour:{' '}
                      {new Date(selectedMatch.lastUpdate).toLocaleTimeString('fr-FR')}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-12 text-center">
                  <p className="text-gray-500">
                    Sélectionnez un match pour voir les détails et analyses
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-gray-500">
        <p>
          Football AI Agent - Système d'analyse temps réel avec stratégies TES
        </p>
        <p className="mt-1">
          Les informations sont fournies à titre éducatif uniquement
        </p>
      </footer>
    </div>
  );
}

export default App;
