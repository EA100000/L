import { Match, MatchStats, BetRecommendation } from '../types';
import { Activity, AlertCircle, TrendingUp } from 'lucide-react';
import { cn } from '../utils/cn';

interface LiveMatchCardProps {
  match: Match;
  stats?: MatchStats;
  recommendations?: BetRecommendation[];
}

const getConfidenceColor = (confidence: string) => {
  switch (confidence) {
    case 'VERY_HIGH':
      return 'bg-green-500';
    case 'HIGH':
      return 'bg-blue-500';
    case 'MEDIUM':
      return 'bg-yellow-500';
    case 'LOW':
      return 'bg-orange-500';
    case 'VERY_LOW':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getConfidenceIcon = (confidence: string) => {
  if (confidence === 'VERY_HIGH' || confidence === 'HIGH') {
    return '🔥';
  }
  if (confidence === 'MEDIUM') {
    return '⚠️';
  }
  return '🔍';
};

export const LiveMatchCard = ({ match, stats, recommendations = [] }: LiveMatchCardProps) => {
  const highConfidenceRecs = recommendations.filter(
    (r) => r.confidence === 'VERY_HIGH' || r.confidence === 'HIGH'
  );

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
      {/* Header avec statut LIVE */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-red-600 uppercase">LIVE</span>
          </div>
          <span className="text-xs text-gray-500">{match.time}'</span>
        </div>
        {match.league && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {match.league}
          </span>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-800">{match.homeTeam}</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">{match.awayTeam}</div>
        </div>
        <div className="flex flex-col items-center gap-1 px-4">
          <span className="text-2xl font-bold text-gray-900">{match.score.split('-')[0]}</span>
          <span className="text-2xl font-bold text-gray-900">{match.score.split('-')[1]}</span>
        </div>
      </div>

      {/* Stats rapides */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="bg-gray-50 rounded p-2 text-center">
            <div className="text-gray-500 mb-1">Corners</div>
            <div className="font-semibold text-gray-900">
              {stats.corners.home + stats.corners.away}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-2 text-center">
            <div className="text-gray-500 mb-1">Tirs</div>
            <div className="font-semibold text-gray-900">
              {stats.shots.home + stats.shots.away}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-2 text-center">
            <div className="text-gray-500 mb-1">Cartons</div>
            <div className="font-semibold text-gray-900">
              {stats.cards.yellow + stats.cards.red}
            </div>
          </div>
        </div>
      )}

      {/* Recommandations */}
      {highConfidenceRecs.length > 0 && (
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-2">
            <TrendingUp className="w-3 h-3" />
            <span>Opportunités ({highConfidenceRecs.length})</span>
          </div>
          {highConfidenceRecs.map((rec, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-lg p-3 border-l-4',
                rec.confidence === 'VERY_HIGH'
                  ? 'bg-green-50 border-green-500'
                  : 'bg-blue-50 border-blue-500'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getConfidenceIcon(rec.confidence)}</span>
                    <span className="text-xs font-semibold text-gray-800">
                      {rec.description}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {rec.reasoning.slice(0, 2).map((reason, i) => (
                      <div key={i}>{reason}</div>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{rec.probability}%</div>
                  <div
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded text-white mt-1',
                      getConfidenceColor(rec.confidence)
                    )}
                  >
                    {rec.confidence}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Si pas de recommandations forte */}
      {highConfidenceRecs.length === 0 && recommendations.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Activity className="w-3 h-3" />
            <span>Surveillance en cours - Pas d'opportunité forte pour le moment</span>
          </div>
        </div>
      )}
    </div>
  );
};
