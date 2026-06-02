function getStageMultiplier(stage) {
  const completedStages = Math.max(0, stage - 1);
  const earlyStages = Math.min(10, completedStages);
  const middleStages = Math.min(10, Math.max(0, completedStages - 10));
  const lateStages = Math.max(0, completedStages - 20);
  return Math.pow(1.14, earlyStages) *
    Math.pow(1.105, middleStages) *
    Math.pow(1.09, lateStages);
}

function getBattleMultiplier(stage, isBoss) {
  return getStageMultiplier(stage) * (isBoss ? 1.34 : 1);
}

function getEnemyAttackMultiplier(stage, isBoss) {
  return Math.pow(getStageMultiplier(stage), 0.72) * (isBoss ? 1.18 : 1);
}

module.exports = { getStageMultiplier, getBattleMultiplier, getEnemyAttackMultiplier };
