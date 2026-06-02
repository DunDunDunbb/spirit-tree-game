const BOSSES = [
  {
    id: "crimson-demon",
    name: "赤角魔君",
    title: "焚山妖王",
    type: "imp",
    accent: "#ff684f",
    aura: "#ffae59",
    ornament: "horns",
    scale: 1.18,
    hpFactor: 1.08,
    atkFactor: 1.04
  },
  {
    id: "stone-general",
    name: "玄岩战将",
    title: "镇岳妖王",
    type: "brute",
    accent: "#d5a56b",
    aura: "#ffe08a",
    ornament: "crown",
    scale: 1.22,
    hpFactor: 1.2,
    atkFactor: 0.98
  },
  {
    id: "nether-lantern",
    name: "幽冥灯使",
    title: "噬魂妖王",
    type: "wisp",
    accent: "#aa83ff",
    aura: "#e1b4ff",
    ornament: "halo",
    scale: 1.16,
    hpFactor: 0.98,
    atkFactor: 1.16
  },
  {
    id: "frost-beast",
    name: "霜牙巨兽",
    title: "寒渊妖王",
    type: "brute",
    accent: "#82d7ff",
    aura: "#d6f5ff",
    ornament: "fangs",
    scale: 1.25,
    hpFactor: 1.14,
    atkFactor: 1.08
  },
  {
    id: "storm-fiend",
    name: "紫电邪君",
    title: "雷狱妖王",
    type: "imp",
    accent: "#b88aff",
    aura: "#e1c7ff",
    ornament: "lightning",
    scale: 1.2,
    hpFactor: 1.05,
    atkFactor: 1.18
  },
  {
    id: "moon-specter",
    name: "月蚀幽主",
    title: "暗月妖王",
    type: "wisp",
    accent: "#7f8cff",
    aura: "#c8ceff",
    ornament: "moon",
    scale: 1.2,
    hpFactor: 1.08,
    atkFactor: 1.1
  },
  {
    id: "blade-mantis",
    name: "千刃妖侯",
    title: "断空妖王",
    type: "imp",
    accent: "#80e6c4",
    aura: "#c9ffed",
    ornament: "blades",
    scale: 1.22,
    hpFactor: 1.02,
    atkFactor: 1.2
  },
  {
    id: "lotus-oracle",
    name: "业火莲尊",
    title: "红莲妖王",
    type: "wisp",
    accent: "#ff7290",
    aura: "#ffc0cf",
    ornament: "petals",
    scale: 1.2,
    hpFactor: 1.12,
    atkFactor: 1.08
  },
  {
    id: "flame-titan",
    name: "熔岩巨灵",
    title: "炼狱妖王",
    type: "brute",
    accent: "#ff8a45",
    aura: "#ffd078",
    ornament: "flames",
    scale: 1.28,
    hpFactor: 1.22,
    atkFactor: 1.02
  },
  {
    id: "rune-keeper",
    name: "古符镇守",
    title: "秘境妖王",
    type: "brute",
    accent: "#72c8ff",
    aura: "#c7edff",
    ornament: "runes",
    scale: 1.24,
    hpFactor: 1.18,
    atkFactor: 1.04
  },
  {
    id: "bone-shaman",
    name: "白骨祭司",
    title: "荒冢妖王",
    type: "wisp",
    accent: "#d6dfb7",
    aura: "#f6ffd9",
    ornament: "skulls",
    scale: 1.18,
    hpFactor: 1.06,
    atkFactor: 1.16
  },
  {
    id: "sky-dragon",
    name: "苍穹龙影",
    title: "天劫妖王",
    type: "imp",
    accent: "#ffe174",
    aura: "#fff4b0",
    ornament: "wings",
    scale: 1.26,
    hpFactor: 1.14,
    atkFactor: 1.14
  },
  {
    id: "crystal-emperor",
    name: "玄晶帝兽",
    title: "冰魄妖王",
    type: "brute",
    accent: "#73f0ff",
    aura: "#d0fbff",
    sprite: "boss-crystal-emperor",
    ornament: "none",
    scale: 1.26,
    hpFactor: 1.16,
    atkFactor: 1.06
  },
  {
    id: "abyss-seer",
    name: "深渊瞳主",
    title: "无光妖王",
    type: "wisp",
    accent: "#955cff",
    aura: "#d7b9ff",
    sprite: "boss-abyss-seer",
    ornament: "none",
    scale: 1.2,
    hpFactor: 1.08,
    atkFactor: 1.16
  },
  {
    id: "venom-scorpion",
    name: "碧毒蝎后",
    title: "万蛊妖王",
    type: "imp",
    accent: "#94e55c",
    aura: "#d6ff9c",
    ornament: "stingers",
    scale: 1.22,
    hpFactor: 1.1,
    atkFactor: 1.12
  },
  {
    id: "time-reaper",
    name: "岁蚀冥使",
    title: "流沙妖王",
    type: "wisp",
    accent: "#e9bd68",
    aura: "#ffe4a8",
    ornament: "hourglass",
    scale: 1.2,
    hpFactor: 1.1,
    atkFactor: 1.14
  },
  {
    id: "chain-warden",
    name: "锁魂狱将",
    title: "铁狱妖王",
    type: "brute",
    accent: "#b6c5d9",
    aura: "#e5efff",
    ornament: "chains",
    scale: 1.26,
    hpFactor: 1.22,
    atkFactor: 1.02
  },
  {
    id: "sun-crow",
    name: "金乌炎君",
    title: "烈阳妖王",
    type: "imp",
    accent: "#ffcb4d",
    aura: "#fff0a3",
    sprite: "boss-sun-crow",
    ornament: "none",
    scale: 1.24,
    hpFactor: 1.06,
    atkFactor: 1.2
  },
  {
    id: "vine-queen",
    name: "青藤妖后",
    title: "森罗妖王",
    type: "wisp",
    accent: "#66d48a",
    aura: "#c2f8cf",
    sprite: "boss-vine-queen",
    ornament: "none",
    scale: 1.2,
    hpFactor: 1.14,
    atkFactor: 1.08
  },
  {
    id: "masked-lord",
    name: "百面邪君",
    title: "迷魂妖王",
    type: "imp",
    accent: "#f18ee6",
    aura: "#ffd1fa",
    ornament: "masks",
    scale: 1.22,
    hpFactor: 1.08,
    atkFactor: 1.16
  }
];

function getBossForStage(stage) {
  const bossIndex = Math.max(0, Math.floor(stage / 5) - 1);
  return BOSSES[bossIndex % BOSSES.length];
}

module.exports = { BOSSES, getBossForStage };
