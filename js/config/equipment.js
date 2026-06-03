const SLOTS = [
  { id: "weapon", name: "武器", icon: "刃" },
  { id: "armor", name: "护甲", icon: "甲" },
  { id: "ring", name: "戒指", icon: "戒" },
  { id: "boots", name: "靴子", icon: "靴" },
  { id: "talisman", name: "法宝", icon: "符" },
  { id: "jade", name: "灵玉", icon: "玉" }
];

const RARITIES = [
  { id: "common", name: "凡品", color: "#b5c1ce", factor: 1 },
  { id: "fine", name: "良品", color: "#58d68d", factor: 1.34 },
  { id: "rare", name: "珍品", color: "#5dade2", factor: 1.78 },
  { id: "epic", name: "仙品", color: "#bb8fce", factor: 2.32 },
  { id: "legend", name: "神品", color: "#f5b041", factor: 3.05 }
];

const SETS = [
  { id: "cloud", name: "流云套装", color: "#82d8ff" },
  { id: "thunder", name: "苍雷套装", color: "#b69cff" },
  { id: "flame", name: "赤焰套装", color: "#ff9c68" },
  { id: "moon", name: "月影套装", color: "#c8b8ff" },
  { id: "spring", name: "灵泉套装", color: "#8ce0ae" }
];

const EQUIPMENT_CATALOG = {
  weapon: ["青锋问道剑", "流云逐月刃", "玄铁镇妖刀", "苍雷惊鸿枪", "赤焰焚心剑", "月影无痕匕", "灵泉听雨剑", "星河落尘杖", "归墟断岳斧", "太虚照夜戟", "扶摇破风弓", "九霄御雷剑"],
  armor: ["青岚护心袍", "流云鹤氅", "玄铁镇山甲", "苍雷耀衣", "赤焰焚天铠", "月影夜行衣", "灵泉长生袍", "星河琉璃甲", "归墟玄武铠", "太虚无垢衣", "扶摇轻羽衣", "九霄云纹甲"],
  ring: ["青木纳灵戒", "流云藏风戒", "玄铁定岳环", "苍雷引电戒", "赤焰离火戒", "月影匿踪环", "灵泉回春戒", "星河照命环", "归墟噬灵戒", "太虚须弥环", "扶摇御风戒", "九霄紫电环"],
  boots: ["青岚踏叶靴", "流云追月履", "玄铁镇岳靴", "苍雷逐电履", "赤焰踏风靴", "月影无声履", "灵泉渡水靴", "星河踏斗履", "归墟破浪靴", "太虚凌空履", "扶摇乘风靴", "九霄登云履"],
  talisman: ["青木养魂符", "流云八卦盘", "玄铁镇妖塔", "苍雷引劫印", "赤焰离火珠", "月影摄魂灯", "灵泉净心瓶", "星河琉璃镜", "归墟吞海印", "太虚镇坛幡", "扶摇御风幡", "九霄雷纹鼎"],
  jade: ["青木长生玉", "流云自在珮", "玄铁镇心佩", "苍雷惊蛰玉", "赤焰暖阳珏", "月影幽梦佩", "灵泉回春玉", "星河照命珏", "归墟玄冥佩", "太虚无相玉", "扶摇清风珮", "九霄紫霄佩"]
};

const TRAITS = [
  { id: "crit", name: "会心", color: "#ffb55e" },
  { id: "dodge", name: "闪避", color: "#7edbff" },
  { id: "combo", name: "连击", color: "#a8ec83" },
  { id: "lifesteal", name: "吸血", color: "#ef7b91" },
  { id: "counter", name: "反击", color: "#d0a5ff" }
];

function pickRarity(treeLevel) {
  const roll = Math.random() + Math.min(treeLevel, 30) * 0.008;
  if (roll > 1.06) return RARITIES[4];
  if (roll > 0.87) return RARITIES[3];
  if (roll > 0.62) return RARITIES[2];
  if (roll > 0.31) return RARITIES[1];
  return RARITIES[0];
}

function getItemPower(item) {
  return item.atk * 20 + item.hp * 3 + item.spd * 4 + (item.traitValue || 0) * 24;
}

const RARITY_INDEX = RARITIES.reduce((map, rarity, index) => {
  map[rarity.id] = index;
  return map;
}, {});

function getRarityByIndex(index) {
  const safeIndex = Math.max(0, Math.min(RARITIES.length - 1, index));
  return RARITIES[safeIndex];
}

function getSynthesisCandidate(items) {
  if (!Array.isArray(items) || items.length < 3) return null;
  const groups = new Map();
  items.forEach((item) => {
    if (!item || !item.slot) return;
    const group = groups.get(item.slot) || [];
    group.push(item);
    groups.set(item.slot, group);
  });

  let best = null;
  groups.forEach((groupItems, slot) => {
    if (groupItems.length < 3) return;
    const materials = [...groupItems]
      .sort((left, right) => getItemPower(left) - getItemPower(right) || (left.price || 0) - (right.price || 0))
      .slice(0, 3);
    const product = synthesizeEquipment(materials);
    if (!product) return;
    const score = product.power + materials.reduce((total, item) => total + getItemPower(item), 0) * 0.05;
    if (!best || score > best.score) {
      best = { slot, materials, product, score };
    }
  });
  return best;
}

function synthesizeEquipment(materials) {
  if (!Array.isArray(materials) || materials.length < 3) return null;
  const slot = materials[0] && materials[0].slot;
  if (!slot || !materials.every((item) => item && item.slot === slot)) return null;

  const sorted = [...materials].sort((left, right) => getItemPower(right) - getItemPower(left));
  const base = sorted[0];
  const rarityIndex = RARITY_INDEX[base.rarity] ?? 0;
  const sameRarity = materials.every((item) => item.rarity === base.rarity);
  const upgradedIndex = sameRarity ? Math.min(RARITIES.length - 1, rarityIndex + 1) : rarityIndex;
  const rarity = getRarityByIndex(upgradedIndex);
  const totalPower = materials.reduce((total, item) => total + getItemPower(item), 0);
  const averagePower = totalPower / materials.length;
  const totalPrice = materials.reduce((total, item) => total + (item.price || 0), 0);
  const growth = 1 + Math.max(0, materials.length - 3) * 0.05 + (upgradedIndex > rarityIndex ? 0.12 : 0);
  const bonus = Math.round(averagePower * 0.18 + materials.length * 9);
  const scaleStat = (value, factor) => Math.max(1, Math.round(value * growth + bonus * factor));

  const item = {
    ...base,
    id: `fusion-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    catalogId: `${base.catalogId || base.slot}-fusion`,
    rarity: rarity.id,
    rarityName: rarity.name,
    color: rarity.color,
    name: `炼化·${base.name}`,
    fused: true,
    fusedCount: materials.length,
    hp: scaleStat(base.hp, 0.42),
    atk: scaleStat(base.atk, 0.38),
    spd: scaleStat(base.spd, 0.24),
    traitValue: Math.max(base.traitValue || 0, Math.round((base.traitValue || 0) * growth + materials.length * 2)),
    price: Math.max(base.price || 1, Math.round(totalPrice * 0.62 + averagePower * 0.08))
  };
  item.power = getItemPower(item);
  return item;
}

function createEquipment(treeLevel) {
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
  const rarity = pickRarity(treeLevel);
  const names = EQUIPMENT_CATALOG[slot.id];
  const catalogIndex = Math.floor(Math.random() * names.length);
  const set = SETS[catalogIndex % SETS.length];
  const trait = TRAITS[(catalogIndex + treeLevel) % TRAITS.length];
  const base = Math.max(1, Math.round((3 + treeLevel * 1.58) * rarity.factor));
  const traitValue = Math.max(1, Math.round((2 + treeLevel * 0.34) * rarity.factor));
  const item = {
    id: `${slot.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    catalogId: `${slot.id}-${catalogIndex}`,
    slot: slot.id,
    slotName: slot.name,
    icon: slot.icon,
    rarity: rarity.id,
    rarityName: rarity.name,
    color: rarity.color,
    name: names[catalogIndex],
    setId: set.id,
    setName: set.name,
    setColor: set.color,
    trait: trait.id,
    traitName: trait.name,
    traitValue,
    hp: slot.id === "armor" || slot.id === "jade" ? base * 5 : base * 2,
    atk: slot.id === "weapon" || slot.id === "talisman" ? base * 2 : base,
    spd: slot.id === "boots" || slot.id === "ring" ? Math.max(1, Math.round(base * 0.8)) : Math.max(1, Math.round(base * 0.35)),
    price: Math.max(2, Math.round(base * rarity.factor))
  };
  item.power = getItemPower(item);
  return item;
}

function createFixedEquipment(options = {}) {
  const slotId = options.slot;
  const slot = SLOTS.find((entry) => entry.id === slotId);
  if (!slot) return null;
  const catalog = EQUIPMENT_CATALOG[slot.id] || [];
  const catalogIndex = Math.max(0, Math.min(catalog.length - 1, Number(options.catalogIndex) || 0));
  const rarity = RARITIES.find((entry) => entry.id === options.rarity) || RARITIES[RARITY_INDEX.legend];
  const set = SETS.find((entry) => entry.id === options.setId) || SETS[catalogIndex % SETS.length];
  const trait = TRAITS.find((entry) => entry.id === options.trait) || TRAITS[catalogIndex % TRAITS.length];
  const treeLevel = Math.max(1, Number(options.treeLevel) || 12);
  const base = Math.max(1, Math.round((4 + treeLevel * 1.72) * rarity.factor));
  const traitValue = Math.max(1, Math.round((3 + treeLevel * 0.45) * rarity.factor));
  const item = {
    id: options.id || `${slot.id}-reward-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    catalogId: options.catalogId || `${slot.id}-${catalogIndex}`,
    slot: slot.id,
    slotName: slot.name,
    icon: slot.icon,
    rarity: rarity.id,
    rarityName: rarity.name,
    color: rarity.color,
    name: options.name || catalog[catalogIndex],
    setId: set.id,
    setName: set.name,
    setColor: set.color,
    trait: trait.id,
    traitName: trait.name,
    traitValue: options.traitValue || traitValue,
    hp: options.hp || (slot.id === "armor" || slot.id === "jade" ? base * 6 : base * 3),
    atk: options.atk || (slot.id === "weapon" || slot.id === "talisman" ? base * 3 : Math.round(base * 1.2)),
    spd: options.spd || (slot.id === "boots" || slot.id === "ring" ? Math.max(1, Math.round(base)) : Math.max(1, Math.round(base * 0.45))),
    price: options.price || Math.max(8, Math.round(base * rarity.factor * 1.8)),
    enhanceLevel: Math.max(0, Number(options.enhanceLevel) || 0),
    style: options.style || ""
  };
  item.power = getItemPower(item);
  return item;
}

function getCatalogTotal() {
  return Object.values(EQUIPMENT_CATALOG).reduce((total, names) => total + names.length, 0);
}

module.exports = {
  SLOTS,
  RARITIES,
  SETS,
  TRAITS,
  EQUIPMENT_CATALOG,
  createEquipment,
  createFixedEquipment,
  getItemPower,
  getCatalogTotal,
  getSynthesisCandidate,
  synthesizeEquipment
};
