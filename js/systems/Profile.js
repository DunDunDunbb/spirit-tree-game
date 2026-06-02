const { SLOTS, EQUIPMENT_CATALOG, getCatalogTotal } = require("../config/equipment");
const { getRealm } = require("../config/realms");
const { SKILLS, getSkillById } = require("../config/skills");
const { COSMETICS, getCosmeticById } = require("../config/cosmetics");

class Profile {
  constructor(character, saved = {}) {
    this.character = {
      ...character,
      name: saved.characterName || character.name,
      skill: getSkillById(saved.skillId || character.skill.id)
    };
    this.treeLevel = saved.treeLevel || 1;
    this.treeExp = saved.treeExp || 0;
    this.peaches = saved.peaches === undefined ? 30 : saved.peaches;
    this.coins = saved.coins || 0;
    this.cultivation = saved.cultivation || 0;
    this.stage = saved.stage || 1;
    this.equipment = saved.equipment || {};
    this.discovered = saved.discovered || {};
    this.exploreEnergy = saved.exploreEnergy === undefined ? 5 : saved.exploreEnergy;
    this.exploreCount = saved.exploreCount || 0;
    this.tutorialCompleted = Boolean(saved.tutorialCompleted);
    this.ownedCosmetics = saved.ownedCosmetics || {};
    this.equippedCosmetics = saved.equippedCosmetics || {};
    this.pvpWins = saved.pvpWins || 0;
    this.pvpLosses = saved.pvpLosses || 0;
    this.rankScore = saved.rankScore === undefined ? 1000 : saved.rankScore;
    this.isMaxTestAccount = typeof wx !== "undefined" && typeof wx.getCurrentAccount === "function" && wx.getCurrentAccount() === "tester_max";
    if (this.isMaxTestAccount) this.applyMaxTestPreset();
  }

  get treeExpRequired() {
    return 5 + this.treeLevel * 2;
  }

  applyMaxTestPreset() {
    this.character.name = "满级测试员";
    this.character.hp = 99_999_999;
    this.character.atk = 99_999_999;
    this.character.spd = 99_999;
    this.treeLevel = 999;
    this.treeExp = 0;
    this.peaches = 99_999_999;
    this.coins = 99_999_999;
    this.cultivation = 99_999_999;
    this.stage = Math.max(this.stage, 1);
    this.rankScore = 9_999_999;
    this.pvpWins = Math.max(this.pvpWins, 9999);
    this.pvpLosses = 0;
    this.tutorialCompleted = true;
    SLOTS.forEach((slot, index) => {
      this.equipment[slot.id] = {
        id: `tester-max-${slot.id}`,
        catalogId: `${slot.id}-11`,
        slot: slot.id,
        slotName: slot.name,
        icon: slot.icon,
        rarity: "legend",
        rarityName: "神品",
        color: "#f5b041",
        name: `内测·${EQUIPMENT_CATALOG[slot.id][11]}`,
        setId: "thunder",
        setName: "苍雷套装",
        setColor: "#b69cff",
        trait: index % 2 ? "combo" : "crit",
        traitName: index % 2 ? "连击" : "会心",
        traitValue: 999,
        hp: 9_999_999,
        atk: 9_999_999,
        spd: 99_999,
        power: 999_999_999,
        price: 999_999,
        enhanceLevel: 15
      };
    });
  }

  setCharacterName(name) {
    const normalized = String(name || "").trim().slice(0, 8);
    if (normalized) this.character.name = normalized;
  }

  setSkill(skillId) {
    const skill = SKILLS.find((entry) => entry.id === skillId);
    if (!skill) return false;
    this.character.skill = skill;
    return true;
  }

  getSkills() {
    return SKILLS.map((skill) => ({
      ...skill,
      selected: skill.id === this.character.skill.id
    }));
  }

  getStats() {
    const stats = {
      hp: this.character.hp,
      atk: this.character.atk,
      spd: this.character.spd,
      crit: 10,
      dodge: 4,
      combo: 6,
      lifesteal: 0,
      counter: 0
    };
    const setCounts = {};
    Object.values(this.equipment).forEach((item) => {
      const strengthen = 1 + (item.enhanceLevel || 0) * 0.08;
      stats.hp += Math.round(item.hp * strengthen);
      stats.atk += Math.round(item.atk * strengthen);
      stats.spd += Math.round(item.spd * strengthen);
      if (item.trait && stats[item.trait] !== undefined) {
        stats[item.trait] += item.traitValue || 0;
      }
      if (item.setId) {
        setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
      }
    });
    Object.values(setCounts).forEach((count) => {
      if (count >= 2) {
        stats.hp += count * 10;
        stats.atk += count * 3;
      }
      if (count >= 4) {
        stats.crit += 6;
        stats.combo += 6;
      }
    });
    this.getEquippedCosmetics().forEach((item) => {
      Object.entries(item.bonus || {}).forEach(([stat, value]) => {
        if (stats[stat] !== undefined) stats[stat] += value;
      });
    });
    stats.power = stats.atk * 20 + stats.hp * 3 + stats.spd * 4 + this.cultivation;
    return stats;
  }

  getEquipmentComparison(item) {
    if (!item) return null;
    const current = this.getEquipped(item.slot);
    const baseline = current || { hp: 0, atk: 0, spd: 0, traitValue: 0, power: 0 };
    return {
      current,
      currentPower: baseline.power || 0,
      currentName: current ? current.name : "未装备",
      deltas: {
        hp: item.hp - baseline.hp,
        atk: item.atk - baseline.atk,
        spd: item.spd - baseline.spd,
        traitValue: (item.traitValue || 0) - (baseline.traitValue || 0)
      },
      powerDelta: item.power - (baseline.power || 0),
      traitChanged: Boolean(current && current.trait !== item.trait)
    };
  }

  equip(item) {
    this.equipment[item.slot] = item;
    this.discover(item);
  }

  getEquipped(slot) {
    return this.equipment[slot];
  }

  getEnhanceCost(slot) {
    const item = this.getEquipped(slot);
    if (!item) return 0;
    return Math.round(16 + (item.enhanceLevel || 0) * 14 + item.power * 0.035);
  }

  getEnhanceChance(slot) {
    const item = this.getEquipped(slot);
    if (!item) return 0;
    const level = item.enhanceLevel || 0;
    if (level >= 15) return 0;
    const rarityPenalty = {
      common: 0,
      rare: 3,
      epic: 6,
      legend: 10
    }[item.rarity] || 0;
    const chance = 95 - level * 4 - Math.floor(level / 3) * 4 - rarityPenalty;
    return Math.max(28, Math.min(95, chance));
  }

  enhanceEquipment(slot) {
    const item = this.getEquipped(slot);
    if (!item) return { ok: false, reason: "missing" };
    const level = item.enhanceLevel || 0;
    if (level >= 15) return { ok: false, reason: "max", item };
    const cost = this.getEnhanceCost(slot);
    if (this.coins < cost) return { ok: false, reason: "coins", cost, item };
    const chance = this.getEnhanceChance(slot);
    const success = Math.random() * 100 < chance;
    const paid = success ? cost : Math.max(1, Math.round(cost * 0.4));
    this.coins -= paid;
    if (success) item.enhanceLevel = level + 1;
    return { ok: success, reason: success ? "success" : "failed", cost, paid, chance, item };
  }

  recordPvpResult(victory) {
    if (victory) {
      this.pvpWins += 1;
      this.rankScore += 24;
    } else {
      this.pvpLosses += 1;
      this.rankScore = Math.max(0, this.rankScore - 12);
    }
  }

  chopTree() {
    if (this.peaches <= 0) {
      return false;
    }
    this.peaches -= 1;
    this.treeExp += 1;
    this.cultivation += 4 + Math.floor(Math.random() * 5);
    if (this.treeExp >= this.treeExpRequired) {
      this.treeExp = 0;
      this.treeLevel += 1;
      this.peaches += 4;
    }
    return true;
  }

  discover(item) {
    if (item && item.catalogId) {
      this.discovered[item.catalogId] = true;
    }
  }

  explore() {
    if (this.exploreEnergy <= 0) return false;
    this.exploreEnergy -= 1;
    this.exploreCount += 1;
    return true;
  }

  restoreExploreEnergy(amount = 1) {
    this.exploreEnergy = Math.min(8, this.exploreEnergy + amount);
  }

  getCollectionProgress() {
    return {
      found: Object.keys(this.discovered).length,
      total: getCatalogTotal()
    };
  }

  getCollectionSection(page = 0) {
    const pageCount = SLOTS.length;
    const pageIndex = ((page % pageCount) + pageCount) % pageCount;
    const slot = SLOTS[pageIndex];
    const items = EQUIPMENT_CATALOG[slot.id].map((name, index) => ({
      name,
      found: Boolean(this.discovered[`${slot.id}-${index}`])
    }));
    return {
      page: pageIndex,
      pageCount,
      slot,
      items,
      found: items.filter((item) => item.found).length
    };
  }

  getRealm() {
    return getRealm(this.cultivation);
  }

  getCosmetics() {
    return COSMETICS.map((item) => ({
      ...item,
      owned: Boolean(this.ownedCosmetics[item.id]),
      equipped: this.equippedCosmetics[item.type] === item.id
    }));
  }

  unlockCosmetic(id) {
    const item = getCosmeticById(id);
    if (!item) return null;
    this.ownedCosmetics[id] = true;
    return item;
  }

  buyOrEquipCosmetic(id) {
    const item = getCosmeticById(id);
    if (!item) return { ok: false, reason: "missing" };
    if (!this.ownedCosmetics[id]) {
      if (this.coins < item.price) return { ok: false, reason: "coins", item };
      this.coins -= item.price;
      this.ownedCosmetics[id] = true;
    }
    this.equippedCosmetics[item.type] = id;
    return { ok: true, item };
  }

  getEquippedCosmetics() {
    return Object.values(this.equippedCosmetics)
      .map((id) => getCosmeticById(id))
      .filter(Boolean);
  }

  toJSON() {
    return {
      characterId: this.character.id,
      characterName: this.character.name,
      skillId: this.character.skill.id,
      treeLevel: this.treeLevel,
      treeExp: this.treeExp,
      peaches: this.peaches,
      coins: this.coins,
      cultivation: this.cultivation,
      stage: this.stage,
      equipment: this.equipment,
      discovered: this.discovered,
      exploreEnergy: this.exploreEnergy,
      exploreCount: this.exploreCount,
      tutorialCompleted: this.tutorialCompleted
      ,
      ownedCosmetics: this.ownedCosmetics,
      equippedCosmetics: this.equippedCosmetics
      ,
      pvpWins: this.pvpWins,
      pvpLosses: this.pvpLosses,
      rankScore: this.rankScore
    };
  }

  getEquipmentList() {
    return SLOTS.map((slot) => ({ ...slot, item: this.equipment[slot.id] }));
  }
}

module.exports = Profile;
