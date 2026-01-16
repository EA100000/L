import { BetRecommendation } from '../types';
import { TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../utils/cn';

interface AlertsPanelProps {
  recommendations: BetRecommendation[];
}

const getConfidenceDetails = (confidence: string) => {
  switch (confidence) {
    case 'VERY_HIGH':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-500',
        icon: '🔥',
        label: 'Très haute confiance',
      };
    case 'HIGH':
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-500',
        icon: '✅',
        label: 'Haute confiance',
      };
    case 'MEDIUM':
      return {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-500',
        icon: '⚠️',
        label: 'Confiance moyenne',
      };
    case 'LOW':
      return {
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-500',
        icon: '🔍',
        label: 'Faible confiance',
      };
    default:
      return {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-500',
        icon: '❌',
        label: 'Très faible confiance',
      };
  }
};

const getBetTypeLabel = (betType: string) => {
  switch (betType) {
    case 'CORNER_HIGH_ACTIVITY':
      return 'Corners - Forte activité';
    case 'CARD_PREDICTION':
      return 'Cartons - Prédiction';
    case 'GOAL_IMMINENT':
      return 'But imminent';
    case 'BOTH_TEAMS_SCORE':
      return 'Les 2 équipes marquent';
    default:
      return betType;
  }
};

export const AlertsPanel = ({ recommendations }: AlertsPanelProps) => {
  const sortedRecs = [...recommendations].sort((a, b) => {
    const confidenceOrder = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'];
    return confidenceOrder.indexOf(a.confidence) - confidenceOrder.indexOf(b.confidence);
  });

  const highPriorityCount = recommendations.filter(
    (r) => r.confidence === 'VERY_HIGH' || r.confidence === 'HIGH'
  ).length;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Alertes & Recommandations</h2>
        </div>
        {highPriorityCount > 0 && (
          <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-semibold">{highPriorityCount} Alerte(s)</span>
          </div>
        )}
      </div>

      {/* Liste des recommandations */}
      {sortedRecs.length > 0 ? (
        <div className="space-y-4">
          {sortedRecs.map((rec, idx) => {
            const details = getConfidenceDetails(rec.confidence);
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-lg p-4 border-l-4 transition-all hover:shadow-md',
                  details.bgColor,
                  details.borderColor
                )}
              >
                {/* Header de la recommandation */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{details.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {getBetTypeLabel(rec.bet_type)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{details.label}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-2xl font-bold', details.color)}>
                      {rec.probability}%
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="text-sm text-gray-700 mb-3 font-medium">
                  {rec.description}
                </div>

                {/* Raisons */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <Info className="w-3 h-3" />
                    <span>Analyse:</span>
                  </div>
                  <ul className="space-y-1 ml-5">
                    {rec.reasoning.map((reason, i) => (
                      <li key={i} className="text-xs text-gray-600">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Stats actuelles si disponibles */}
                {rec.current_stats && Object.keys(rec.current_stats).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      <span className="font-semibold">Stats clés: </span>
                      {Object.entries(rec.current_stats)
                        .slice(0, 3)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' • ')}
                    </div>
                  </div>
                )}

                {/* Badge seuil atteint */}
                {rec.threshold_reached && (
                  <div className="mt-3 inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                    <span>✓</span>
                    <span>Seuil atteint</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <Info className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-sm text-gray-500">
            Aucune recommandation pour le moment.
            <br />
            L'analyse se met à jour automatiquement.
          </p>
        </div>
      )}

      {/* Légende */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p className="font-semibold mb-2">Niveaux de confiance:</p>
          <div className="space-y-1">
            <div>🔥 Très haute (≥75%) - Action fortement recommandée</div>
            <div>✅ Haute (65-74%) - Bon potentiel</div>
            <div>⚠️ Moyenne (55-64%) - À surveiller</div>
            <div>🔍 Faible (&lt;55%) - Attendre confirmation</div>
          </div>
        </div>
      </div>
    </div>
  );
};
