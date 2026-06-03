const SCENES = [
  { id: "moon-ruins", name: "月影遗迹", background: "scene-moon", accent: "#81b9ff", particle: "firefly", modifierName: "月华庇佑", heroAttackSpeed: 0.92, enemyAttackSpeed: 1 },
  { id: "bamboo-valley", name: "青竹幽谷", background: "scene-bamboo", accent: "#a9e58e", particle: "leaf", modifierName: "清风迅捷", heroAttackSpeed: 0.82, enemyAttackSpeed: 0.94 },
  { id: "sunset-canyon", name: "赤焰峡谷", background: "scene-canyon", accent: "#ffb36b", particle: "ember", modifierName: "烈焰试炼", heroAttackSpeed: 1, enemyAttackSpeed: 0.82 },
  { id: "snow-shrine", name: "雪山月坛", background: "scene-snow", accent: "#b9e6ff", particle: "snow", modifierName: "霜寒凝滞", heroAttackSpeed: 1.08, enemyAttackSpeed: 1.12 },
  { id: "aurora-lake", name: "极光天沼", background: "scene-aurora", accent: "#8cf8ff", particle: "firefly", modifierName: "灵潮涌动", heroAttackSpeed: 0.9, enemyAttackSpeed: 0.9 }
];

function getSceneForStage(stage) {
  return SCENES[(Math.max(1, stage) - 1) % SCENES.length];
}

module.exports = { SCENES, getSceneForStage };
