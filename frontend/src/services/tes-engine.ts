import { MatchStats, BetRecommendation } from '../types';

// ==========================================
// TES ENGINE - THE EXPERT SYSTEM
// Moteur d'analyse avancé Over/Under
// ==========================================

type Confidence = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

// Interface pour les données pré-match
export interface PreMatchData {
  homeTeam: {
    avgCorners: number;
    avgFouls: number;
    avgShots: number;
    avgGoals: number;
    avgConceded: number;
  };
  awayTeam: {
    avgCorners: number;
    avgFouls: number;
    avgShots: number;
    avgGoals: number;
    avgConceded: number;
  };
  h2h: {
    avgCorners: number;
    avgFouls: number;
    avgGoals: number;
    gamesPlayed: number;
    under10_5Corners: number; // Nombre de matchs avec moins de 10.5 corners
    over2_5Goals: number; // Nombre de matchs avec plus de 2.5 buts
  };
}

// Données pré-match par défaut (estimations moyennes)
export const getDefaultPreMatchData = (): PreMatchData => ({
  homeTeam: {
    avgCorners: 5.2,
    avgFouls: 11.5,
    avgShots: 12.3,
    avgGoals: 1.4,
    avgConceded: 1.2,
  },
  awayTeam: {
    avgCorners: 4.8,
    avgFouls: 12.1,
    avgShots: 10.8,
    avgGoals: 1.1,
    avgConceded: 1.5,
  },
  h2h: {
    avgCorners: 9.5,
    avgFouls: 24,
    avgGoals: 2.4,
    gamesPlayed: 5,
    under10_5Corners: 4,
    over2_5Goals: 3,
  },
});

const getConfidence = (probability: number): Confidence => {
  if (probability >= 0.80) return 'VERY_HIGH';
  if (probability >= 0.70) return 'HIGH';
  if (probability >= 0.60) return 'MEDIUM';
  if (probability >= 0.50) return 'LOW';
  return 'VERY_LOW';
};

// ==========================================
// CALCUL PROJECTION LINÉAIRE MI-TEMPS → MATCH
// ==========================================

const projectToFullMatch = (
  currentValue: number,
  timeElapsed: number,
  intensityFactor: number = 1.0
): number => {
  if (timeElapsed <= 0) return 0;
  const minutesPlayed = Math.min(timeElapsed, 90);
  const ratePerMinute = currentValue / minutesPlayed;
  const projectedValue = ratePerMinute * 90 * intensityFactor;
  return projectedValue;
};

// ==========================================
// ANALYSE OVER/UNDER CORNERS
// ==========================================

interface CornerAnalysis {
  projectedTotal: number;
  scenarios: { value: number; probability: number }[];
  recommendation: {
    line: number;
    type: 'OVER' | 'UNDER';
    probability: number;
    confidence: Confidence;
  } | null;
}

const analyzeCorners = (
  stats: MatchStats,
  timeElapsed: number,
  preMatch: PreMatchData
): CornerAnalysis => {
  const currentCorners = stats.corners.home + stats.corners.away;

  // Étape 1: Projection linéaire
  const linearProjection = projectToFullMatch(currentCorners, timeElapsed, 1.0);

  // Étape 2: Ajustement intensité 2ème MT (+20-25%)
  const intensityAdjusted = projectToFullMatch(currentCorners, timeElapsed, 1.22);

  // Étape 3: Validation par H2H
  const h2hAverage = preMatch.h2h.avgCorners;
  const h2hUnderRate = preMatch.h2h.under10_5Corners / preMatch.h2h.gamesPlayed;

  // Étape 4: Moyenne pondérée des projections (H2H influence le poids)
  const h2hWeight = h2hUnderRate > 0.6 ? 0.35 : 0.25;
  const avgProjection = (linearProjection * 0.25 + intensityAdjusted * (0.75 - h2hWeight) + h2hAverage * h2hWeight);

  // Étape 5: Création des scénarios
  const scenarios = [
    { value: avgProjection * 0.75, probability: 0.15 }, // Faible
    { value: avgProjection * 0.90, probability: 0.35 }, // Normal bas
    { value: avgProjection * 1.10, probability: 0.35 }, // Normal haut
    { value: avgProjection * 1.35, probability: 0.15 }, // Élevé
  ];

  // Étape 6: Calcul valeur attendue
  const expectedValue = scenarios.reduce((sum, s) => sum + s.value * s.probability, 0);

  // Étape 7: Déterminer la meilleure ligne
  let recommendation: CornerAnalysis['recommendation'] = null;

  // Lignes courantes pour corners
  const lines = [6.5, 7.5, 8.5, 9.5, 10.5, 11.5];

  for (const line of lines) {
    const probOver = scenarios.reduce((sum, s) =>
      s.value > line ? sum + s.probability : sum, 0
    );
    const probUnder = 1 - probOver;

    // Chercher la meilleure opportunité (prob > 70%)
    if (probUnder >= 0.70 && (!recommendation || probUnder > recommendation.probability)) {
      recommendation = {
        line,
        type: 'UNDER',
        probability: probUnder,
        confidence: getConfidence(probUnder),
      };
    }
    if (probOver >= 0.70 && (!recommendation || probOver > recommendation.probability)) {
      recommendation = {
        line,
        type: 'OVER',
        probability: probOver,
        confidence: getConfidence(probOver),
      };
    }
  }

  return {
    projectedTotal: expectedValue,
    scenarios,
    recommendation,
  };
};

// ==========================================
// ANALYSE OVER/UNDER FAUTES
// ==========================================

interface FoulsAnalysis {
  projectedTotal: number;
  recommendation: {
    line: number;
    type: 'OVER' | 'UNDER';
    probability: number;
    confidence: Confidence;
  } | null;
}

const analyzeFouls = (
  stats: MatchStats,
  timeElapsed: number,
  preMatch: PreMatchData,
  scoreDiff: number // Positif = équipe domicile mène
): FoulsAnalysis => {
  const currentFouls = stats.fouls.home + stats.fouls.away;

  // Projection de base
  let intensityFactor = 1.0;

  // Ajustement si score serré (plus de fautes tactiques)
  if (Math.abs(scoreDiff) <= 1) {
    intensityFactor = 1.20; // +20% en 2ème MT
  }

  // Ajustement si équipe menée (pressing accru)
  if (Math.abs(scoreDiff) >= 1) {
    intensityFactor = 1.25; // +25% pressing
  }

  const projected = projectToFullMatch(currentFouls, timeElapsed, intensityFactor);

  // Validation par moyenne saison
  const seasonAverage = preMatch.homeTeam.avgFouls + preMatch.awayTeam.avgFouls;
  const adjustedProjection = (projected * 0.6 + seasonAverage * 0.4);

  // Lignes courantes fautes
  const lines = [18.5, 19.5, 20.5, 21.5, 22.5, 23.5, 24.5];
  let recommendation: FoulsAnalysis['recommendation'] = null;

  for (const line of lines) {
    const variance = adjustedProjection * 0.15; // 15% variance

    // Distribution normale simplifiée
    const zScore = (line - adjustedProjection) / variance;
    const probUnder = 0.5 * (1 + Math.tanh(zScore * 0.8));
    const probOver = 1 - probUnder;

    if (probOver >= 0.70 && (!recommendation || probOver > recommendation.probability)) {
      recommendation = {
        line,
        type: 'OVER',
        probability: probOver,
        confidence: getConfidence(probOver),
      };
    }
    if (probUnder >= 0.70 && (!recommendation || probUnder > recommendation.probability)) {
      recommendation = {
        line,
        type: 'UNDER',
        probability: probUnder,
        confidence: getConfidence(probUnder),
      };
    }
  }

  return {
    projectedTotal: adjustedProjection,
    recommendation,
  };
};

// ==========================================
// ANALYSE OVER/UNDER BUTS
// ==========================================

interface GoalsAnalysis {
  projectedTotal: number;
  recommendation: {
    line: number;
    type: 'OVER' | 'UNDER';
    probability: number;
    confidence: Confidence;
  } | null;
}

const analyzeGoals = (
  stats: MatchStats,
  timeElapsed: number,
  currentGoals: number,
  preMatch: PreMatchData
): GoalsAnalysis => {
  // Projection basée sur les tirs cadrés
  const totalShotsOnTarget = stats.shotsOnTarget.home + stats.shotsOnTarget.away;
  const conversionRate = 0.15; // 15% des tirs cadrés = but en moyenne

  // Projection des tirs cadrés restants
  const projectedSOT = projectToFullMatch(totalShotsOnTarget, timeElapsed, 1.15);
  const expectedGoalsFromShots = projectedSOT * conversionRate;

  // Moyenne H2H
  const h2hAvgGoals = preMatch.h2h.avgGoals;

  // Moyenne saison des deux équipes
  const seasonAvg = (preMatch.homeTeam.avgGoals + preMatch.homeTeam.avgConceded +
                     preMatch.awayTeam.avgGoals + preMatch.awayTeam.avgConceded) / 2;

  // Projection combinée
  const projectedGoals = (
    currentGoals * 0.4 + // Buts actuels ont du poids
    expectedGoalsFromShots * 0.3 +
    h2hAvgGoals * 0.15 +
    seasonAvg * 0.15
  );

  // Lignes buts
  const lines = [0.5, 1.5, 2.5, 3.5, 4.5];
  let recommendation: GoalsAnalysis['recommendation'] = null;

  for (const line of lines) {
    const variance = 0.8; // Variance typique buts
    const zScore = (line - projectedGoals) / variance;
    const probUnder = 0.5 * (1 + Math.tanh(zScore * 0.7));
    const probOver = 1 - probUnder;

    // Seules les recommandations fortes
    if (probOver >= 0.72 && line <= currentGoals + 1.5) {
      // Over réaliste (proche du score actuel)
      if (!recommendation || probOver > recommendation.probability) {
        recommendation = {
          line,
          type: 'OVER',
          probability: probOver,
          confidence: getConfidence(probOver),
        };
      }
    }
    if (probUnder >= 0.72 && line > currentGoals) {
      if (!recommendation || probUnder > recommendation.probability) {
        recommendation = {
          line,
          type: 'UNDER',
          probability: probUnder,
          confidence: getConfidence(probUnder),
        };
      }
    }
  }

  return {
    projectedTotal: projectedGoals,
    recommendation,
  };
};

// ==========================================
// ANALYSE OVER/UNDER CARTONS
// ==========================================

interface CardsAnalysis {
  projectedTotal: number;
  recommendation: {
    line: number;
    type: 'OVER' | 'UNDER';
    probability: number;
    confidence: Confidence;
  } | null;
}

const analyzeCards = (
  stats: MatchStats,
  timeElapsed: number
): CardsAnalysis => {
  const currentCards = stats.cards.yellow + stats.cards.red;
  const currentFouls = stats.fouls.home + stats.fouls.away;

  // Ratio cartons/fautes typique
  const cardFoulRatio = currentFouls > 0 ? currentCards / currentFouls : 0.12;
  const avgRatio = (cardFoulRatio + 0.12) / 2; // Moyenne avec ratio standard

  // Projection fautes
  const projectedFouls = projectToFullMatch(currentFouls, timeElapsed, 1.2);

  // Projection cartons
  const projectedCards = projectedFouls * avgRatio;

  const lines = [2.5, 3.5, 4.5, 5.5];
  let recommendation: CardsAnalysis['recommendation'] = null;

  for (const line of lines) {
    const variance = projectedCards * 0.25;
    const zScore = (line - projectedCards) / Math.max(variance, 0.5);
    const probUnder = 0.5 * (1 + Math.tanh(zScore * 0.6));
    const probOver = 1 - probUnder;

    if (probOver >= 0.68 && (!recommendation || probOver > recommendation.probability)) {
      recommendation = {
        line,
        type: 'OVER',
        probability: probOver,
        confidence: getConfidence(probOver),
      };
    }
    if (probUnder >= 0.68 && (!recommendation || probUnder > recommendation.probability)) {
      recommendation = {
        line,
        type: 'UNDER',
        probability: probUnder,
        confidence: getConfidence(probUnder),
      };
    }
  }

  return {
    projectedTotal: projectedCards,
    recommendation,
  };
};

// ==========================================
// FONCTION PRINCIPALE D'ANALYSE
// ==========================================

export const analyzeMatchAdvanced = (
  stats: MatchStats,
  timeElapsed: number,
  currentScore: { home: number; away: number } = { home: 0, away: 0 },
  preMatch: PreMatchData = getDefaultPreMatchData()
): BetRecommendation[] => {
  const recommendations: BetRecommendation[] = [];
  const scoreDiff = currentScore.home - currentScore.away;
  const totalGoals = currentScore.home + currentScore.away;

  // Seulement analyser après 35 minutes
  if (timeElapsed < 35) {
    return recommendations;
  }

  // ===== ANALYSE CORNERS =====
  const cornersAnalysis = analyzeCorners(stats, timeElapsed, preMatch);
  if (cornersAnalysis.recommendation && cornersAnalysis.recommendation.probability >= 0.70) {
    const rec = cornersAnalysis.recommendation;
    recommendations.push({
      bet_type: 'CORNER_HIGH_ACTIVITY',
      description: `${rec.type} ${rec.line} Corners`,
      confidence: rec.confidence,
      probability: Math.round(rec.probability * 100),
      reasoning: [
        `📊 Projection: ${cornersAnalysis.projectedTotal.toFixed(1)} corners`,
        `📈 Ligne: ${rec.type} ${rec.line}`,
        `🎯 Probabilité: ${Math.round(rec.probability * 100)}%`,
        `⏱️ Temps: ${timeElapsed}'`,
      ],
      threshold_reached: rec.probability >= 0.75,
    });
  }

  // ===== ANALYSE FAUTES =====
  const foulsAnalysis = analyzeFouls(stats, timeElapsed, preMatch, scoreDiff);
  if (foulsAnalysis.recommendation && foulsAnalysis.recommendation.probability >= 0.70) {
    const rec = foulsAnalysis.recommendation;
    recommendations.push({
      bet_type: 'CARD_PREDICTION',
      description: `${rec.type} ${rec.line} Fautes`,
      confidence: rec.confidence,
      probability: Math.round(rec.probability * 100),
      reasoning: [
        `📊 Projection: ${foulsAnalysis.projectedTotal.toFixed(1)} fautes`,
        `📈 Ligne: ${rec.type} ${rec.line}`,
        `🎯 Probabilité: ${Math.round(rec.probability * 100)}%`,
        scoreDiff !== 0 ? `⚡ Intensité accrue (score: ${scoreDiff > 0 ? '+' : ''}${scoreDiff})` : '',
      ].filter(Boolean),
      threshold_reached: rec.probability >= 0.75,
    });
  }

  // ===== ANALYSE BUTS =====
  const goalsAnalysis = analyzeGoals(stats, timeElapsed, totalGoals, preMatch);
  if (goalsAnalysis.recommendation && goalsAnalysis.recommendation.probability >= 0.70) {
    const rec = goalsAnalysis.recommendation;
    recommendations.push({
      bet_type: 'GOAL_IMMINENT',
      description: `${rec.type} ${rec.line} Buts`,
      confidence: rec.confidence,
      probability: Math.round(rec.probability * 100),
      reasoning: [
        `📊 Projection: ${goalsAnalysis.projectedTotal.toFixed(1)} buts`,
        `📈 Ligne: ${rec.type} ${rec.line}`,
        `🎯 Probabilité: ${Math.round(rec.probability * 100)}%`,
        `⚽ Score actuel: ${currentScore.home}-${currentScore.away}`,
      ],
      threshold_reached: rec.probability >= 0.75,
    });
  }

  // ===== ANALYSE CARTONS =====
  const cardsAnalysis = analyzeCards(stats, timeElapsed);
  if (cardsAnalysis.recommendation && cardsAnalysis.recommendation.probability >= 0.68) {
    const rec = cardsAnalysis.recommendation;
    recommendations.push({
      bet_type: 'CARD_PREDICTION',
      description: `${rec.type} ${rec.line} Cartons`,
      confidence: rec.confidence,
      probability: Math.round(rec.probability * 100),
      reasoning: [
        `📊 Projection: ${cardsAnalysis.projectedTotal.toFixed(1)} cartons`,
        `📈 Ligne: ${rec.type} ${rec.line}`,
        `🎯 Probabilité: ${Math.round(rec.probability * 100)}%`,
        `🟨 Actuellement: ${stats.cards.yellow} jaunes, ${stats.cards.red} rouges`,
      ],
      threshold_reached: rec.probability >= 0.72,
    });
  }

  // ===== BTTS (Les deux équipes marquent) =====
  if (timeElapsed >= 45) {
    const homeSOT = stats.shotsOnTarget.home;
    const awaySOT = stats.shotsOnTarget.away;

    // Si les deux équipes ont des tirs cadrés et pas encore marqué
    if (homeSOT >= 2 && awaySOT >= 2) {
      const homeScored = currentScore.home > 0;
      const awayScored = currentScore.away > 0;

      if (!homeScored || !awayScored) {
        const possDiff = Math.abs(stats.possession.home - stats.possession.away);
        const isBalanced = possDiff < 15;

        let probability = 0.55;
        const reasoning: string[] = [];

        if (isBalanced) {
          probability += 0.10;
          reasoning.push(`⚖️ Match équilibré (${stats.possession.home}%-${stats.possession.away}%)`);
        }

        if (homeSOT >= 3 && !homeScored) {
          probability += 0.08;
          reasoning.push(`🏠 Domicile: ${homeSOT} tirs cadrés sans but`);
        }

        if (awaySOT >= 3 && !awayScored) {
          probability += 0.08;
          reasoning.push(`✈️ Extérieur: ${awaySOT} tirs cadrés sans but`);
        }

        if (probability >= 0.65 && reasoning.length > 0) {
          recommendations.push({
            bet_type: 'BOTH_TEAMS_SCORE',
            description: 'Les 2 équipes marquent',
            confidence: getConfidence(probability),
            probability: Math.round(probability * 100),
            reasoning,
            threshold_reached: probability >= 0.70,
          });
        }
      }
    }
  }

  // Trier par probabilité décroissante
  recommendations.sort((a, b) => b.probability - a.probability);

  return recommendations;
};

export default analyzeMatchAdvanced;
