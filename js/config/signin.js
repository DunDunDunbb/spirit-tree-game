const { createFixedEquipment } = require("./equipment");

const SIGN_IN_REWARDS = [
  { day: 1, type: "peaches", amount: 12, label: "仙桃x12" },
  { day: 2, type: "coins", amount: 88, label: "灵石x88" },
  { day: 3, type: "cultivation", amount: 120, label: "修为x120" },
  { day: 4, type: "peaches", amount: 18, label: "仙桃x18" },
  { day: 5, type: "coins", amount: 128, label: "灵石x128" },
  { day: 6, type: "cultivation", amount: 180, label: "修为x180" },
  { day: 7, type: "cosmetic", cosmeticId: "streetwear", label: "墨镜潮服" },
  { day: 8, type: "peaches", amount: 24, label: "仙桃x24" },
  { day: 9, type: "coins", amount: 188, label: "灵石x188" },
  {
    day: 10,
    type: "equipment",
    label: "流火追星弓",
    item: () => createFixedEquipment({ slot: "weapon", catalogIndex: 10, rarity: "legend", treeLevel: 16, trait: "crit", traitValue: 18, setId: "moon", name: "流火追星弓", style: "bow", enhanceLevel: 2 })
  },
  { day: 11, type: "cultivation", amount: 240, label: "修为x240" },
  { day: 12, type: "peaches", amount: 26, label: "仙桃x26" },
  { day: 13, type: "coins", amount: 220, label: "灵石x220" },
  { day: 14, type: "cosmetic", cosmeticId: "wuxia", label: "云水侠衣" },
  { day: 15, type: "cultivation", amount: 320, label: "修为x320" },
  { day: 16, type: "coins", amount: 260, label: "灵石x260" },
  { day: 17, type: "peaches", amount: 30, label: "仙桃x30" },
  { day: 18, type: "cultivation", amount: 420, label: "修为x420" },
  { day: 19, type: "coins", amount: 320, label: "灵石x320" },
  {
    day: 20,
    type: "equipment",
    label: "星潮回命镜",
    item: () => createFixedEquipment({ slot: "talisman", catalogIndex: 7, rarity: "legend", treeLevel: 18, trait: "lifesteal", traitValue: 16, setId: "spring", name: "星潮回命镜", style: "staff", enhanceLevel: 3 })
  },
  { day: 21, type: "cosmetic", cosmeticId: "royal", label: "金冠礼服" },
  { day: 22, type: "peaches", amount: 36, label: "仙桃x36" },
  { day: 23, type: "coins", amount: 360, label: "灵石x360" },
  { day: 24, type: "cultivation", amount: 560, label: "修为x560" },
  { day: 25, type: "peaches", amount: 42, label: "仙桃x42" },
  { day: 26, type: "coins", amount: 420, label: "灵石x420" },
  { day: 27, type: "cultivation", amount: 720, label: "修为x720" },
  { day: 28, type: "peaches", amount: 48, label: "仙桃x48" },
  { day: 29, type: "coins", amount: 520, label: "灵石x520" },
  {
    day: 30,
    type: "equipment",
    label: "太虚曜界珏",
    item: () => createFixedEquipment({ slot: "jade", catalogIndex: 9, rarity: "legend", treeLevel: 22, trait: "counter", traitValue: 22, setId: "thunder", name: "太虚曜界珏", enhanceLevel: 5 })
  }
];

function getSignInReward(dayIndex) {
  return SIGN_IN_REWARDS[dayIndex] || null;
}

module.exports = { SIGN_IN_REWARDS, getSignInReward };
