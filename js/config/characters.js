const { getSkillById } = require("./skills");

const MAIN_CHARACTER = {
  id: "main-character",
  name: "红衣主角",
  hp: 120,
  atk: 18,
  spd: 175,
  color: "#e63b61",
  sprite: "hero-main-character",
  skill: getSkillById("wave")
};

module.exports = MAIN_CHARACTER;
