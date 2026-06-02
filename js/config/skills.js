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
    description: "烈焰坠落，造成高额伤害"
  },
  {
    id: "thunder",
    name: "九霄雷引",
    type: "thunder",
    color: "#b997ff",
    cooldown: 3.2,
    multiplier: 1.45,
    description: "雷光连闪，蓄力速度最快"
  },
  {
    id: "frost",
    name: "霜华绽放",
    type: "frost",
    color: "#8fdcff",
    cooldown: 5.4,
    multiplier: 2.42,
    description: "寒气爆裂，单次伤害最高"
  },
  {
    id: "orbit",
    name: "星河剑阵",
    type: "orbit",
    color: "#83e8c5",
    cooldown: 3.8,
    multiplier: 1.64,
    description: "灵剑环绕，持续压制敌人"
  }
];

function getSkillById(skillId) {
  return SKILLS.find((skill) => skill.id === skillId) || SKILLS[0];
}

module.exports = { SKILLS, getSkillById };
