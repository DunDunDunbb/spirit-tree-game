const COSMETICS = [
  {
    id: "streetwear",
    name: "墨镜潮服",
    type: "skin",
    price: 120,
    sprite: "hero-skin-streetwear",
    color: "#f1bf62",
    bonus: { atk: 8, crit: 6 },
    bonusText: "攻击 +8 · 会心 +6%"
  },
  {
    id: "wuxia",
    name: "云水侠衣",
    type: "skin",
    price: 180,
    sprite: "hero-skin-wuxia",
    color: "#78c9ff",
    bonus: { hp: 55, dodge: 6 },
    bonusText: "气血 +55 · 闪避 +6%"
  },
  {
    id: "royal",
    name: "金冠礼服",
    type: "skin",
    price: 260,
    sprite: "hero-skin-royal",
    color: "#ffd86b",
    bonus: { atk: 12, hp: 35 },
    bonusText: "攻击 +12 · 气血 +35"
  },
  {
    id: "bunny",
    name: "月兔礼装",
    type: "skin",
    price: 220,
    sprite: "hero-skin-bunny",
    color: "#e5b8ff",
    bonus: { spd: 30, combo: 8 },
    bonusText: "速度 +30 · 连击 +8%"
  },
  {
    id: "nurse",
    name: "治愈护士",
    type: "skin",
    price: 240,
    sprite: "hero-skin-nurse",
    color: "#ff9fb0",
    bonus: { hp: 80, lifesteal: 6 },
    bonusText: "气血 +80 · 吸血 +6%"
  },
  {
    id: "bocchi-shirt",
    name: "孤独摇滚痛衣",
    type: "skin",
    price: 300,
    sprite: "hero-skin-bocchi-shirt",
    color: "#ff9bc3",
    bonus: { atk: 10, spd: 24, crit: 5 },
    bonusText: "攻击 +10 · 速度 +24 · 会心 +5%"
  }
];

function getCosmeticById(id) {
  return COSMETICS.find((item) => item.id === id);
}

module.exports = { COSMETICS, getCosmeticById };
