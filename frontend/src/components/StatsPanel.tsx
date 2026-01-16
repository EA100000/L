import { MatchStats } from '../types';

interface StatsPanelProps {
  stats: MatchStats;
  homeTeam: string;
  awayTeam: string;
}

export const StatsPanel = ({ stats, homeTeam, awayTeam }: StatsPanelProps) => {
  const statsData = [
    {
      name: 'Possession',
      home: stats.possession.home,
      away: stats.possession.away,
      unit: '%',
    },
    {
      name: 'Tirs',
      home: stats.shots.home,
      away: stats.shots.away,
      unit: '',
    },
    {
      name: 'Tirs cadrés',
      home: stats.shotsOnTarget.home,
      away: stats.shotsOnTarget.away,
      unit: '',
    },
    {
      name: 'Corners',
      home: stats.corners.home,
      away: stats.corners.away,
      unit: '',
    },
    {
      name: 'Fautes',
      home: stats.fouls.home,
      away: stats.fouls.away,
      unit: '',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Statistiques détaillées</h2>

      <div className="space-y-6">
        {statsData.map((stat) => (
          <div key={stat.name}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{stat.name}</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Valeur Home */}
              <div className="w-12 text-right">
                <span className="text-sm font-semibold text-blue-600">
                  {stat.home}
                  {stat.unit}
                </span>
              </div>

              {/* Barre de progression */}
              <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden flex">
                <div
                  className="bg-blue-500 flex items-center justify-end pr-2"
                  style={{
                    width: `${(stat.home / (stat.home + stat.away)) * 100}%`,
                  }}
                >
                  {stat.home > stat.away && (
                    <span className="text-xs font-medium text-white">
                      {homeTeam.substring(0, 3)}
                    </span>
                  )}
                </div>
                <div
                  className="bg-red-500 flex items-center justify-start pl-2"
                  style={{
                    width: `${(stat.away / (stat.home + stat.away)) * 100}%`,
                  }}
                >
                  {stat.away > stat.home && (
                    <span className="text-xs font-medium text-white">
                      {awayTeam.substring(0, 3)}
                    </span>
                  )}
                </div>
              </div>

              {/* Valeur Away */}
              <div className="w-12 text-left">
                <span className="text-sm font-semibold text-red-600">
                  {stat.away}
                  {stat.unit}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cartons */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-gray-600">Cartons jaunes: </span>
            <span className="font-semibold text-yellow-600">{stats.cards.yellow}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Cartons rouges: </span>
            <span className="font-semibold text-red-600">{stats.cards.red}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
