export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  time: number;
  status: 'live' | 'finished' | 'scheduled';
  league?: string;
}

export interface MatchStats {
  corners: {
    home: number;
    away: number;
  };
  cards: {
    yellow: number;
    red: number;
  };
  shots: {
    home: number;
    away: number;
  };
  shotsOnTarget: {
    home: number;
    away: number;
  };
  possession: {
    home: number;
    away: number;
  };
  fouls: {
    home: number;
    away: number;
  };
}

export type BetType =
  | 'CORNER_HIGH_ACTIVITY'
  | 'CARD_PREDICTION'
  | 'GOAL_IMMINENT'
  | 'BOTH_TEAMS_SCORE';

export type Confidence =
  | 'VERY_HIGH'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'VERY_LOW';

export interface BetRecommendation {
  bet_type: BetType;
  description: string;
  confidence: Confidence;
  probability: number;
  reasoning: string[];
  current_stats?: Record<string, any>;
  threshold_reached?: boolean;
}

export interface MatchUpdate {
  type: 'match_update';
  match: Match;
  stats: MatchStats;
  recommendations: BetRecommendation[];
  timestamp: string;
}

export interface LiveMatchesResponse {
  success: boolean;
  count: number;
  matches: Match[];
  timestamp: string;
}

export interface MatchAnalysisResponse {
  success: boolean;
  match_id: string;
  time_elapsed: number;
  recommendations: BetRecommendation[];
  stats: MatchStats;
  timestamp: string;
}
