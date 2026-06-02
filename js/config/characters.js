const { getSkillById } = require("./skills");

/**
 * 唯一主角的数值、立绘和默认技能配置。
 */
const MAIN_CHARACTER = {
  id: "main-character",
  name: "红色主角",
  hp: 120,
  atk: 18,
  spd: 175,
  color: "#e63b61",
  sprite: "hero-main-character",
  skill: getSkillById("wave")
};

module.exports = MAIN_CHARACTER;
