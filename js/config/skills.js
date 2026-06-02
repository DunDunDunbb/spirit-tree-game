const SKILLS = [
  {
    id: "wave",
    name: "裂空冲击",
    type: "wave",
    color: "#f0647f",
    cooldown: 4,
    multiplier: 1.72,
    description: "剑气震荡，攻守均衡"
  },
  {
    id: "flame",
    name: "焚星火雨",
    type: "flame",
    color: "#ff9b54",
    cooldown: 4.8,
    multiplier: 2.08,
    description: "火雨坠落，高额爆发"
  },
  {
    id: "thunder",
    name: "九霄雷引",
    type: "thunder",
    color: "#b997ff",
    cooldown: 3.2,
    multiplier: 1.45,
    description: "雷光连闪，释放最快"
  },
  {
    id: "frost",
    name: "霜华绽放",
    type: "frost",
    color: "#8fdcff",
    cooldown: 5.4,
    multiplier: 2.42,
    description: "寒气爆裂，单次最痛"
  },
  {
    id: "orbit",
    name: "星河剑阵",
    type: "orbit",
    color: "#83e8c5",
    cooldown: 3.8,
    multiplier: 1.64,
    description: "灵剑环绕，稳定压制"
  },
  {
    id: "poison",
    name: "蚀骨毒雾",
    type: "poison",
    color: "#9be36d",
    cooldown: 4.4,
    multiplier: 1.9,
    description: "毒雾侵蚀，适合拉扯"
  },
  {
    id: "bomb",
    name: "灵爆符阵",
    type: "bomb",
    color: "#ffd166",
    cooldown: 5.1,
    multiplier: 2.32,
    description: "符阵爆开，重击爆发"
  },
  {
    id: "dash",
    name: "追风瞬斩",
    type: "wave",
    color: "#7ee7ff",
    cooldown: 2.7,
    multiplier: 1.28,
    description: "短冷却连斩，节奏很快"
  },
  {
    id: "nova",
    name: "玄光星爆",
    type: "orbit",
    color: "#f2a7ff",
    cooldown: 6.2,
    multiplier: 2.85,
    description: "长蓄力大招，爆发最高"
  },
  {
    id: "heal",
    name: "回春灵印",
    type: "frost",
    color: "#8dffbe",
    cooldown: 4.9,
    multiplier: 1.52,
    description: "低伤害稳循环，适合持久战"
  },
  {
    id: "volley",
    name: "月影连射",
    type: "thunder",
    color: "#ffe08a",
    cooldown: 3.5,
    multiplier: 1.58,
    description: "连续飞矢，平衡输出"
  },
  {
    id: "meteor",
    name: "陨星坠",
    type: "flame",
    color: "#ff6f61",
    cooldown: 5.8,
    multiplier: 2.62,
    description: "慢速重击，适合赌暴击"
  }
];

function getSkillById(skillId) {
  return SKILLS.find((skill) => skill.id === skillId) || SKILLS[0];
}

module.exports = { SKILLS, getSkillById };
