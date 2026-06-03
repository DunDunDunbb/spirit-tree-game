const COSMETICS = [
  {
    id: "streetwear",
    name: "墨镜潮服",
    type: "skin",
    price: 120,
    sprite: "hero-skin-streetwear",
    color: "#f1bf62",
    bonus: { atk: 8, crit: 6 },
    bonusText: "攻击 +8  暴击 +6%"
  },
  {
    id: "wuxia",
    name: "云水侠衣",
    type: "skin",
    price: 180,
    sprite: "hero-skin-wuxia",
    color: "#78c9ff",
    bonus: { hp: 55, dodge: 6 },
    bonusText: "气血 +55  闪避 +6%"
  },
  {
    id: "royal",
    name: "金冠礼服",
    type: "skin",
    price: 260,
    sprite: "hero-skin-royal",
    color: "#ffd86b",
    bonus: { atk: 12, hp: 35 },
    bonusText: "攻击 +12  气血 +35"
  },
  {
    id: "bunny",
    name: "月兔礼装",
    type: "skin",
    price: 220,
    sprite: "hero-skin-bunny",
    color: "#e5b8ff",
    bonus: { spd: 30, combo: 8 },
    bonusText: "速度 +30  连击 +8%"
  },
  {
    id: "nurse",
    name: "治疗护士",
    type: "skin",
    price: 240,
    sprite: "hero-skin-nurse",
    color: "#ff9fb0",
    bonus: { hp: 80, lifesteal: 6 },
    bonusText: "气血 +80  吸血 +6%"
  },
  {
    id: "bocchi-shirt",
    name: "孤独摇滚T恤",
    type: "skin",
    price: 300,
    sprite: "hero-skin-bocchi-shirt",
    color: "#ff9bc3",
    bonus: { atk: 10, spd: 24, crit: 5 },
    bonusText: "攻击 +10  速度 +24  暴击 +5%"
  },
  {
    id: "samurai",
    name: "战国武士",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-samurai",
    color: "#d64b43",
    bonus: { atk: 88, crit: 12 },
    bonusText: "攻击 +88  暴击 +12%"
  },
  {
    id: "cyberpunk",
    name: "霓虹赛博",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-cyberpunk",
    color: "#1ce3ff",
    bonus: { atk: 42, spd: 66, combo: 10 },
    bonusText: "攻击 +42  速度 +66  连击 +10%"
  },
  {
    id: "frost-king",
    name: "极寒冰王",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-frost-king",
    color: "#9fe7ff",
    bonus: { hp: 180, dodge: 10 },
    bonusText: "气血 +180  闪避 +10%"
  },
  {
    id: "magma-warlord",
    name: "熔岩战将",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-magma-warlord",
    color: "#ff7a3c",
    bonus: { atk: 96, lifesteal: 8 },
    bonusText: "攻击 +96  吸血 +8%"
  },
  {
    id: "jade-monk",
    name: "翡翠僧侣",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-jade-monk",
    color: "#55d69c",
    bonus: { hp: 120, counter: 12 },
    bonusText: "气血 +120  反击 +12%"
  },
  {
    id: "desert-pharaoh",
    name: "沙海法老",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-desert-pharaoh",
    color: "#d8b15b",
    bonus: { atk: 52, hp: 108, crit: 8 },
    bonusText: "攻击 +52  气血 +108  暴击 +8%"
  },
  {
    id: "jungle-guardian",
    name: "丛林守卫",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-jungle-guardian",
    color: "#6fc56f",
    bonus: { hp: 140, dodge: 8, combo: 8 },
    bonusText: "气血 +140  闪避 +8%  连击 +8%"
  },
  {
    id: "steampunk",
    name: "蒸汽发明家",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-steampunk",
    color: "#c48d57",
    bonus: { atk: 36, spd: 40, counter: 10 },
    bonusText: "攻击 +36  速度 +40  反击 +10%"
  },
  {
    id: "star-priest",
    name: "星穹祭司",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-star-priest",
    color: "#b6a7ff",
    bonus: { hp: 160, crit: 10, lifesteal: 6 },
    bonusText: "气血 +160  暴击 +10%  吸血 +6%"
  },
  {
    id: "sakura-festival",
    name: "樱花庆典",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-sakura-festival",
    color: "#ff8fb4",
    bonus: { spd: 52, combo: 12 },
    bonusText: "速度 +52  连击 +12%"
  },
  {
    id: "deep-sea-captain",
    name: "深海船长",
    type: "skin",
    price: 99999,
    sprite: "hero-skin-deep-sea-captain",
    color: "#3fc9d8",
    bonus: { atk: 66, hp: 166, dodge: 10 },
    bonusText: "攻击 +66  气血 +166  闪避 +10%"
  }
];

function getCosmeticById(id) {
  return COSMETICS.find((item) => item.id === id);
}

module.exports = { COSMETICS, getCosmeticById };
