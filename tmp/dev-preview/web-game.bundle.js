(function runGameBundle() {
  const modules = {
    "game.js": function(require, module, exports) {
const Game = require("./js/core/Game");

function showBootError(error) {
  const message = error && error.stack ? error.stack : String(error);
  const panel = document.createElement("pre");
  panel.style.cssText = [
    "position:fixed",
    "inset:16px",
    "z-index:9999",
    "margin:0",
    "padding:16px",
    "border:2px solid #d4a755",
    "border-radius:12px",
    "background:#f7edd7",
    "color:#5c3e25",
    "white-space:pre-wrap",
    "font:14px/1.5 monospace",
    "overflow:auto"
  ].join(";");
  panel.textContent = `游戏启动失败：\n${message}`;
  document.body.appendChild(panel);
}

try {
  const game = new Game();
  game.start();
} catch (error) {
  showBootError(error);
  console.error(error);
}

  },
    "js/core/Game.js": function(require, module, exports) {
const MAIN_CHARACTER = require("../config/characters");
const { createEquipment, getSynthesisCandidate, synthesizeEquipment } = require("../config/equipment");
const { getSceneForStage } = require("../config/scenes");
const { getBossForStage } = require("../config/bosses");
const { getBattleMultiplier, getEnemyAttackMultiplier } = require("../config/difficulty");
const Profile = require("../systems/Profile");
const AudioManager = require("../systems/AudioManager");
const AssetLoader = require("../render/AssetLoader");
const UI = require("../render/UI");
const { COSMETICS } = require("../config/cosmetics");

const GAME_STATE = {
  HOME: "home",
  LOOT: "loot",
  COLLECTION: "collection",
  SKILLS: "skills",
  BATTLE: "battle",
  BATTLE_RESULT: "battle-result",
  SHOP: "shop",
  QUICK_DRAW: "quick-draw",
  RANKING: "ranking",
  PVP: "pvp",
  ENHANCE: "enhance"
};

const STORAGE_KEY = "spirit-tree-profile-v1";
const ENEMIES = [
  { type: "imp", name: "赤角小妖", hp: 84, atk: 12, spd: 42 },
  { type: "brute", name: "山林妖将", hp: 122, atk: 16, spd: 31 },
  { type: "wisp", name: "幽火灵使", hp: 98, atk: 14, spd: 38 }
];

class Game {
  constructor() {
    const systemInfo = wx.getSystemInfoSync();
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext("2d");
    this.width = systemInfo.windowWidth || systemInfo.screenWidth;
    this.height = systemInfo.windowHeight || systemInfo.screenHeight;
    this.pixelRatio = systemInfo.pixelRatio || 1;
    this.canvas.width = this.width * this.pixelRatio;
    this.canvas.height = this.height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);

    this.assets = new AssetLoader();
    this.audio = new AudioManager();
    this.ui = this.createUI(systemInfo);
    this.requestFrame = this.createRequestFrame();
    this.state = GAME_STATE.HOME;
    this.profile = new Profile(MAIN_CHARACTER);
    this.currentLoot = null;
    this.collectionPage = 0;
    this.battle = null;
    this.toast = "";
    this.toastTimeLeft = 0;
    this.treePulse = 0;
    this.homeAction = 0;
    this.pendingLoot = null;
    this.tutorialStep = 0;
    this.dialogue = null;
    this.visualTime = 0;
    this.lastFrameTime = 0;
    this.wheelResult = "";
    this.quickDrawResults = [];
    this.quickDrawSynthesis = null;
    this.enhanceSlot = "";
    this.pvpOpponents = this.createPvpOpponents();
    this.rankingEntries = [];
    this.rankingStatus = "正在读取实时仙榜...";

    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
  }

  start() {
    wx.onTouchStart(this.handleTouchStart);
    if (typeof wx.onWindowResize === "function") {
      wx.onWindowResize(this.handleWindowResize);
    }
    if (typeof wx.onHide === "function") {
      wx.onHide(() => this.audio.pause());
    }
    if (typeof wx.onShow === "function") {
      wx.onShow(() => this.audio.resume());
    }
    if (typeof wx.onPlayerNameChange === "function") {
      wx.onPlayerNameChange((name) => {
        this.profile.setCharacterName(name);
        this.saveProfile();
        this.render();
      });
    }
    this.assets.loadAll();
    this.loadProfile();
    this.render();
    this.requestFrame((time) => this.loop(time));
  }

  createRequestFrame() {
    if (typeof this.canvas.requestAnimationFrame === "function") {
      return (callback) => this.canvas.requestAnimationFrame(callback);
    }
    if (typeof requestAnimationFrame === "function") {
      return (callback) => requestAnimationFrame(callback);
    }
    return (callback) => setTimeout(() => callback(Date.now()), 1000 / 60);
  }

  createUI(systemInfo) {
    const menuButton = typeof wx.getMenuButtonBoundingClientRect === "function"
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    return new UI(this.ctx, this.width, this.height, this.assets, {
      safeArea: systemInfo.safeArea,
      menuButton
    });
  }

  handleWindowResize(event = {}) {
    const systemInfo = wx.getSystemInfoSync();
    this.width = event.windowWidth || systemInfo.windowWidth || systemInfo.screenWidth;
    this.height = event.windowHeight || systemInfo.windowHeight || systemInfo.screenHeight;
    this.pixelRatio = systemInfo.pixelRatio || 1;
    this.canvas.width = this.width * this.pixelRatio;
    this.canvas.height = this.height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    this.ui = this.createUI({ ...systemInfo, safeArea: event.safeArea || systemInfo.safeArea });
    this.render();
  }

  loop(timestamp = 0) {
    const elapsed = this.lastFrameTime ? (timestamp - this.lastFrameTime) / 1000 : 0;
    const deltaTime = Math.min(elapsed, 0.05);
    this.lastFrameTime = timestamp;
    this.update(deltaTime);
    this.render();
    this.requestFrame((time) => this.loop(time));
  }

  update(deltaTime) {
    this.visualTime += deltaTime;
    this.toastTimeLeft = Math.max(0, this.toastTimeLeft - deltaTime);
    if (this.toastTimeLeft <= 0) this.toast = "";
    this.treePulse = Math.max(0, this.treePulse - deltaTime * 5);
    this.homeAction = Math.max(0, this.homeAction - deltaTime);
    if (this.pendingLoot && this.homeAction <= 0) {
      this.currentLoot = this.pendingLoot;
      this.pendingLoot = null;
      this.state = GAME_STATE.LOOT;
      this.saveProfile();
    }
    if (this.state === GAME_STATE.BATTLE) {
      this.updateBattle(deltaTime);
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (this.state === GAME_STATE.HOME) {
      this.ui.renderHome(this.profile, this.toast, this.treePulse, this.visualTime, this.audio.enabled, this.homeAction);
    } else if (this.state === GAME_STATE.LOOT) {
      this.ui.renderLoot(this.profile, this.currentLoot);
    } else if (this.state === GAME_STATE.COLLECTION) {
      this.ui.renderCollection(this.profile, this.collectionPage);
    } else if (this.state === GAME_STATE.SKILLS) {
      this.ui.renderSkills(this.profile);
    } else if (this.state === GAME_STATE.BATTLE) {
      this.ui.renderBattle(this.profile, this.battle);
    } else if (this.state === GAME_STATE.BATTLE_RESULT) {
      this.ui.renderBattleResult(this.profile, this.battle);
    } else if (this.state === GAME_STATE.SHOP) {
      this.ui.renderShop(this.profile, this.wheelResult);
    } else if (this.state === GAME_STATE.QUICK_DRAW) {
      this.ui.renderQuickDraw(this.profile, this.quickDrawResults, this.visualTime);
    } else if (this.state === GAME_STATE.RANKING) {
      this.ui.renderRanking(this.profile, this.rankingEntries, this.rankingStatus);
    } else if (this.state === GAME_STATE.PVP) {
      this.ui.renderPvpLobby(this.profile, this.pvpOpponents);
    } else if (this.state === GAME_STATE.ENHANCE) {
      this.ui.renderEnhance(this.profile, this.enhanceSlot);
    }
    if (!this.profile.tutorialCompleted) {
      this.ui.renderTutorial(this.tutorialStep);
    } else if (this.dialogue) {
      this.ui.renderHeroDialogue(this.profile, this.dialogue.lines[this.dialogue.index]);
    }
  }

  chopTree() {
    if (!this.profile.chopTree()) {
      this.showToast("仙桃不足，挑战关卡可获得仙桃");
      return;
    }
    this.treePulse = 1;
    this.pendingLoot = createEquipment(this.profile.treeLevel);
    this.profile.discover(this.pendingLoot);
    this.homeAction = 0.48;
    this.audio.playSfx("chop");
  }

  equipLoot() {
    if (!this.currentLoot) return;
    const oldItem = this.profile.getEquipped(this.currentLoot.slot);
    if (oldItem) this.profile.coins += oldItem.price;
    this.profile.equip(this.currentLoot);
    this.currentLoot = null;
    this.state = GAME_STATE.HOME;
    this.showToast(oldItem ? "已替换装备，旧装备自动分解" : "装备已穿戴");
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  sellLoot() {
    if (!this.currentLoot) return;
    this.profile.coins += this.currentLoot.price;
    this.currentLoot = null;
    this.state = GAME_STATE.HOME;
    this.showToast("装备已分解为灵石");
    this.saveProfile();
  }

  openQuickDraw() {
    this.quickDrawResults = [];
    this.quickDrawSynthesis = null;
    this.state = GAME_STATE.QUICK_DRAW;
  }

  closeQuickDraw() {
    if (this.quickDrawResults.length) {
      this.sellQuickDraw();
      return;
    }
    this.state = GAME_STATE.HOME;
    this.quickDrawSynthesis = null;
  }

  quickDraw(count) {
    if (this.profile.peaches < count) {
      this.showToast(`仙桃不足，${count} 次抽取需要 ${count} 个仙桃`);
      this.state = GAME_STATE.HOME;
      return;
    }
    const results = [];
    for (let index = 0; index < count; index += 1) {
      this.profile.chopTree();
      const item = createEquipment(this.profile.treeLevel);
      this.profile.discover(item);
      results.push(item);
    }
    this.quickDrawResults = results.sort((left, right) => right.power - left.power);
    this.quickDrawSynthesis = getSynthesisCandidate(this.quickDrawResults);
    this.treePulse = 1;
    this.audio.playSfx("chop");
    this.saveProfile();
  }

  sellQuickDraw() {
    if (!this.quickDrawResults.length) return;
    const coins = this.quickDrawResults.reduce((total, item) => total + item.price, 0);
    this.profile.coins += coins;
    this.quickDrawResults = [];
    this.state = GAME_STATE.HOME;
    this.showToast(`批量分解完成，灵石 +${coins}`);
    this.saveProfile();
  }

  equipBestQuickDraw() {
    const upgrades = this.quickDrawResults
      .map((item) => ({ item, comparison: this.profile.getEquipmentComparison(item) }))
      .filter((entry) => entry.comparison.powerDelta > 0)
      .sort((left, right) => right.comparison.powerDelta - left.comparison.powerDelta);
    const best = upgrades[0] && upgrades[0].item;
    if (!best) {
      this.sellQuickDraw();
      this.showToast("没有更强装备，已自动分解全部掉落");
      return;
    }
    const oldItem = this.profile.getEquipped(best.slot);
    const remaining = this.quickDrawResults.filter((item) => item.id !== best.id);
    let coins = remaining.reduce((total, item) => total + item.price, 0);
    if (oldItem) coins += oldItem.price;
    this.profile.coins += coins;
    this.profile.equip(best);
    this.quickDrawResults = [];
    this.state = GAME_STATE.HOME;
    this.showToast(`已穿戴最强装备，其余分解 +${coins} 灵石`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  synthesizeQuickDraw() {
    const synthesis = this.getQuickDrawSynthesisPreview();
    if (!synthesis) {
      this.showToast("至少需要 3 件同部位装备才可以合成");
      return;
    }
    const product = synthesizeEquipment(synthesis.materials);
    if (!product) {
      this.showToast("合成失败，请再试一次");
      return;
    }
    const materialIds = new Set(synthesis.materials.map((item) => item.id));
    this.quickDrawResults = this.quickDrawResults
      .filter((item) => !materialIds.has(item.id))
      .concat(product)
      .sort((left, right) => right.power - left.power);
    const comparison = this.profile.getEquipmentComparison(product);
    const sign = comparison.powerDelta >= 0 ? "+" : "";
    this.showToast(`合成成功：${product.name}，妖力 ${sign}${comparison.powerDelta}`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  getQuickDrawSynthesisPreview() {
    return getSynthesisCandidate(this.quickDrawResults);
  }

  explore() {
    if (!this.profile.explore()) {
      this.showToast("游历次数不足，挑战胜利后可恢复");
      return;
    }
    this.audio.playSfx("explore");
    const roll = Math.random();
    if (roll < 0.38) {
      this.currentLoot = createEquipment(this.profile.treeLevel + 1);
      this.profile.discover(this.currentLoot);
      this.state = GAME_STATE.LOOT;
      this.saveProfile();
      return;
    }
    if (roll < 0.68) {
      const peaches = 2 + Math.floor(Math.random() * 4);
      this.profile.peaches += peaches;
      this.showToast(`游历奇遇：获得仙桃 ${peaches}`);
    } else if (roll < 0.9) {
      const coins = 8 + this.profile.stage * 2;
      this.profile.coins += coins;
      this.showToast(`发现灵脉：获得灵石 ${coins}`);
    } else {
      const cultivation = 18 + this.profile.treeLevel * 3;
      this.profile.cultivation += cultivation;
      this.showToast(`高人指点：修为增加 ${cultivation}`);
    }
    this.saveProfile();
  }

  openCollection() {
    this.collectionPage = 0;
    this.state = GAME_STATE.COLLECTION;
  }

  changeCollectionPage(offset) {
    const section = this.profile.getCollectionSection(this.collectionPage + offset);
    this.collectionPage = section.page;
  }

  closeCollection() {
    this.state = GAME_STATE.HOME;
  }

  openSkills() {
    this.state = GAME_STATE.SKILLS;
  }

  selectSkill(index) {
    const skill = this.profile.getSkills()[index];
    if (!skill || !this.profile.setSkill(skill.id)) return;
    this.showToast(`已装备技能：${skill.name}`);
    this.saveProfile();
  }

  closeSkills() {
    this.state = GAME_STATE.HOME;
  }

  openShop() {
    this.wheelResult = "";
    this.state = GAME_STATE.SHOP;
  }

  closeShop() {
    this.state = GAME_STATE.HOME;
  }

  createPvpOpponents() {
    return [
      { name: "草原悍匪·阿坤", realm: "炼气九层", power: 1320, hp: 390, atk: 43, spd: 148, quote: "你的仙桃，归我了！" },
      { name: "黑风寨·大聪明", realm: "筑基初期", power: 1760, hp: 510, atk: 55, spd: 136, quote: "让我看看你能撑几招。" },
      { name: "赤霞真人", realm: "筑基中期", power: 2180, hp: 620, atk: 64, spd: 154, quote: "草原之上，强者为尊。" },
      { name: "月坛剑客", realm: "筑基后期", power: 2640, hp: 730, atk: 72, spd: 168, quote: "此剑，只问胜负。" }
    ];
  }

  openRanking() {
    this.state = GAME_STATE.RANKING;
    this.rankingEntries = [];
    this.rankingStatus = "正在读取实时仙榜...";
    if (typeof wx.fetchLeaderboard !== "function") {
      this.rankingStatus = "当前运行环境未连接排行榜服务";
      return;
    }
    wx.fetchLeaderboard()
      .then((entries) => {
        this.rankingEntries = entries;
        this.rankingStatus = typeof location !== "undefined" && location.protocol === "file:"
          ? "离线预览榜单 · 联网服务启动后显示实时玩家"
          : entries.length ? "实时玩家榜单" : "暂无玩家记录";
      })
      .catch((error) => {
        this.rankingStatus = `仙榜读取失败：${error.message}`;
      });
  }

  openPvp() {
    this.state = GAME_STATE.PVP;
  }

  openEnhance(slot) {
    this.enhanceSlot = slot;
    this.state = GAME_STATE.ENHANCE;
  }

  enhanceSelectedEquipment() {
    const result = this.profile.enhanceEquipment(this.enhanceSlot);
    if (!result.ok) {
      this.showToast(result.reason === "coins" ? `灵石不足，需要 ${result.cost}` : result.reason === "max" ? "装备已强化至最高等级" : "该部位尚未装备");
      return;
    }
    this.showToast(`${result.item.name} 强化至 +${result.item.enhanceLevel}`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  selectCosmetic(index) {
    const item = this.profile.getCosmetics()[index];
    if (!item) return;
    const result = this.profile.buyOrEquipCosmetic(item.id);
    if (!result.ok) {
      this.wheelResult = `灵石不足，需要 ${item.price}`;
      return;
    }
    this.wheelResult = item.owned ? `已换上：${item.name}` : `已购买并换上：${item.name}`;
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  spinWheel() {
    const cost = 20;
    if (this.profile.coins < cost) {
      this.wheelResult = `灵石不足，转盘需要 ${cost}`;
      return;
    }
    this.profile.coins -= cost;
    const roll = Math.random();
    if (roll < 0.32) {
      const coins = 35 + Math.floor(Math.random() * 31);
      this.profile.coins += coins;
      this.wheelResult = `转盘奖励：灵石 +${coins}`;
    } else if (roll < 0.64) {
      const peaches = 3 + Math.floor(Math.random() * 5);
      this.profile.peaches += peaches;
      this.wheelResult = `转盘奖励：仙桃 +${peaches}`;
    } else {
      const locked = COSMETICS.filter((item) => !this.profile.ownedCosmetics[item.id]);
      if (locked.length) {
        const item = locked[Math.floor(Math.random() * locked.length)];
        this.profile.unlockCosmetic(item.id);
        this.wheelResult = `转盘奖励：解锁 ${item.name}`;
      } else {
        this.profile.coins += 90;
        this.wheelResult = "外观已集齐：灵石 +90";
      }
    }
    this.saveProfile();
  }

  advanceTutorial() {
    if (this.tutorialStep >= this.ui.getTutorialStepCount() - 1) {
      this.completeTutorial();
      return;
    }
    this.tutorialStep += 1;
  }

  completeTutorial() {
    this.profile.tutorialCompleted = true;
    this.saveProfile();
    this.showToast("新手引导完成，开始修行吧");
  }

  openHeroDialogue() {
    this.dialogue = {
      lines: this.getHeroDialogueLines(),
      index: 0
    };
  }

  advanceHeroDialogue() {
    if (!this.dialogue) return;
    this.dialogue.index = (this.dialogue.index + 1) % this.dialogue.lines.length;
  }

  closeHeroDialogue() {
    this.dialogue = null;
  }

  getHeroDialogueLines() {
    const lines = [
      "灵树的气息很安稳。再砍几次树，也许能找到更适合我们的装备。",
      `我现在使用的是「${this.profile.character.skill.name}」。想换一种打法，就点上方的技能按钮。`,
      `前方已经探索到第 ${this.profile.stage} 关。每逢五关都会遇到一名新的首领。`
    ];
    if (this.profile.peaches <= 5) {
      lines.push("仙桃快不够了。先去游历，或者挑战关卡补充一些再继续砍树吧。");
    } else {
      lines.push(`我们还有 ${this.profile.peaches} 个仙桃，可以继续从灵树中寻找装备。`);
    }
    if (Object.keys(this.profile.equipment).length < 3) {
      lines.push("身上的装备还不齐。先把六个部位慢慢补满，妖力会提升得更稳定。");
    } else {
      lines.push("装备已经逐渐成形。留意套装和会心、连击这些特殊属性，它们很重要。");
    }
    const skin = this.profile.getEquippedCosmetics().find((item) => item.type === "skin");
    if (skin) lines.push(`今天穿的是「${skin.name}」。修仙也要讲究气势。`);
    return lines;
  }

  getBattleDialogueLines() {
    const skin = this.profile.getEquippedCosmetics().find((item) => item.type === "skin");
    const lines = ["稳住气息，寻找破绽。", "灵树在指引我们。", "再来一招！"];
    if (skin && skin.id === "streetwear") lines.push("墨镜一戴，谁也不爱。");
    if (skin && skin.id === "wuxia") lines.push("云水一剑，破！");
    if (skin && skin.id === "royal") lines.push("这就是王者的从容。");
    if (skin && skin.id === "bunny") lines.push("月兔踏风，闪开！");
    if (skin && skin.id === "nurse") lines.push("别担心，这点伤能治。");
    if (skin && skin.id === "bocchi-shirt") lines.push("社恐归社恐，打架不能输。");
    return lines;
  }

  startBattle() {
    const stage = this.profile.stage;
    const template = ENEMIES[(stage - 1) % ENEMIES.length];
    const isBoss = stage % 5 === 0;
    const boss = isBoss ? getBossForStage(stage) : null;
    const baseTemplate = boss ? ENEMIES.find((enemy) => enemy.type === boss.type) || template : template;
    const multiplier = Math.min(1e12, getBattleMultiplier(stage, isBoss));
    const attackMultiplier = Math.min(1e12, getEnemyAttackMultiplier(stage, isBoss));
    const stats = this.profile.getStats();
    const scene = getSceneForStage(stage);
    const enemy = {
      ...baseTemplate,
      ...(boss || {}),
      name: boss ? `${boss.title} · ${boss.name}` : template.name,
      maxHp: Math.round(baseTemplate.hp * multiplier * (boss ? boss.hpFactor : 1)),
      hp: Math.round(baseTemplate.hp * multiplier * (boss ? boss.hpFactor : 1)),
      atk: Math.round(baseTemplate.atk * attackMultiplier * (boss ? boss.atkFactor : 1)),
      isBoss
    };
    this.battle = {
      stage,
      scene,
      enemy,
      heroMaxHp: stats.hp,
      heroHp: stats.hp,
      heroDisplayedHp: stats.hp,
      heroAttack: stats.atk,
      heroCrit: stats.crit,
      heroCombo: stats.combo,
      heroDodge: stats.dodge,
      heroLifesteal: stats.lifesteal,
      heroCounter: stats.counter,
      heroAttackTimer: 0.3,
      skillTimer: 1.7,
      skillAction: 0,
      enemyAttackTimer: 0.85,
      enemyDisplayedHp: enemy.hp,
      message: "双方正在交手",
      introTime: isBoss ? 1.25 : 0.72,
      elapsed: 0,
      heroAction: 0,
      enemyAction: 0,
      effects: [],
      hitStop: 0,
      screenShake: 0,
      screenFlash: 0,
      victory: false,
      rewardPeaches: 0,
      rewardCoins: 0
    };
    this.state = GAME_STATE.BATTLE;
    this.audio.playStageBgm(stage, isBoss);
  }

  startPvpBattle(index) {
    const opponent = this.pvpOpponents[index];
    if (!opponent) return;
    const stats = this.profile.getStats();
    const scene = getSceneForStage(index + 2);
    this.battle = {
      stage: this.profile.stage,
      scene,
      isPvp: true,
      enemy: { ...opponent, type: index % 2 ? "brute" : "imp", sprite: "hero-main-character", maxHp: opponent.hp, isBoss: false },
      heroMaxHp: stats.hp, heroHp: stats.hp, heroDisplayedHp: stats.hp,
      heroAttack: stats.atk, heroCrit: stats.crit, heroCombo: stats.combo, heroDodge: stats.dodge,
      heroLifesteal: stats.lifesteal, heroCounter: stats.counter,
      heroAttackTimer: 0.3, skillTimer: 1.7, skillAction: 0, enemyAttackTimer: 0.85,
      enemyDisplayedHp: opponent.hp, message: "演武场切磋开始", introTime: 0.72, elapsed: 0,
      heroAction: 0, enemyAction: 0, effects: [], hitStop: 0, screenShake: 0, screenFlash: 0,
      talk: opponent.quote, talkTime: 2.2, nextTalkTime: 3.5, victory: false, rewardPeaches: 0, rewardCoins: 0
    };
    this.state = GAME_STATE.BATTLE;
    this.audio.playStageBgm(index + 2, false);
  }

  updateBattle(deltaTime) {
    const battle = this.battle;
    battle.elapsed += deltaTime;
    battle.introTime = Math.max(0, battle.introTime - deltaTime);
    battle.heroDisplayedHp += (battle.heroHp - battle.heroDisplayedHp) * Math.min(1, deltaTime * 5.5);
    battle.enemyDisplayedHp += (battle.enemy.hp - battle.enemyDisplayedHp) * Math.min(1, deltaTime * 5.5);
    battle.screenShake = Math.max(0, battle.screenShake - deltaTime * 24);
    battle.screenFlash = Math.max(0, battle.screenFlash - deltaTime * 5);
    battle.heroAction = Math.max(0, battle.heroAction - deltaTime);
    battle.enemyAction = Math.max(0, battle.enemyAction - deltaTime);
    battle.skillAction = Math.max(0, battle.skillAction - deltaTime);
    battle.talkTime = Math.max(0, (battle.talkTime || 0) - deltaTime);
    battle.nextTalkTime = Math.max(0, (battle.nextTalkTime || 0) - deltaTime);
    if (battle.nextTalkTime <= 0) {
      const lines = battle.isPvp
        ? ["别走神，下一招更重！", "你的装备还差点火候。", "这场演武我拿下了！", `${this.profile.character.name}，接招！`]
        : this.getBattleDialogueLines();
      battle.talk = lines[Math.floor(Math.random() * lines.length)];
      battle.talkTime = 2;
      battle.nextTalkTime = 3.8 + Math.random() * 2.2;
    }
    battle.effects.forEach((effect) => {
      effect.life -= deltaTime;
      effect.y -= deltaTime * (effect.rise || 0);
      effect.x += deltaTime * (effect.drift || 0);
    });
    battle.effects = battle.effects.filter((effect) => effect.life > 0);
    if (battle.hitStop > 0) {
      battle.hitStop = Math.max(0, battle.hitStop - deltaTime);
      return;
    }
    if (battle.introTime > 0) {
      return;
    }
    battle.heroAttackTimer -= deltaTime;
    battle.enemyAttackTimer -= deltaTime;
    battle.skillTimer -= deltaTime;

    if (battle.heroAttackTimer <= 0) {
      const critical = Math.random() < Math.min(0.65, battle.heroCrit / 100);
      const damage = Math.round(battle.heroAttack * (critical ? 2 : 1));
      battle.enemy.hp = Math.max(0, battle.enemy.hp - damage);
      battle.message = critical ? `会心一击！造成 ${damage} 伤害` : `你造成 ${damage} 伤害`;
      battle.heroAction = 0.28;
      this.addBattleEffect("slash", "enemy", critical ? "#ffe06f" : battle.scene.accent, "", 0.34);
      this.addBattleEffect("damage", "enemy", critical ? "#ffe06f" : "#ffffff", `${critical ? "暴击 " : ""}-${damage}`, 0.88);
      this.registerHitFeedback({ critical, heavy: critical, side: "enemy" });
      this.audio.playHit({ critical });
      if (battle.heroLifesteal > 0) {
        battle.heroHp = Math.min(battle.heroMaxHp, battle.heroHp + Math.round(damage * battle.heroLifesteal / 100));
      }
      if (Math.random() < Math.min(0.45, battle.heroCombo / 100)) {
        battle.enemy.hp = Math.max(0, battle.enemy.hp - Math.round(damage * 0.56));
        this.addBattleEffect("damage", "enemy", "#a8ec83", "连击", 0.72);
        this.addBattleEffect("slash", "enemy", "#a8ec83", "", 0.24);
      }
      battle.heroAttackTimer = 0.72 * battle.scene.heroAttackSpeed;
    }

    if (battle.enemy.hp <= 0) {
      this.finishBattle(true);
      return;
    }

    if (battle.skillTimer <= 0) {
      const skill = this.profile.character.skill;
      const damage = Math.round(battle.heroAttack * skill.multiplier);
      battle.enemy.hp = Math.max(0, battle.enemy.hp - damage);
      battle.message = `${skill.name}！造成 ${damage} 伤害`;
      battle.heroAction = 0.34;
      battle.skillAction = 0.65;
      this.addBattleEffect(`skill-${skill.type}`, "enemy", skill.color, skill.name, 0.82);
      this.addBattleEffect("damage", "enemy", "#f5e9ff", `-${damage}`, 0.88);
      this.registerHitFeedback({ heavy: true, skill: true, side: "enemy" });
      this.audio.playSfx("skill");
      battle.skillTimer = Math.max(2.2, skill.cooldown * 0.72);
    }

    if (battle.enemy.hp <= 0) {
      this.finishBattle(true);
      return;
    }

    if (battle.enemyAttackTimer <= 0) {
      if (Math.random() < Math.min(0.5, battle.heroDodge / 100)) {
        battle.message = "身法灵动，闪避了攻击";
        this.addBattleEffect("damage", "hero", "#7edbff", "闪避", 0.74);
        this.audio.playSfx("dodge");
      } else {
        battle.heroHp = Math.max(0, battle.heroHp - battle.enemy.atk);
        battle.message = `${battle.enemy.name} 造成 ${battle.enemy.atk} 伤害`;
        this.addBattleEffect(battle.enemy.type === "wisp" ? "orb" : "impact", "hero", "#ff816f", `-${battle.enemy.atk}`, 0.85);
        this.registerHitFeedback({ heavy: battle.enemy.type === "brute", magic: battle.enemy.type === "wisp", side: "hero" });
        this.audio.playHit({ heavy: battle.enemy.type === "brute", magic: battle.enemy.type === "wisp" });
        if (Math.random() < Math.min(0.42, battle.heroCounter / 100)) {
          const counterDamage = Math.round(battle.heroAttack * 0.7);
          battle.enemy.hp = Math.max(0, battle.enemy.hp - counterDamage);
          this.addBattleEffect("damage", "enemy", "#d0a5ff", `反击 -${counterDamage}`, 0.82);
        }
      }
      battle.enemyAction = 0.3;
      battle.enemyAttackTimer = 1.02 * battle.scene.enemyAttackSpeed;
    }

    if (battle.heroHp <= 0) {
      this.finishBattle(false);
    }
  }

  registerHitFeedback({ critical = false, heavy = false, skill = false, side = "enemy" } = {}) {
    const battle = this.battle;
    battle.hitStop = Math.max(battle.hitStop, skill ? 0.095 : critical ? 0.075 : heavy ? 0.055 : 0.035);
    battle.screenShake = Math.max(battle.screenShake, skill ? 11 : critical ? 9 : heavy ? 7 : 3.5);
    battle.screenFlash = Math.max(battle.screenFlash, skill ? 0.56 : critical ? 0.42 : 0.18);
    this.addBattleEffect("burst", side, skill ? this.profile.character.color : critical ? "#ffe06f" : "#ffffff", "", skill ? 0.48 : 0.28);
    if ((skill || critical || heavy) && typeof wx.vibrateShort === "function") {
      wx.vibrateShort({ type: skill || critical ? "medium" : "light" });
    }
  }

  addBattleEffect(type, side, color, text, life) {
    this.battle.effects.push({
      type,
      side,
      color,
      text,
      life,
      maxLife: life,
      x: 0,
      y: 0,
      rise: type === "damage" || type === "impact" || type === "orb" ? 24 : 0,
      drift: (Math.random() - 0.5) * 14
    });
  }

  cultivate() {
    const cost = 12 + Math.floor(this.profile.cultivation / 45) * 4;
    if (this.profile.coins < cost) {
      this.showToast(`灵石不足，淬炼需要 ${cost}`);
      return;
    }
    this.profile.coins -= cost;
    this.profile.cultivation += 24 + this.profile.treeLevel * 3;
    this.showToast("吐纳淬炼完成，修为提升");
    this.saveProfile();
  }

  finishBattle(victory) {
    this.battle.victory = victory;
    if (this.battle.isPvp) {
      this.profile.recordPvpResult(victory);
      this.battle.rankDelta = victory ? 24 : -12;
      this.battle.message = victory ? "演武获胜，仙榜积分提升" : "演武落败，调整装备后再战";
      this.saveProfile();
      this.state = GAME_STATE.BATTLE_RESULT;
      return;
    }
    if (victory) {
      this.battle.rewardPeaches = 3 + Math.floor(this.battle.stage / 3);
      this.battle.rewardCoins = 5 + this.battle.stage * 2 + (this.battle.enemy.isBoss ? 12 : 0);
      this.profile.peaches += this.battle.rewardPeaches;
      this.profile.coins += this.battle.rewardCoins;
      this.profile.cultivation += 12 + this.profile.stage * 3;
      this.profile.stage += 1;
      this.profile.restoreExploreEnergy(1);
      this.battle.nextSceneName = getSceneForStage(this.profile.stage).name;
      this.saveProfile();
      this.audio.playSfx("victory");
    }
    this.state = GAME_STATE.BATTLE_RESULT;
  }

  showToast(message) {
    this.toast = message;
    this.toastTimeLeft = 2;
  }

  saveProfile() {
    if (this.profile && typeof wx.setStorageSync === "function") {
      const saved = this.profile.toJSON();
      wx.setStorageSync(STORAGE_KEY, saved);
      if (typeof wx.syncLeaderboard === "function") wx.syncLeaderboard(saved);
    }
  }

  loadProfile() {
    if (typeof wx.getStorageSync !== "function") return;
    const saved = wx.getStorageSync(STORAGE_KEY);
    if (!saved) return;
    this.profile = new Profile(MAIN_CHARACTER, saved);
    this.state = GAME_STATE.HOME;
  }

  handleTouchStart(event) {
    const touches = event.changedTouches || event.touches || [];
    const touch = touches[0];
    if (!touch) return;
    const x = touch.clientX;
    const y = touch.clientY;
    if (!this.profile.tutorialCompleted) {
      if (this.ui.isTutorialSkipButton(x, y)) this.completeTutorial();
      else if (this.ui.isTutorialNextButton(x, y)) this.advanceTutorial();
      return;
    }
    if (this.dialogue) {
      if (this.ui.isDialogueNextButton(x, y)) this.advanceHeroDialogue();
      else if (this.ui.isDialogueCloseButton(x, y)) this.closeHeroDialogue();
      return;
    }
    if (this.state === GAME_STATE.HOME && !this.audio.bgmName) {
      this.audio.playBgm("home");
    }

    if (this.state === GAME_STATE.HOME) {
      const equipmentSlot = this.ui.getEquipmentSlotAt(x, y, this.profile);
      if (equipmentSlot) this.openEnhance(equipmentSlot);
      else if (this.ui.isHero(x, y)) this.openHeroDialogue();
      else if (this.ui.isChopButton(x, y) || this.ui.isTree(x, y)) this.chopTree();
      else if (this.ui.isChallengeButton(x, y)) this.startBattle();
      else if (this.ui.isCultivateButton(x, y)) this.cultivate();
      else if (this.ui.isExploreButton(x, y)) this.explore();
      else if (this.ui.isCollectionButton(x, y)) this.openCollection();
      else if (this.ui.isSkillsButton(x, y)) this.openSkills();
      else if (this.ui.isShopButton(x, y)) this.openShop();
      else if (this.ui.isAudioButton(x, y)) this.audio.toggle();
      else if (this.ui.isQuickDrawButton(x, y)) this.openQuickDraw();
      else if (this.ui.isPvpButton(x, y)) this.openPvp();
      else if (this.ui.isRankingButton(x, y)) this.openRanking();
    } else if (this.state === GAME_STATE.LOOT) {
      if (this.ui.isSellButton(x, y)) this.sellLoot();
      else if (this.ui.isEquipButton(x, y)) this.equipLoot();
    } else if (this.state === GAME_STATE.COLLECTION) {
      if (this.ui.isCollectionPreviousButton(x, y)) this.changeCollectionPage(-1);
      else if (this.ui.isCollectionNextButton(x, y)) this.changeCollectionPage(1);
      else if (this.ui.isCollectionCloseButton(x, y)) this.closeCollection();
    } else if (this.state === GAME_STATE.SKILLS) {
      const skillIndex = this.ui.getSkillIndexAt(x, y);
      if (skillIndex >= 0) this.selectSkill(skillIndex);
      else if (this.ui.isSkillsCloseButton(x, y)) this.closeSkills();
    } else if (this.state === GAME_STATE.SHOP) {
      const cosmeticIndex = this.ui.getCosmeticIndexAt(x, y);
      if (cosmeticIndex >= 0) this.selectCosmetic(cosmeticIndex);
      else if (this.ui.isWheelButton(x, y)) this.spinWheel();
      else if (this.ui.isShopCloseButton(x, y)) this.closeShop();
    } else if (this.state === GAME_STATE.QUICK_DRAW) {
      const count = this.ui.getQuickDrawCountAt(x, y);
      if (count) this.quickDraw(count);
      else if (this.ui.isQuickDrawSellButton(x, y)) this.sellQuickDraw();
      else if (this.ui.isQuickDrawEquipButton(x, y)) this.equipBestQuickDraw();
      else if (this.ui.isQuickDrawSynthesizeButton(x, y)) this.synthesizeQuickDraw();
      else if (this.ui.isQuickDrawCloseButton(x, y)) this.closeQuickDraw();
    } else if (this.state === GAME_STATE.RANKING) {
      if (this.ui.isSimpleModalCloseButton(x, y, 390)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.PVP) {
      const opponentIndex = this.ui.getPvpOpponentIndexAt(x, y);
      if (opponentIndex >= 0) this.startPvpBattle(opponentIndex);
      else if (this.ui.isSimpleModalCloseButton(x, y, 410)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.ENHANCE) {
      if (this.ui.isEnhanceActionButton(x, y)) this.enhanceSelectedEquipment();
      else if (this.ui.isSimpleModalCloseButton(x, y, 340)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.BATTLE_RESULT) {
      if (this.ui.isContinueButton(x, y) && this.battle.victory) this.startBattle();
      else if (this.ui.isResultButton(x, y)) {
        this.state = GAME_STATE.HOME;
        this.audio.playBgm("home");
      }
    }
  }
}

module.exports = Game;

  },
    "js/config/characters.js": function(require, module, exports) {
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

  },
    "js/config/skills.js": function(require, module, exports) {
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

  },
    "js/config/equipment.js": function(require, module, exports) {
const SLOTS = [
  { id: "weapon", name: "武器", icon: "剑" },
  { id: "armor", name: "衣甲", icon: "甲" },
  { id: "ring", name: "戒指", icon: "戒" },
  { id: "boots", name: "灵靴", icon: "靴" },
  { id: "talisman", name: "法宝", icon: "宝" },
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
  { id: "flame", name: "赤霞套装", color: "#ff9c68" },
  { id: "moon", name: "月影套装", color: "#c8b8ff" },
  { id: "spring", name: "灵泉套装", color: "#8ce0ae" }
];

const EQUIPMENT_CATALOG = {
  weapon: [
    "青锋问道剑", "流云逐月刃", "玄铁镇妖刀", "苍雷惊鸿枪", "赤霞焚心剑", "月影无痕匕",
    "灵泉听雨剑", "星河落尘杖", "归墟断岳斧", "太虚照夜戟", "扶摇破风弓", "九霄御雷剑"
  ],
  armor: [
    "青岚护心袍", "流云鹤氅", "玄铁镇山甲", "苍雷鳞衣", "赤霞焚天铠", "月影夜行衣",
    "灵泉长生袍", "星河璇玑甲", "归墟玄武铠", "太虚无垢衣", "扶摇轻羽衫", "九霄云纹甲"
  ],
  ring: [
    "青木纳灵戒", "流云藏风戒", "玄铁定岳环", "苍雷引电戒", "赤霞离火戒", "月影匿踪环",
    "灵泉回春戒", "星河照命环", "归墟噬灵戒", "太虚须弥环", "扶摇御风戒", "九霄紫电环"
  ],
  boots: [
    "青岚踏叶靴", "流云追月履", "玄铁镇岳靴", "苍雷逐电履", "赤霞焚风靴", "月影无声履",
    "灵泉渡水靴", "星河踏斗履", "归墟破浪靴", "太虚凌空履", "扶摇乘风靴", "九霄登云履"
  ],
  talisman: [
    "青木养魂葫", "流云八卦镜", "玄铁镇妖塔", "苍雷引劫铃", "赤霞离火珠", "月影摄魂灯",
    "灵泉净心瓶", "星河璇玑盘", "归墟吞海印", "太虚乾坤扇", "扶摇御风旗", "九霄雷纹鼓"
  ],
  jade: [
    "青木长生玉", "流云自在珏", "玄铁镇心佩", "苍雷惊蛰玉", "赤霞暖阳珏", "月影幽梦佩",
    "灵泉回春玉", "星河照命珏", "归墟玄冥佩", "太虚无相玉", "扶摇清风珏", "九霄紫霄佩"
  ]
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
      best = {
        slot,
        materials,
        product,
        score
      };
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
  getItemPower,
  getCatalogTotal,
  getSynthesisCandidate,
  synthesizeEquipment
};

  },
    "js/config/scenes.js": function(require, module, exports) {
const SCENES = [
  {
    id: "moon-ruins",
    name: "月影遗迹",
    background: "scene-moon",
    accent: "#81b9ff",
    particle: "firefly",
    modifierName: "月华庇佑",
    heroAttackSpeed: 0.92,
    enemyAttackSpeed: 1
  },
  {
    id: "bamboo-valley",
    name: "青竹晨谷",
    background: "scene-bamboo",
    accent: "#a9e58e",
    particle: "leaf",
    modifierName: "清风迅捷",
    heroAttackSpeed: 0.82,
    enemyAttackSpeed: 0.94
  },
  {
    id: "sunset-canyon",
    name: "赤霞峡谷",
    background: "scene-canyon",
    accent: "#ffb36b",
    particle: "ember",
    modifierName: "烈焰试炼",
    heroAttackSpeed: 1,
    enemyAttackSpeed: 0.82
  },
  {
    id: "snow-shrine",
    name: "雪山月坛",
    background: "scene-snow",
    accent: "#b9e6ff",
    particle: "snow",
    modifierName: "霜寒凝滞",
    heroAttackSpeed: 1.08,
    enemyAttackSpeed: 1.12
  }
];

function getSceneForStage(stage) {
  return SCENES[(Math.max(1, stage) - 1) % SCENES.length];
}

module.exports = { SCENES, getSceneForStage };


  },
    "js/config/bosses.js": function(require, module, exports) {
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

  },
    "js/config/difficulty.js": function(require, module, exports) {
function getStageMultiplier(stage) {
  const completedStages = Math.max(0, stage - 1);
  const earlyStages = Math.min(10, completedStages);
  const middleStages = Math.min(10, Math.max(0, completedStages - 10));
  const lateStages = Math.max(0, completedStages - 20);
  return Math.pow(1.14, earlyStages) *
    Math.pow(1.105, middleStages) *
    Math.pow(1.09, lateStages);
}

function getBattleMultiplier(stage, isBoss) {
  return getStageMultiplier(stage) * (isBoss ? 1.34 : 1);
}

function getEnemyAttackMultiplier(stage, isBoss) {
  return Math.pow(getStageMultiplier(stage), 0.72) * (isBoss ? 1.18 : 1);
}

module.exports = { getStageMultiplier, getBattleMultiplier, getEnemyAttackMultiplier };

  },
    "js/systems/Profile.js": function(require, module, exports) {
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

  enhanceEquipment(slot) {
    const item = this.getEquipped(slot);
    if (!item) return { ok: false, reason: "missing" };
    const level = item.enhanceLevel || 0;
    if (level >= 15) return { ok: false, reason: "max", item };
    const cost = this.getEnhanceCost(slot);
    if (this.coins < cost) return { ok: false, reason: "coins", cost, item };
    this.coins -= cost;
    item.enhanceLevel = level + 1;
    return { ok: true, cost, item };
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

  },
    "js/config/realms.js": function(require, module, exports) {
const REALMS = [
  { id: "mortal", name: "凡体", required: 0, color: "#c4ced8" },
  { id: "qi", name: "炼气", required: 80, color: "#8bd6a7" },
  { id: "foundation", name: "筑基", required: 240, color: "#7ac5ef" },
  { id: "core", name: "金丹", required: 560, color: "#d9b55b" },
  { id: "soul", name: "元婴", required: 1180, color: "#c99bf1" },
  { id: "spirit", name: "化神", required: 2400, color: "#f08eb4" },
  { id: "void", name: "洞虚", required: 4800, color: "#78e1db" },
  { id: "immortal", name: "羽化", required: 9200, color: "#ffd27d" }
];

function getRealm(cultivation) {
  return [...REALMS].reverse().find((realm) => cultivation >= realm.required) || REALMS[0];
}

module.exports = { REALMS, getRealm };


  },
    "js/config/cosmetics.js": function(require, module, exports) {
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

  },
    "js/systems/AudioManager.js": function(require, module, exports) {
const AUDIO_PATHS = {
  home: "assets/audio/bgm-home.wav",
  battle: "assets/audio/bgm-battle.wav",
  "battle-moon": "assets/audio/bgm-battle-moon.wav",
  "battle-bamboo": "assets/audio/bgm-battle-bamboo.wav",
  "battle-canyon": "assets/audio/bgm-battle-canyon.wav",
  "battle-snow": "assets/audio/bgm-battle-snow.wav",
  boss: "assets/audio/bgm-boss.wav",
  chop: "assets/audio/sfx-chop.wav",
  equip: "assets/audio/sfx-equip.wav",
  slash: "assets/audio/sfx-slash.wav",
  heavy: "assets/audio/sfx-heavy.wav",
  crit: "assets/audio/sfx-crit.wav",
  magic: "assets/audio/sfx-magic.wav",
  skill: "assets/audio/sfx-skill.wav",
  dodge: "assets/audio/sfx-dodge.wav",
  victory: "assets/audio/sfx-victory.wav",
  explore: "assets/audio/sfx-explore.wav"
};

class AudioManager {
  constructor() {
    this.enabled = true;
    this.bgmName = "";
    this.bgm = this.createContext(true, 0.3);
  }

  createContext(loop = false, volume = 0.6) {
    if (typeof wx.createInnerAudioContext !== "function") return null;
    const audio = wx.createInnerAudioContext();
    audio.loop = loop;
    audio.volume = volume;
    return audio;
  }

  playBgm(name) {
    if (!this.enabled || !AUDIO_PATHS[name] || this.bgmName === name) return;
    this.bgmName = name;
    if (!this.bgm) return;
    this.bgm.stop();
    this.bgm.src = AUDIO_PATHS[name];
    this.bgm.play();
  }

  playSfx(name) {
    if (!this.enabled || !AUDIO_PATHS[name]) return;
    const audio = this.createContext(false, 0.68);
    if (!audio) return;
    audio.src = AUDIO_PATHS[name];
    audio.onEnded(() => audio.destroy());
    audio.play();
  }

  playStageBgm(stage, isBoss = false) {
    if (isBoss) {
      this.playBgm("boss");
      return;
    }
    const tracks = ["battle-moon", "battle-bamboo", "battle-canyon", "battle-snow"];
    this.playBgm(tracks[(Math.max(1, stage) - 1) % tracks.length]);
  }

  playHit({ critical = false, heavy = false, magic = false } = {}) {
    if (critical) {
      this.playSfx("crit");
    } else if (magic) {
      this.playSfx("magic");
    } else {
      this.playSfx(heavy ? "heavy" : "slash");
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.bgm) {
      this.bgm.pause();
    } else if (this.enabled && this.bgm && this.bgmName) {
      this.bgm.play();
    }
    return this.enabled;
  }

  pause() {
    if (this.bgm) this.bgm.pause();
  }

  resume() {
    if (this.enabled && this.bgm && this.bgmName) this.bgm.play();
  }
}

module.exports = AudioManager;

  },
    "js/render/AssetLoader.js": function(require, module, exports) {
const IMAGE_PATHS = {
  background: "assets/images/background.jpg",
  "scene-moon": "assets/images/background.jpg",
  "scene-bamboo": "assets/images/scenes/bamboo.jpg",
  "scene-canyon": "assets/images/scenes/canyon.jpg",
  "scene-snow": "assets/images/scenes/snow.jpg",
  tree: "assets/images/spirit-tree.png",
  "enemy-imp": "assets/images/enemies/imp.png",
  "enemy-brute": "assets/images/enemies/brute.png",
  "enemy-wisp": "assets/images/enemies/wisp.png",
  "boss-crystal-emperor": "assets/images/bosses/crystal-emperor.png",
  "boss-abyss-seer": "assets/images/bosses/abyss-seer.png",
  "boss-sun-crow": "assets/images/bosses/sun-crow.png",
  "boss-vine-queen": "assets/images/bosses/vine-queen.png",
  "hero-main-character": "assets/images/heroes/main-character.png",
  "hero-skin-streetwear": "assets/images/heroes/skins/streetwear.png",
  "hero-skin-wuxia": "assets/images/heroes/skins/wuxia.png",
  "hero-skin-royal": "assets/images/heroes/skins/royal.png",
  "hero-skin-bunny": "assets/images/heroes/skins/bunny.png",
  "hero-skin-nurse": "assets/images/heroes/skins/nurse.png",
  "hero-skin-bocchi-shirt": "assets/images/heroes/skins/bocchi-shirt.png"
};

class AssetLoader {
  constructor() {
    this.images = {};
  }

  loadAll() {
    if (typeof wx.createImage !== "function") {
      return;
    }

    Object.keys(IMAGE_PATHS).forEach((key) => {
      const image = wx.createImage();
      image.onload = () => {
        this.images[key] = image;
      };
      image.onerror = () => {
        console.warn(`图片加载失败: ${IMAGE_PATHS[key]}`);
      };
      image.src = IMAGE_PATHS[key];
    });
  }

  get(key) {
    return this.images[key];
  }
}

module.exports = AssetLoader;

  },
    "js/render/UI.js": function(require, module, exports) {
const { getSynthesisCandidate } = require("../config/equipment");

const TUTORIAL_STEPS = [
  {
    title: "欢迎来到灵树洞府",
    text: "这里是你的修行根基。灵树会产出装备，陪你逐步提升妖力。",
    focus: "tree"
  },
  {
    title: "砍树获取装备",
    text: "点击砍树会消耗 1 个仙桃。每次砍树都能获得一件随机装备。",
    focus: "chop"
  },
  {
    title: "查看战斗属性",
    text: "装备会提升气血、攻击、速度和特殊属性。首页属性条会实时汇总。",
    focus: "stats"
  },
  {
    title: "自由更换技能",
    text: "点击技能按钮，可以选择火雨、雷引、冰晶等技能，战斗中自动释放。",
    focus: "skills"
  },
  {
    title: "挑战冒险关卡",
    text: "准备完成后点击挑战。每 5 关会出现一名拥有独立外观的首领。",
    focus: "challenge"
  }
];

class UI {
  constructor(ctx, width, height, assets, options = {}) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.assets = assets;
    this.safeArea = options.safeArea || { top: 0, bottom: height };
    this.menuButton = options.menuButton || null;
    this.layout = this.createLayout();
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  createLayout() {
    const safeTop = Math.max(0, this.safeArea.top || 0);
    const safeBottom = Math.min(this.height, this.safeArea.bottom || this.height);
    const menuBottom = this.menuButton ? this.menuButton.bottom : safeTop;
    const contentTop = Math.max(safeTop + 5, menuBottom + 5);
    const edge = this.clamp(this.width * 0.026, 8, 13);
    const gap = this.clamp(this.width * 0.024, 7, 11);
    const resource = { x: 0, y: contentTop, width: this.width, height: 36 };
    const summary = { x: edge, y: resource.y + resource.height + 5, width: this.width - edge * 2, height: 42 };
    const utilityY = summary.y + summary.height + 5;
    const utilityHeight = 32;
    const utilityWidth = (this.width - edge * 2 - gap * 3) / 4;
    const utilities = {
      explore: { x: edge, y: utilityY, width: utilityWidth, height: utilityHeight },
      collection: { x: edge + utilityWidth + gap, y: utilityY, width: utilityWidth, height: utilityHeight },
      skills: { x: edge + (utilityWidth + gap) * 2, y: utilityY, width: utilityWidth, height: utilityHeight },
      audio: { x: edge + (utilityWidth + gap) * 3, y: utilityY, width: utilityWidth, height: utilityHeight }
    };
    const statsSummary = { x: edge, y: utilityY + utilityHeight + 5, width: this.width - edge * 2, height: 39 };
    const actionHeight = this.clamp(this.height * 0.096, 58, 72);
    const actionY = safeBottom - actionHeight - 10;
    const actionInnerWidth = this.width - edge * 2 - gap * 2;
    const chopWidth = Math.round(actionInnerWidth * 0.48);
    const cultivateWidth = Math.round(actionInnerWidth * 0.25);
    const actions = {
      chop: { x: edge, y: actionY, width: chopWidth, height: actionHeight },
      cultivate: { x: edge + chopWidth + gap, y: actionY, width: cultivateWidth, height: actionHeight },
      challenge: { x: edge + chopWidth + gap * 2 + cultivateWidth, y: actionY, width: actionInnerWidth - chopWidth - cultivateWidth, height: actionHeight }
    };
    const treeInfo = { x: edge, y: actionY - 72, width: this.width - edge * 2, height: 30 };
    const secondaryGap = 5;
    const secondaryWidth = (this.width - edge * 2 - secondaryGap * 3) / 4;
    const secondaryY = actionY - 37;
    const quickDraw = { x: edge, y: secondaryY, width: secondaryWidth, height: 30 };
    const shop = { x: edge + secondaryWidth + secondaryGap, y: secondaryY, width: secondaryWidth, height: 30 };
    const pvp = { x: edge + (secondaryWidth + secondaryGap) * 2, y: secondaryY, width: secondaryWidth, height: 30 };
    const ranking = { x: edge + (secondaryWidth + secondaryGap) * 3, y: secondaryY, width: secondaryWidth, height: 30 };
    const playTop = statsSummary.y + statsSummary.height + 6;
    const playBottom = treeInfo.y - 5;
    const equipWidth = this.clamp(this.width * 0.145, 46, 59);
    const equipHeight = this.clamp((playBottom - playTop - 14) / 3, 40, 49);
    const equipGap = this.clamp((playBottom - playTop - equipHeight * 3) / 2, 5, 12);
    const equipment = { width: equipWidth, height: equipHeight, gap: equipGap, top: playTop };
    const treeHeight = this.clamp((playBottom - playTop) * 0.98, 205, 335);
    const treeWidth = treeHeight * 620 / 731;
    const tree = {
      x: this.width / 2 - treeWidth / 2,
      y: playTop + (playBottom - playTop - treeHeight) / 2,
      width: treeWidth,
      height: treeHeight
    };
    return { safeTop, safeBottom, contentTop, edge, gap, resource, summary, utilities, statsSummary, actions, treeInfo, quickDraw, shop, pvp, ranking, playTop, playBottom, equipment, tree };
  }

  drawBackground() {
    const background = this.assets.get("background");
    if (background) {
      this.ctx.drawImage(background, 0, 0, this.width, this.height);
    } else {
      this.ctx.fillStyle = "#102846";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
    this.ctx.fillStyle = "rgba(4, 14, 30, 0.18)";
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawSceneBackground(scene, elapsed = 0) {
    const background = this.assets.get(scene.background);
    if (background) {
      this.ctx.drawImage(background, 0, 0, this.width, this.height);
    } else {
      this.drawBackground();
    }
    this.ctx.fillStyle = "rgba(4, 12, 24, 0.12)";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.drawSceneParticles(scene, elapsed);
  }

  drawSceneParticles(scene, elapsed) {
    const ctx = this.ctx;
    const count = this.width < 350 ? 13 : 18;
    ctx.save();
    for (let index = 0; index < count; index += 1) {
      const seed = index * 37.17;
      const speed = scene.particle === "snow" ? 19 : 10;
      const x = (seed * 13 + elapsed * speed * (index % 3 + 1)) % (this.width + 30) - 15;
      const y = (seed * 23 + elapsed * speed * 1.7) % (this.height + 30) - 15;
      if (scene.particle === "leaf") {
        ctx.fillStyle = "rgba(178, 225, 116, 0.7)";
        ctx.fillRect(x, y, 5, 2);
      } else if (scene.particle === "ember") {
        ctx.fillStyle = "rgba(255, 157, 71, 0.75)";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (scene.particle === "snow") {
        ctx.fillStyle = "rgba(235, 248, 255, 0.82)";
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(169, 221, 255, 0.6)";
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  fillPanel(rect, color = "rgba(8, 24, 43, 0.78)", radius = 10) {
    const ctx = this.ctx;
    const r = Math.min(radius, rect.width / 2, rect.height / 2);
    ctx.beginPath();
    ctx.moveTo(rect.x + r, rect.y);
    ctx.lineTo(rect.x + rect.width - r, rect.y);
    ctx.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + r);
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height - r);
    ctx.quadraticCurveTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - r, rect.y + rect.height);
    ctx.lineTo(rect.x + r, rect.y + rect.height);
    ctx.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - r);
    ctx.lineTo(rect.x, rect.y + r);
    ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  renderHome(profile, toast, treePulse = 0, elapsed = 0, audioEnabled = true, homeAction = 0) {
    const ctx = this.ctx;
    const stats = profile.getStats();
    const realm = profile.getRealm();
    const { summary, treeInfo, quickDraw, shop, pvp, ranking, actions } = this.layout;
    this.drawBackground();
    this.drawResourceBar(profile);

    this.fillPanel(summary, "rgba(8, 24, 43, 0.84)", 9);
    ctx.strokeStyle = "rgba(240, 211, 139, 0.36)";
    ctx.strokeRect(summary.x + 2, summary.y + 2, summary.width - 4, summary.height - 4);
    ctx.textAlign = "left";
    ctx.fillStyle = "#f8dfa0";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`${profile.character.name}的洞府`, summary.x + 9, summary.y + 18);
    ctx.fillStyle = "#f5c451";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`妖力 ${stats.power}`, summary.x + 9, summary.y + 35);
    ctx.textAlign = "right";
    ctx.fillStyle = "#d5e8ff";
    ctx.fillText(`冒险 第 ${profile.stage} 关`, summary.x + summary.width - 9, summary.y + 18);
    ctx.fillStyle = realm.color;
    ctx.fillText(`境界 ${realm.name}`, summary.x + summary.width - 9, summary.y + 35);

    this.drawUtilities(profile, audioEnabled);
    this.drawStatsSummary(profile);
    this.drawHomeAmbient(elapsed);
    this.drawEquipment(profile);
    this.drawTree(treePulse, elapsed);
    this.drawHero(profile, elapsed, homeAction);
    this.drawHeroTalkHint(elapsed);

    ctx.fillStyle = "rgba(7, 22, 40, 0.8)";
    ctx.fillRect(treeInfo.x, treeInfo.y, treeInfo.width, treeInfo.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#d8f5ff";
    ctx.font = "12px sans-serif";
    ctx.fillText(`灵树 ${profile.treeLevel} 级  ${profile.treeExp}/${profile.treeExpRequired}`, treeInfo.x + treeInfo.width / 2, treeInfo.y + 19);
    this.drawMiniButton(quickDraw, "#b07a35", "快速抽取");
    this.drawMiniButton(shop, "#b54b68", "角色商店");
    this.drawMiniButton(pvp, "#9a4c53", "PVP");
    this.drawMiniButton(ranking, "#6a59a5", "仙榜");

    this.drawButton(actions.chop, "#cf7f35", "砍树  仙桃 -1");
    this.drawButton(actions.cultivate, "#6f5ca8", "吐纳");
    this.drawButton(actions.challenge, "#3e7cb4", `挑战 ${profile.stage}`);
    if (toast) this.drawToast(toast);
  }

  drawUtilities(profile, audioEnabled) {
    const { explore, collection, skills, audio } = this.layout.utilities;
    const progress = profile.getCollectionProgress();
    this.drawMiniButton(explore, "#477c82", `游历 ${profile.exploreEnergy}/8`);
    this.drawMiniButton(collection, "#6d6689", `图鉴 ${progress.found}/${progress.total}`);
    this.drawSkillMiniButton(skills, profile.character.skill);
    this.drawMiniButton(audio, audioEnabled ? "#947345" : "#5b6370", audioEnabled ? "声音 开" : "声音 关");
  }

  drawMiniButton(rect, color, label) {
    this.fillPanel(rect, color, 7);
    this.ctx.strokeStyle = "rgba(242, 222, 166, 0.4)";
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = `bold ${rect.width < 100 ? 10 : 11}px sans-serif`;
    this.ctx.fillText(label, rect.x + rect.width / 2, rect.y + 19);
  }

  drawSkillMiniButton(rect, skill) {
    this.fillPanel(rect, "#8e4fa0", 7);
    this.ctx.strokeStyle = skill.color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.drawSkillIcon(rect.x + 14, rect.y + rect.height / 2, 9, skill.type, skill.color);
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = `bold ${rect.width < 86 ? 10 : 11}px sans-serif`;
    this.ctx.fillText("技能", rect.x + rect.width * 0.64, rect.y + 14);
    this.ctx.fillStyle = "#f8e6ff";
    this.ctx.font = "8px sans-serif";
    this.ctx.fillText("更换", rect.x + rect.width * 0.64, rect.y + 25);
  }

  drawStatsSummary(profile) {
    const ctx = this.ctx;
    const stats = profile.getStats();
    const rect = this.layout.statsSummary;
    this.fillPanel(rect, "rgba(5, 18, 34, 0.82)", 7);
    ctx.strokeStyle = "rgba(143, 211, 238, 0.28)";
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.textAlign = "left";
    ctx.fillStyle = "#91ddff";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("战斗属性", rect.x + 8, rect.y + 14);
    ctx.fillStyle = "#f0f7ff";
    ctx.font = `bold ${this.width < 350 ? 9 : 10}px sans-serif`;
    ctx.fillText(`气血 ${stats.hp}   攻击 ${stats.atk}   速度 ${stats.spd}`, rect.x + 67, rect.y + 14);
    ctx.fillStyle = "#c4ddf0";
    ctx.font = `${this.width < 350 ? 8 : 9}px sans-serif`;
    ctx.fillText(`会心 ${stats.crit}%   闪避 ${stats.dodge}%   连击 ${stats.combo}%   吸血 ${stats.lifesteal}%   反击 ${stats.counter}%`, rect.x + 8, rect.y + 30);
  }

  drawResourceBar(profile) {
    const ctx = this.ctx;
    const bar = this.layout.resource;
    ctx.fillStyle = "rgba(6, 18, 34, 0.9)";
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
    ctx.strokeStyle = "rgba(234, 211, 150, 0.36)";
    ctx.beginPath();
    ctx.moveTo(0, bar.y + bar.height);
    ctx.lineTo(this.width, bar.y + bar.height);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = `bold ${this.width < 350 ? 11 : 12}px sans-serif`;
    ctx.fillStyle = "#ffcb69";
    ctx.fillText(`仙桃 ${profile.peaches}`, this.width * 0.17, bar.y + 23);
    ctx.fillStyle = "#a9e9ff";
    ctx.fillText(`修为 ${profile.cultivation}`, this.width * 0.5, bar.y + 23);
    ctx.fillStyle = "#ffe477";
    ctx.fillText(`灵石 ${profile.coins}`, this.width * 0.83, bar.y + 23);
  }

  drawHomeAmbient(elapsed) {
    const ctx = this.ctx;
    ctx.save();
    for (let index = 0; index < 14; index += 1) {
      const x = (index * 53 + elapsed * (9 + index % 3)) % (this.width + 24) - 12;
      const y = this.layout.playTop + (index * 71 + elapsed * 14) % Math.max(1, this.layout.playBottom - this.layout.playTop);
      ctx.fillStyle = "rgba(145, 236, 210, 0.42)";
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + index % 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawTree(treePulse, elapsed = 0) {
    const ctx = this.ctx;
    const image = this.assets.get("tree");
    const area = this.layout.tree;
    const scale = 1 + treePulse * 0.035 + Math.sin(elapsed * 2.2) * 0.008;
    const width = area.width * scale;
    const height = area.height * scale;
    const x = area.x - (width - area.width) / 2;
    const y = area.y - (height - area.height) / 2;
    if (image) {
      ctx.save();
      ctx.shadowColor = "rgba(82, 245, 215, 0.48)";
      ctx.shadowBlur = 15;
      ctx.drawImage(image, x, y, width, height);
      ctx.restore();
    } else {
      ctx.fillStyle = "#326e5e";
      ctx.fillRect(this.width / 2 - 23, area.y + height * 0.36, 46, height * 0.64);
      ctx.fillStyle = "#45a36e";
      ctx.beginPath();
      ctx.arc(this.width / 2, area.y + height * 0.28, Math.min(78, width * 0.33), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHero(profile, elapsed = 0, homeAction = 0) {
    const ctx = this.ctx;
    const skin = profile.getEquippedCosmetics().find((item) => item.type === "skin");
    const image = this.assets.get(skin ? skin.sprite : profile.character.sprite);
    if (!image) return;
    const height = this.clamp(this.width * 0.43, 140, 190);
    const width = height * image.width / image.height;
    const bob = Math.sin(elapsed * 4) * 4;
    const isCaster = ["nova", "heal", "frost", "poison", "bomb"].includes(profile.character.skill.type);
    const isAgile = ["dash", "volley"].includes(profile.character.skill.type);
    const idleSway = isAgile ? Math.sin(elapsed * 3.2) * 7 : Math.sin(elapsed * 2.4) * 2;
    const idleScale = isCaster ? 1 + Math.sin(elapsed * 3) * 0.018 : 1 + Math.sin(elapsed * 4) * 0.01;
    const actionProgress = homeAction > 0 ? 1 - homeAction / 0.48 : 0;
    const swing = homeAction > 0 ? Math.sin(actionProgress * Math.PI) : 0;
    const heroX = this.layout.edge + 6 + swing * 36 + idleSway;
    const heroY = this.layout.treeInfo.y - height + 13 + bob;
    ctx.save();
    ctx.shadowColor = "rgba(3, 10, 20, 0.42)";
    ctx.shadowBlur = 8;
    ctx.translate(heroX + width / 2, heroY + height);
    ctx.rotate(-swing * 0.12);
    ctx.scale(idleScale, idleScale);
    ctx.drawImage(image, -width / 2, -height, width, height);
    ctx.restore();
    if (isCaster) {
      this.drawHeroAura(heroX + width / 2, heroY + height * 0.64, elapsed, profile.character.color);
    }
    if (homeAction > 0) {
      this.drawHomeSwing(swing, actionProgress, heroX + width * 0.88, heroY + height * 0.44);
    }
  }

  getHomeHeroRect() {
    const image = this.assets.get("hero-main-character");
    const height = this.clamp(this.width * 0.43, 140, 190);
    const width = image ? height * image.width / image.height : height * 0.78;
    return {
      x: this.layout.edge,
      y: this.layout.treeInfo.y - height + 5,
      width: width + 28,
      height: height + 20
    };
  }

  drawCosmetics(profile, width, height) {
    const ctx = this.ctx;
    profile.getEquippedCosmetics().forEach((item) => {
      if (item.type === "outfit") {
        ctx.fillStyle = item.color;
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.moveTo(-width * 0.28, -height * 0.49);
        ctx.lineTo(width * 0.28, -height * 0.49);
        ctx.lineTo(width * 0.36, -height * 0.05);
        ctx.lineTo(-width * 0.36, -height * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = item.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -height * 0.48);
        ctx.lineTo(0, -height * 0.07);
        ctx.stroke();
      } else if (item.type === "glasses") {
        ctx.fillStyle = item.color;
        ctx.strokeStyle = "#101419";
        ctx.lineWidth = 3;
        ctx.fillRect(-width * 0.31, -height * 0.76, width * 0.26, height * 0.1);
        ctx.fillRect(width * 0.05, -height * 0.76, width * 0.26, height * 0.1);
        ctx.beginPath();
        ctx.moveTo(-width * 0.05, -height * 0.72);
        ctx.lineTo(width * 0.05, -height * 0.72);
        ctx.stroke();
      } else if (item.type === "hat") {
        ctx.fillStyle = item.color;
        ctx.strokeStyle = item.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-width * 0.22, -height * 0.88);
        ctx.lineTo(-width * 0.12, -height * 1.02);
        ctx.lineTo(0, -height * 0.91);
        ctx.lineTo(width * 0.12, -height * 1.02);
        ctx.lineTo(width * 0.22, -height * 0.88);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });
  }

  drawHeroTalkHint(elapsed = 0) {
    const ctx = this.ctx;
    const hero = this.getHomeHeroRect();
    const width = 78;
    const height = 26;
    const x = Math.min(this.width - width - 8, hero.x + hero.width - 4);
    const y = hero.y + 20 + Math.sin(elapsed * 3) * 3;
    this.fillPanel({ x, y, width, height }, "rgba(247, 237, 215, 0.94)", 9);
    ctx.strokeStyle = "#d4a755";
    ctx.strokeRect(x, y, width, height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#6b482c";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("点我聊聊", x + width / 2, y + 17);
  }

  drawHeroAura(x, y, elapsed, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2;
    for (let index = 0; index < 3; index += 1) {
      const angle = elapsed * (1.3 + index * 0.2) + index * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 23, y + Math.sin(angle) * 10, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHomeSwing(swing, progress, x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.sin(progress * Math.PI);
    ctx.strokeStyle = "#ffe09b";
    ctx.shadowColor = "#ffbd62";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x + 29, y + 13, 43, -1.35, 0.55);
    ctx.stroke();
    ctx.fillStyle = "#fff2ba";
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      const radius = 10 + swing * 12;
      ctx.beginPath();
      ctx.arc(x + 64 + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEquipment(profile) {
    const ctx = this.ctx;
    const equipment = profile.getEquipmentList();
    const layout = this.layout.equipment;
    equipment.forEach((entry, index) => {
      const isLeft = index < 3;
      const row = index % 3;
      const x = isLeft ? this.layout.edge : this.width - this.layout.edge - layout.width;
      const y = layout.top + row * (layout.height + layout.gap);
      this.fillPanel({ x, y, width: layout.width, height: layout.height }, "rgba(8, 22, 39, 0.82)", 7);
      ctx.strokeStyle = entry.item ? entry.item.color : "rgba(196, 221, 240, 0.36)";
      ctx.strokeRect(x, y, layout.width, layout.height);
      if (entry.item && entry.item.rarity === "legend") {
        this.drawLegendAura(x + layout.width / 2, y + 18, 12, Date.now() / 1000 + index);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = entry.item ? entry.item.color : "#a7b7c5";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(entry.item ? entry.icon : "+", x + layout.width / 2, y + 18);
      ctx.font = "10px sans-serif";
      ctx.fillText(entry.item ? `${entry.name}+${entry.item.enhanceLevel || 0}` : entry.name, x + layout.width / 2, y + layout.height - 8);
    });
  }

  renderLoot(profile, item) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const comparison = profile.getEquipmentComparison(item);
    const oldItem = comparison.current;
    const difference = comparison.powerDelta;
    const modal = this.getModalLayout();
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f7edd7";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.height);
    ctx.fillStyle = "#4b3827";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.headerHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a3";
    ctx.font = `bold ${modal.scale < 0.9 ? 17 : 20}px sans-serif`;
    ctx.fillText("灵树掉落装备", this.width / 2, modal.y + 32 * modal.scale);

    ctx.fillStyle = item.color;
    if (item.rarity === "legend") {
      this.drawLegendAura(this.width / 2, modal.y + 98 * modal.scale, 44 * modal.scale, Date.now() / 1000);
    }
    ctx.beginPath();
    ctx.arc(this.width / 2, modal.y + 98 * modal.scale, 34 * modal.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${24 * modal.scale}px sans-serif`;
    ctx.fillText(item.icon, this.width / 2, modal.y + 107 * modal.scale);
    ctx.fillStyle = item.color;
    ctx.font = `bold ${16 * modal.scale}px sans-serif`;
    ctx.fillText(`${item.rarityName} · ${item.name}`, this.width / 2, modal.y + 156 * modal.scale);
    ctx.fillStyle = "#5a4637";
    ctx.font = `${13 * modal.scale}px sans-serif`;
    ctx.fillText(`${item.slotName}装备`, this.width / 2, modal.y + 178 * modal.scale);
    ctx.fillStyle = item.setColor;
    ctx.font = `bold ${12 * modal.scale}px sans-serif`;
    ctx.fillText(item.setName, this.width / 2, modal.y + 199 * modal.scale);
    ctx.fillStyle = "#8b6d4b";
    ctx.font = `bold ${11 * modal.scale}px sans-serif`;
    ctx.fillText(oldItem ? `当前：${oldItem.rarityName} · ${oldItem.name}` : "当前：该部位尚未装备", this.width / 2, modal.y + 220 * modal.scale);
    this.drawStatCompareLine("气血", oldItem ? oldItem.hp : 0, item.hp, modal.y + 242 * modal.scale, modal.scale);
    this.drawStatCompareLine("攻击", oldItem ? oldItem.atk : 0, item.atk, modal.y + 263 * modal.scale, modal.scale);
    this.drawStatCompareLine("速度", oldItem ? oldItem.spd : 0, item.spd, modal.y + 284 * modal.scale, modal.scale);
    ctx.fillStyle = "#8d5f86";
    ctx.font = `bold ${11 * modal.scale}px sans-serif`;
    ctx.fillText(oldItem ? `词条：${oldItem.traitName} +${oldItem.traitValue}% → ${item.traitName} +${item.traitValue}%` : `词条：${item.traitName} +${item.traitValue}%`, this.width / 2, modal.y + 305 * modal.scale);
    ctx.fillStyle = comparison.powerDelta >= 0 ? "#26894f" : "#bc4b45";
    ctx.font = `bold ${12 * modal.scale}px sans-serif`;
    ctx.fillText(`妖力：${comparison.currentPower} → ${item.power}  (${this.formatDelta(comparison.powerDelta)})`, this.width / 2, modal.y + 329 * modal.scale);
    this.drawButton(modal.sell, "#9b6b3f", `分解 +${item.price}`);
    this.drawButton(modal.equip, "#3c9063", "穿戴");  }

  drawLegendAura(x, y, radius, elapsed = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.strokeStyle = "#ffd86b";
    ctx.shadowColor = "#ffbd3d";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, radius + Math.sin(elapsed * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.46;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 8 + Math.sin(elapsed * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    for (let index = 0; index < 8; index += 1) {
      const angle = elapsed * 1.8 + index * Math.PI / 4;
      const distance = radius + 11 + Math.sin(elapsed * 3 + index) * 4;
      ctx.fillStyle = index % 2 ? "#fff2a8" : "#ffbd3d";
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderRanking(profile, entries, status = "") {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getSimpleModalLayout(390);
    this.drawModalShell(modal, "乌干达仙榜");
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`你的积分 ${profile.rankScore} · 胜 ${profile.pvpWins} 负 ${profile.pvpLosses}`, this.width / 2, modal.y + 76);
    ctx.fillStyle = "#9b7b52";
    ctx.font = "11px sans-serif";
    ctx.fillText(status, this.width / 2, modal.y + 94);
    entries.slice(0, 7).forEach((entry, index) => {
      const y = modal.y + 108 + index * 34;
      this.fillPanel({ x: modal.x + 15, y, width: modal.width - 30, height: 27 }, entry.self ? "rgba(60, 144, 99, 0.2)" : "rgba(91, 73, 57, 0.08)", 5);
      ctx.textAlign = "left";
      ctx.fillStyle = entry.self ? "#287b50" : "#5b4939";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(`${index + 1}. ${entry.name}`, modal.x + 25, y + 18);
      ctx.textAlign = "right";
      ctx.fillText(`${entry.score} 分`, modal.x + modal.width - 25, y + 18);
    });
    this.drawButton(modal.close, "#7f715f", "关闭");
  }

  renderPvpLobby(profile, opponents) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getSimpleModalLayout(410);
    this.drawModalShell(modal, "草原演武场");
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("本地演示匹配 · 联网后可替换为实时玩家", this.width / 2, modal.y + 74);
    opponents.forEach((entry, index) => {
      const rect = modal.rows[index];
      this.fillPanel(rect, "rgba(91, 73, 57, 0.09)", 7);
      ctx.textAlign = "left";
      ctx.fillStyle = "#5b4939";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(entry.name, rect.x + 12, rect.y + 19);
      ctx.font = "11px sans-serif";
      ctx.fillText(`${entry.realm} · 妖力 ${entry.power}`, rect.x + 12, rect.y + 37);
      ctx.textAlign = "right";
      ctx.fillStyle = "#9a4c53";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("挑战", rect.x + rect.width - 12, rect.y + 29);
    });
    this.drawButton(modal.close, "#7f715f", "关闭");
  }

  renderEnhance(profile, slot) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getSimpleModalLayout(340);
    const item = profile.getEquipped(slot);
    this.drawModalShell(modal, "装备强化");
    ctx.textAlign = "center";
    ctx.fillStyle = item ? item.color : "#8b6d4b";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(item ? `${item.name}  +${item.enhanceLevel || 0}` : "该部位尚未装备", this.width / 2, modal.y + 95);
    if (item) {
      const level = item.enhanceLevel || 0;
      ctx.fillStyle = "#5b4939";
      ctx.font = "12px sans-serif";
      ctx.fillText(`当前加成：基础属性 +${level * 8}%`, this.width / 2, modal.y + 132);
      ctx.fillText(level >= 15 ? "已达到最高强化等级" : `下一级：基础属性 +${(level + 1) * 8}%`, this.width / 2, modal.y + 158);
      this.drawButton(modal.action, level >= 15 ? "#6f6a61" : "#b07a35", level >= 15 ? "已满级" : `强化 -${profile.getEnhanceCost(slot)} 灵石`);
    }
    this.drawButton(modal.close, "#7f715f", "关闭");
  }

  getSimpleModalLayout(height) {
    const width = Math.min(356, this.width - 24);
    const actualHeight = Math.min(height, this.layout.safeBottom - this.layout.contentTop - 22);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - actualHeight) / 2;
    return {
      x, y, width, height: actualHeight,
      headerHeight: 50,
      rows: Array.from({ length: 4 }, (_, index) => ({ x: x + 16, y: y + 92 + index * 59, width: width - 32, height: 50 })),
      action: { x: x + 28, y: y + actualHeight - 118, width: width - 56, height: 43 },
      close: { x: x + 28, y: y + actualHeight - 62, width: width - 56, height: 43 }
    };
  }

  drawModalShell(modal, title) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.64)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f7edd7";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.height);
    ctx.fillStyle = "#4b3827";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.headerHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(title, this.width / 2, modal.y + 32);
  }

  renderCollection(profile, page = 0) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getCollectionLayout();
    const section = profile.getCollectionSection(page);
    const progress = profile.getCollectionProgress();
    ctx.fillStyle = "rgba(0, 0, 0, 0.64)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f7edd7";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.height);
    ctx.fillStyle = "#4b3827";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.headerHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("装备图鉴", this.width / 2, modal.y + 32);
    ctx.fillStyle = "#765a42";
    ctx.font = "13px sans-serif";
    ctx.fillText(`总收集 ${progress.found}/${progress.total}`, this.width / 2, modal.y + 73);
    ctx.fillStyle = "#5b4939";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`${section.slot.icon} ${section.slot.name}  ${section.found}/${section.items.length}`, this.width / 2, modal.y + 101);

    section.items.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = modal.x + 16 + column * (modal.itemWidth + modal.itemGap);
      const y = modal.y + 123 + row * 34;
      this.fillPanel({ x, y, width: modal.itemWidth, height: 27 }, item.found ? "rgba(60, 144, 99, 0.16)" : "rgba(91, 73, 57, 0.08)", 5);
      ctx.textAlign = "left";
      ctx.fillStyle = item.found ? "#317d54" : "#a49789";
      ctx.font = `${modal.itemWidth < 145 ? 10 : 11}px sans-serif`;
      ctx.fillText(item.found ? item.name : "尚未发现", x + 8, y + 18);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#8b6d4b";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${section.page + 1} / ${section.pageCount}`, this.width / 2, modal.y + modal.height - 91);
    this.drawButton(modal.previous, "#7f715f", "上一页");
    this.drawButton(modal.close, "#9b6b3f", "关闭");
    this.drawButton(modal.next, "#477fa8", "下一页");
  }

  getCollectionLayout() {
    const width = Math.min(356, this.width - 24);
    const height = Math.min(458, this.layout.safeBottom - this.layout.contentTop - 22);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const itemGap = 8;
    const itemWidth = (width - 40) / 2;
    const buttonGap = 8;
    const buttonWidth = (width - 40 - buttonGap * 2) / 3;
    const buttonY = y + height - 67;
    return {
      x, y, width, height, itemGap, itemWidth,
      headerHeight: 50,
      previous: { x: x + 12, y: buttonY, width: buttonWidth, height: 45 },
      close: { x: x + 12 + buttonWidth + buttonGap, y: buttonY, width: buttonWidth, height: 45 },
      next: { x: x + 12 + (buttonWidth + buttonGap) * 2, y: buttonY, width: buttonWidth, height: 45 }
    };
  }

  renderQuickDraw(profile, results = [], elapsed = 0) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getQuickDrawLayout();
    ctx.fillStyle = "rgba(0, 0, 0, 0.64)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f7edd7";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.height);
    ctx.fillStyle = "#4b3827";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.headerHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("灵树快速抽取", this.width / 2, modal.y + 32);
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.fillText(`当前仙桃 ${profile.peaches} · 每次抽取消耗 1 个仙桃`, this.width / 2, modal.y + 73);

    if (!results.length) {
      ctx.fillStyle = "#5b4939";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("选择抽取次数", this.width / 2, modal.y + 123);
      modal.countButtons.forEach((entry) => {
        this.drawButton(entry.rect, "#b07a35", `${entry.count} 次`);
      });
      ctx.fillStyle = "#8b6d4b";
      ctx.font = "12px sans-serif";
      ctx.fillText("金色神品装备会出现特殊光效", this.width / 2, modal.y + 284);
      this.drawButton(modal.close, "#7f715f", "关闭");
      return;
    }

    const synthesis = getSynthesisCandidate(results);
    const synthesisComparison = synthesis ? profile.getEquipmentComparison(synthesis.product) : null;
    const legendCount = results.filter((item) => item.rarity === "legend").length;
    ctx.fillStyle = legendCount ? "#c18415" : "#765a42";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`抽取完成：${results.length} 件 · 金色神品 ${legendCount} 件`, this.width / 2, modal.y + 106);
    ctx.fillStyle = synthesis ? "#8f5f34" : "#8b6d4b";
    ctx.font = "11px sans-serif";
    ctx.fillText(synthesis ? `可合成：${synthesis.product.name} · 妖力 ${this.formatDelta(synthesisComparison.powerDelta)}` : "同部位 3 件装备可合成，优先消耗较弱装备", this.width / 2, modal.y + 126);

    results.slice(0, 6).forEach((item, index) => {
      const rect = modal.resultCards[index];
      this.fillPanel(rect, item.rarity === "legend" ? "rgba(255, 210, 80, 0.18)" : "rgba(91, 73, 57, 0.08)", 7);
      ctx.strokeStyle = item.color;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      if (item.rarity === "legend") {
        this.drawLegendAura(rect.x + 20, rect.y + rect.height / 2, 14, elapsed + index);
      }
      ctx.textAlign = "left";
      ctx.fillStyle = item.color;
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(item.icon, rect.x + 13, rect.y + 22);
      ctx.fillStyle = "#4b3827";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(item.name, rect.x + 38, rect.y + 17);
      ctx.fillStyle = "#816d5d";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${item.rarityName} · 妖力 ${item.power}`, rect.x + 38, rect.y + 34);
    });
    this.drawButton(modal.synthesize, synthesis ? "#8f5f34" : "#6f6a61", synthesis ? `合成 ${synthesis.product.rarityName}` : "合成 x3");
    this.drawButton(modal.sell, "#9b6b3f", "全部分解");
    this.drawButton(modal.equip, "#3c9063", "装备最强");
    this.drawButton(modal.close, "#7f715f", "关闭");
  }

  getQuickDrawLayout() {
    const width = Math.min(356, this.width - 24);
    const height = Math.min(478, this.layout.safeBottom - this.layout.contentTop - 22);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const countGap = 9;
    const countWidth = (width - 46 - countGap) / 2;
    const countY = y + 148;
    const cardGap = 7;
    const cardWidth = (width - 35) / 2;
    const cardY = y + 143;
    return {
      x, y, width, height,
      headerHeight: 50,
      countButtons: [10, 20, 50, 100].map((count, index) => ({
        count,
        rect: {
          x: x + 18 + (index % 2) * (countWidth + countGap),
          y: countY + Math.floor(index / 2) * 59,
          width: countWidth,
          height: 47
        }
      })),
      resultCards: Array.from({ length: 6 }, (_, index) => ({
        x: x + 14 + (index % 2) * (cardWidth + cardGap),
        y: cardY + Math.floor(index / 2) * 52,
        width: cardWidth,
        height: 44
      })),
      synthesize: { x: x + 18, y: y + height - 109, width: width - 36, height: 38 },
      sell: { x: x + 14, y: y + height - 61, width: width * 0.29, height: 43 },
      equip: { x: x + width * 0.36, y: y + height - 61, width: width * 0.34, height: 43 },
      close: { x: x + width * 0.73, y: y + height - 61, width: width * 0.23, height: 43 }
    };
  }

  renderShop(profile, wheelResult = "") {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getShopLayout();
    const cosmetics = profile.getCosmetics();
    ctx.fillStyle = "rgba(0, 0, 0, 0.64)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f7edd7";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.height);
    ctx.fillStyle = "#4b3827";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.headerHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("角色皮肤商店", this.width / 2, modal.y + 32);
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.fillText(`当前灵石 ${profile.coins} · 皮肤自带属性加成`, this.width / 2, modal.y + 72);

    cosmetics.forEach((item, index) => {
      const rect = modal.cosmeticRows[index];
      this.fillPanel(rect, item.equipped ? "rgba(60, 144, 99, 0.22)" : "rgba(91, 73, 57, 0.08)", 7);
      ctx.strokeStyle = item.equipped ? "#3c9063" : "rgba(118, 90, 66, 0.24)";
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.textAlign = "left";
      ctx.fillStyle = item.color;
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("衣", rect.x + 12, rect.y + 25);
      ctx.fillStyle = "#4b3827";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(item.name, rect.x + 42, rect.y + 16);
      ctx.fillStyle = "#816d5d";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${item.bonusText}${item.owned ? "" : ` · ${item.price} 灵石`}`, rect.x + 42, rect.y + 32);
      ctx.textAlign = "right";
      ctx.fillStyle = item.equipped ? "#317d54" : "#8b6d4b";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(item.equipped ? "已装备" : item.owned ? "换上" : "购买", rect.x + rect.width - 10, rect.y + 28);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#765a42";
    ctx.font = "11px sans-serif";
    ctx.fillText(wheelResult || "转盘可抽取灵石、仙桃和随机外观", this.width / 2, modal.wheel.y - 13);
    this.drawButton(modal.wheel, "#b07a35", "转盘抽奖 -20 灵石");
    this.drawButton(modal.close, "#7f715f", "关闭");
  }

  getShopLayout() {
    const width = Math.min(356, this.width - 24);
    const height = Math.min(470, this.layout.safeBottom - this.layout.contentTop - 22);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const rowX = x + 14;
    const rowWidth = width - 28;
    const rowHeight = 38;
    const rowGap = 4;
    const rowY = y + 82;
    return {
      x, y, width, height,
      headerHeight: 50,
      cosmeticRows: Array.from({ length: 6 }, (_, index) => ({
        x: rowX,
        y: rowY + index * (rowHeight + rowGap),
        width: rowWidth,
        height: rowHeight
      })),
      wheel: { x: x + 18, y: y + height - 61, width: width * 0.57, height: 43 },
      close: { x: x + width * 0.62, y: y + height - 61, width: width * 0.32, height: 43 }
    };
  }

  renderSkills(profile) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getSkillsLayout();
    const skills = profile.getSkills();
    ctx.fillStyle = "rgba(0, 0, 0, 0.64)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f7edd7";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.height);
    ctx.fillStyle = "#4b3827";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.headerHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("更换技能", this.width / 2, modal.y + 32);
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.fillText("点击技能即可装备，战斗中自动释放", this.width / 2, modal.y + 72);

    skills.forEach((skill, index) => {
      const rect = modal.skillRows[index];
      this.fillPanel(rect, skill.selected ? "rgba(60, 144, 99, 0.2)" : "rgba(91, 73, 57, 0.08)", 7);
      ctx.strokeStyle = skill.selected ? "#3c9063" : "rgba(118, 90, 66, 0.24)";
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      this.drawSkillIcon(rect.x + 20, rect.y + rect.height / 2, 13, skill.type, skill.color);
      ctx.textAlign = "left";
      ctx.fillStyle = "#4b3827";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(skill.name, rect.x + 42, rect.y + 18);
      ctx.fillStyle = "#816d5d";
      ctx.font = "10px sans-serif";
      ctx.fillText(skill.description, rect.x + 42, rect.y + 35);
      ctx.textAlign = "right";
      ctx.fillStyle = skill.selected ? "#317d54" : "#8b6d4b";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(skill.selected ? "已装备" : `${skill.cooldown.toFixed(1)}秒`, rect.x + rect.width - 9, rect.y + 27);
    });
    this.drawButton(modal.close, "#9b6b3f", "完成");
  }

  getSkillsLayout() {
    const width = Math.min(356, this.width - 24);
    const height = Math.min(452, this.layout.safeBottom - this.layout.contentTop - 22);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const rowX = x + 14;
    const rowWidth = width - 28;
    const rowHeight = 45;
    const rowGap = 7;
    const rowY = y + 88;
    return {
      x, y, width, height,
      headerHeight: 50,
      skillRows: Array.from({ length: 5 }, (_, index) => ({
        x: rowX,
        y: rowY + index * (rowHeight + rowGap),
        width: rowWidth,
        height: rowHeight
      })),
      close: { x: x + 70, y: y + height - 60, width: width - 140, height: 43 }
    };
  }

  drawSkillIcon(x, y, radius, type, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = radius * 0.72;
    ctx.lineWidth = Math.max(1.5, radius * 0.18);
    if (type === "wave") {
      ctx.beginPath();
      ctx.arc(-radius * 0.12, 0, radius * 0.88, -1.04, 1.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-radius * 0.44, 0, radius * 0.72, -0.88, 0.88);
      ctx.stroke();
    } else if (type === "flame") {
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.quadraticCurveTo(radius * 0.82, -radius * 0.06, radius * 0.34, radius * 0.82);
      ctx.quadraticCurveTo(0, radius * 1.08, -radius * 0.46, radius * 0.62);
      ctx.quadraticCurveTo(-radius * 0.8, 0, 0, -radius);
      ctx.fill();
    } else if (type === "thunder") {
      ctx.beginPath();
      ctx.moveTo(radius * 0.08, -radius);
      ctx.lineTo(-radius * 0.56, radius * 0.08);
      ctx.lineTo(-radius * 0.02, radius * 0.08);
      ctx.lineTo(-radius * 0.3, radius);
      ctx.lineTo(radius * 0.66, -radius * 0.18);
      ctx.lineTo(radius * 0.12, -radius * 0.18);
      ctx.closePath();
      ctx.fill();
    } else if (type === "frost") {
      for (let index = 0; index < 3; index += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-radius, 0);
        ctx.lineTo(radius, 0);
        ctx.moveTo(radius * 0.54, 0);
        ctx.lineTo(radius * 0.78, -radius * 0.24);
        ctx.moveTo(radius * 0.54, 0);
        ctx.lineTo(radius * 0.78, radius * 0.24);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
      ctx.stroke();
      for (let index = 0; index < 3; index += 1) {
        const angle = index * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * radius * 0.86, Math.sin(angle) * radius * 0.86, radius * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  getModalLayout() {
    const maxWidth = Math.min(340, this.width - 24);
    const maxHeight = this.layout.safeBottom - this.layout.contentTop - 22;
    const scale = Math.min(1, maxWidth / 340, maxHeight / 414);
    const width = 340 * scale;
    const height = 414 * scale;
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (maxHeight - height) / 2;
    const buttonY = y + height - 65 * scale;
    const buttonWidth = 127 * scale;
    const buttonHeight = 47 * scale;
    return {
      x, y, width, height, scale,
      headerHeight: 50 * scale,
      sell: { x: x + 19 * scale, y: buttonY, width: buttonWidth, height: buttonHeight },
      equip: { x: x + width - 19 * scale - buttonWidth, y: buttonY, width: buttonWidth, height: buttonHeight }
    };
  }

  drawStatLine(label, value, y) {
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "#5a4637";
    this.ctx.font = "13px sans-serif";
    this.ctx.fillText(`${label} +${value}`, this.width / 2, y);
  }

  formatDelta(value) {
    return `${value >= 0 ? "+" : ""}${value}`;
  }

  drawStatCompareLine(label, current, incoming, y, scale = 1) {
    const delta = incoming - current;
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = delta >= 0 ? "#26894f" : "#bc4b45";
    this.ctx.font = `bold ${12 * scale}px sans-serif`;
    this.ctx.fillText(`${label}：${current} → ${incoming}  (${this.formatDelta(delta)})`, this.width / 2, y);
  }

  renderBattle(profile, battle) {
    const ctx = this.ctx;
    const top = this.layout.summary.y + 7;
    const battleLayout = this.getBattleLayout();
    const { healthY, fighterBaseY, messageY, heroHeight, enemyHeight, stageY } = battleLayout;
    const shakeX = battle.screenShake > 0 ? Math.sin(battle.elapsed * 83) * battle.screenShake : 0;
    const shakeY = battle.screenShake > 0 ? Math.cos(battle.elapsed * 71) * battle.screenShake * 0.45 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawSceneBackground(battle.scene, battle.elapsed);
    this.drawResourceBar(profile);
    this.fillPanel({ x: this.layout.edge, y: top, width: this.width - this.layout.edge * 2, height: 58 }, "rgba(5, 18, 34, 0.76)", 9);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe3a0";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(battle.isPvp ? `演武场 · 对阵 ${battle.enemy.name}` : `${battle.enemy.isBoss ? "首领挑战" : "冒险挑战"} · 第 ${battle.stage} 关`, this.width / 2, top + 21);
    ctx.fillStyle = battle.scene.accent;
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`${battle.scene.name} · ${battle.scene.modifierName}`, this.width / 2, top + 42);
    ctx.fillStyle = "#d4e9f8";
    ctx.font = "10px sans-serif";
    ctx.fillText("自动战斗", this.width / 2, top + 55);

    this.drawBattleStage(stageY, battle.scene.accent);
    const heroIdle = Math.sin(battle.elapsed * 4) * 3;
    const enemyIdle = Math.sin(battle.elapsed * 4.5 + 1) * 3;
    const heroLunge = battle.heroAction > 0 ? Math.sin((battle.heroAction / 0.34) * Math.PI) * (battle.skillAction > 0 ? 48 : 34) : 0;
    const enemyLunge = battle.enemyAction > 0 ? Math.sin((battle.enemyAction / 0.3) * Math.PI) * 29 : 0;
    const heroWidth = this.getSpriteWidth(profile.character.sprite, heroHeight);
    const enemySprite = battle.enemy.sprite || `enemy-${battle.enemy.type}`;
    const bossScale = battle.enemy.scale || 1;
    const scaledEnemyHeight = enemyHeight * bossScale;
    const enemyWidth = this.getSpriteWidth(enemySprite, scaledEnemyHeight);
    const skin = profile.getEquippedCosmetics().find((item) => item.type === "skin");
    this.drawBattleFighter(skin ? skin.sprite : profile.character.sprite, this.width * 0.09 + heroLunge, fighterBaseY - heroHeight + heroIdle, heroHeight, {
      flip: false,
      shake: battle.enemyAction > 0 ? 2 : 0
    });
    this.drawBattleFighter(enemySprite, this.width - this.width * 0.09 - enemyWidth - enemyLunge, fighterBaseY - scaledEnemyHeight + enemyIdle, scaledEnemyHeight, {
      flip: true,
      shake: battle.heroAction > 0 ? 2 : 0,
      boss: battle.enemy.isBoss ? battle.enemy : null
    });
    const barWidth = Math.min(140, this.width * 0.38);
    this.drawHealthBar(this.layout.edge + 10, healthY, barWidth, battle.heroHp / battle.heroMaxHp, battle.heroDisplayedHp / battle.heroMaxHp, "#63c981", profile.character.name);
    this.drawHealthBar(this.width - this.layout.edge - barWidth - 10, healthY, barWidth, battle.enemy.hp / battle.enemy.maxHp, battle.enemyDisplayedHp / battle.enemy.maxHp, "#e3695f", battle.enemy.name);
    this.drawBattleEffects(battle, fighterBaseY - heroHeight * 0.62);
    this.drawSkillGauge(profile, battle, messageY - 24);
    this.fillPanel({ x: this.layout.edge + 20, y: messageY, width: this.width - this.layout.edge * 2 - 40, height: 43 }, "rgba(6, 18, 34, 0.82)", 8);
    ctx.fillStyle = "#d9ecfa";
    ctx.font = "12px sans-serif";
    ctx.fillText(battle.message, this.width / 2, messageY + 26);
    if (battle.talk && battle.talkTime > 0) {
      const talkWidth = Math.min(238, this.width - 42);
      const talkX = (this.width - talkWidth) / 2;
      this.fillPanel({ x: talkX, y: messageY - 74, width: talkWidth, height: 34 }, "rgba(247, 237, 215, 0.94)", 9);
      ctx.fillStyle = "#5b4939";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(battle.talk, this.width / 2, messageY - 52);
    }
    if (battle.introTime > 0) {
      this.drawBattleIntro(battle);
    }
    ctx.restore();
    if (battle.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.34, battle.screenFlash * 0.5)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  getBattleLayout() {
    const safeHeight = this.layout.safeBottom - this.layout.contentTop;
    const healthY = this.clamp(this.height * 0.7, this.layout.contentTop + 315, this.layout.safeBottom - 112);
    const messageY = Math.min(this.layout.safeBottom - 55, healthY + 39);
    const fighterBaseY = healthY - 25;
    const heroHeight = this.clamp(this.width * 0.41, 136, Math.min(182, safeHeight * 0.34));
    const enemyHeight = heroHeight * 1.04;
    return {
      healthY,
      fighterBaseY,
      messageY,
      heroHeight,
      enemyHeight,
      stageY: fighterBaseY - 22
    };
  }

  getSpriteWidth(sprite, height) {
    const image = this.assets.get(sprite);
    return image ? height * image.width / image.height : height * 0.78;
  }

  drawBattleIntro(battle) {
    const ctx = this.ctx;
    const alpha = Math.min(1, battle.introTime * 2);
    ctx.save();
    ctx.fillStyle = `rgba(3, 10, 22, ${0.42 * alpha})`;
    ctx.fillRect(0, this.height * 0.38, this.width, 78);
    ctx.textAlign = "center";
    ctx.fillStyle = battle.enemy.isBoss ? "#ffbc74" : battle.scene.accent;
    ctx.font = `bold ${battle.enemy.isBoss ? 27 : 22}px sans-serif`;
    ctx.fillText(battle.enemy.isBoss ? "首领现身" : battle.scene.name, this.width / 2, this.height * 0.38 + 35);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(battle.enemy.isBoss ? battle.enemy.name : battle.scene.modifierName, this.width / 2, this.height * 0.38 + 57);
    ctx.restore();
  }

  drawSkillGauge(profile, battle, y) {
    const ctx = this.ctx;
    const width = Math.min(164, this.width * 0.44);
    const x = this.width / 2 - width / 2;
    const cooldown = Math.max(2.2, profile.character.skill.cooldown * 0.72);
    const ratio = 1 - Math.min(1, Math.max(0, battle.skillTimer) / cooldown);
    ctx.fillStyle = "rgba(4, 15, 28, 0.72)";
    ctx.fillRect(x, y, width, 14);
    ctx.fillStyle = profile.character.skill.color;
    ctx.fillRect(x, y, width * ratio, 14);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
    ctx.strokeRect(x, y, width, 14);
    this.drawSkillIcon(x - 10, y + 7, 7, profile.character.skill.type, profile.character.skill.color);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(`${profile.character.skill.name} ${battle.skillTimer <= 0 ? "释放" : "蓄力"}`, this.width / 2, y + 11);
  }

  drawBattleStage(y, accent) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(5, 14, 28, 0.34)";
    ctx.beginPath();
    ctx.ellipse(this.width / 2, y + 25, this.width * 0.46, 29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.width / 2, y + 22, this.width * 0.38, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(this.width / 2, y + 22, this.width * 0.27, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBattleFighter(sprite, x, y, height, options = {}) {
    const image = this.assets.get(sprite);
    if (!image) return;
    const width = height * image.width / image.height;
    const shakeX = options.shake ? Math.sin(Date.now() / 18) * options.shake : 0;
    const ctx = this.ctx;
    ctx.save();
    if (options.boss) {
      this.drawBossAura(x + width / 2, y + height * 0.56, width, height, options.boss);
      ctx.shadowColor = options.boss.aura;
      ctx.shadowBlur = 18;
    }
    if (options.flip) {
      ctx.translate(x + width + shakeX, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, y, width, height);
    } else {
      ctx.drawImage(image, x + shakeX, y, width, height);
    }
    ctx.restore();
    if (options.boss) {
      this.drawBossOrnament(x, y, width, height, options.boss);
    }
  }

  drawBossAura(x, y, width, height, boss) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = boss.accent;
    ctx.shadowColor = boss.aura;
    ctx.shadowBlur = 16;
    ctx.globalAlpha = 0.54;
    ctx.lineWidth = 3;
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath();
      ctx.ellipse(x, y, width * (0.48 + index * 0.1), height * (0.42 + index * 0.08), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBossOrnament(x, y, width, height, boss) {
    const ctx = this.ctx;
    const centerX = x + width / 2;
    const topY = y + height * 0.08;
    ctx.save();
    ctx.strokeStyle = boss.accent;
    ctx.fillStyle = boss.accent;
    ctx.shadowColor = boss.aura;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    if (boss.ornament === "horns") {
      ctx.beginPath();
      ctx.moveTo(centerX - 22, topY + 13);
      ctx.lineTo(centerX - 36, topY - 16);
      ctx.lineTo(centerX - 8, topY + 5);
      ctx.moveTo(centerX + 22, topY + 13);
      ctx.lineTo(centerX + 36, topY - 16);
      ctx.lineTo(centerX + 8, topY + 5);
      ctx.stroke();
    } else if (boss.ornament === "crown") {
      ctx.beginPath();
      ctx.moveTo(centerX - 30, topY + 9);
      ctx.lineTo(centerX - 25, topY - 15);
      ctx.lineTo(centerX - 8, topY + 1);
      ctx.lineTo(centerX, topY - 22);
      ctx.lineTo(centerX + 8, topY + 1);
      ctx.lineTo(centerX + 25, topY - 15);
      ctx.lineTo(centerX + 30, topY + 9);
      ctx.closePath();
      ctx.fill();
    } else if (boss.ornament === "halo") {
      ctx.beginPath();
      ctx.ellipse(centerX, topY, width * 0.34, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (boss.ornament === "fangs") {
      ctx.beginPath();
      ctx.moveTo(centerX - 29, topY + 12);
      ctx.lineTo(centerX - 18, topY + 42);
      ctx.lineTo(centerX - 7, topY + 13);
      ctx.moveTo(centerX + 29, topY + 12);
      ctx.lineTo(centerX + 18, topY + 42);
      ctx.lineTo(centerX + 7, topY + 13);
      ctx.stroke();
    } else if (boss.ornament === "lightning") {
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(centerX + side * 27, topY - 12);
        ctx.lineTo(centerX + side * 40, topY + 5);
        ctx.lineTo(centerX + side * 27, topY + 15);
        ctx.lineTo(centerX + side * 43, topY + 35);
        ctx.stroke();
      }
    } else if (boss.ornament === "moon") {
      ctx.beginPath();
      ctx.arc(centerX, topY + 4, 24, -1.2, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX + 11, topY + 4, 20, -1.2, 1.2);
      ctx.stroke();
    } else if (boss.ornament === "blades") {
      for (let index = 0; index < 4; index += 1) {
        const side = index % 2 === 0 ? -1 : 1;
        const offsetY = Math.floor(index / 2) * 27;
        ctx.beginPath();
        ctx.moveTo(centerX + side * 31, topY + offsetY);
        ctx.lineTo(centerX + side * 57, topY - 13 + offsetY);
        ctx.lineTo(centerX + side * 43, topY + 18 + offsetY);
        ctx.stroke();
      }
    } else if (boss.ornament === "petals") {
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI * 2 / 8;
        ctx.beginPath();
        ctx.ellipse(centerX + Math.cos(angle) * 38, topY + 22 + Math.sin(angle) * 25, 6, 15, angle, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (boss.ornament === "flames") {
      for (let index = -2; index <= 2; index += 1) {
        ctx.beginPath();
        ctx.moveTo(centerX + index * 17, topY + 19);
        ctx.quadraticCurveTo(centerX + index * 17 + 10, topY - 17, centerX + index * 17, topY - 28);
        ctx.quadraticCurveTo(centerX + index * 17 - 10, topY - 2, centerX + index * 17, topY + 19);
        ctx.stroke();
      }
    } else if (boss.ornament === "runes") {
      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI * 2 / 6;
        const runeX = centerX + Math.cos(angle) * 53;
        const runeY = topY + 32 + Math.sin(angle) * 42;
        ctx.strokeRect(runeX - 5, runeY - 5, 10, 10);
      }
    } else if (boss.ornament === "skulls") {
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.arc(centerX + side * 35, topY + 5, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(centerX + side * 35 - 7, topY + 14, 14, 8);
      }
    } else if (boss.ornament === "wings") {
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(centerX + side * 18, topY + 15);
        ctx.quadraticCurveTo(centerX + side * 70, topY - 27, centerX + side * 66, topY + 38);
        ctx.quadraticCurveTo(centerX + side * 47, topY + 15, centerX + side * 18, topY + 15);
        ctx.stroke();
      }
    } else if (boss.ornament === "crystals") {
      for (let index = -2; index <= 2; index += 1) {
        const crystalX = centerX + index * 18;
        const crystalHeight = index === 0 ? 38 : 25 + Math.abs(index) * 4;
        ctx.beginPath();
        ctx.moveTo(crystalX, topY - crystalHeight);
        ctx.lineTo(crystalX + 9, topY + 3);
        ctx.lineTo(crystalX, topY + 13);
        ctx.lineTo(crystalX - 9, topY + 3);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (boss.ornament === "tentacles") {
      for (let index = -2; index <= 2; index += 1) {
        ctx.beginPath();
        ctx.moveTo(centerX + index * 14, topY + 8);
        ctx.bezierCurveTo(centerX + index * 23, topY + 30, centerX - index * 32, topY + 40, centerX + index * 35, topY + 67);
        ctx.stroke();
      }
    } else if (boss.ornament === "stingers") {
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(centerX + side * 22, topY + 15);
        ctx.quadraticCurveTo(centerX + side * 62, topY - 33, centerX + side * 48, topY + 31);
        ctx.lineTo(centerX + side * 61, topY + 21);
        ctx.stroke();
      }
    } else if (boss.ornament === "hourglass") {
      ctx.beginPath();
      ctx.moveTo(centerX - 24, topY - 24);
      ctx.lineTo(centerX + 24, topY - 24);
      ctx.lineTo(centerX - 20, topY + 31);
      ctx.lineTo(centerX + 20, topY + 31);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX - 17, topY - 17);
      ctx.lineTo(centerX, topY + 1);
      ctx.lineTo(centerX + 17, topY - 17);
      ctx.moveTo(centerX - 15, topY + 24);
      ctx.lineTo(centerX, topY + 3);
      ctx.lineTo(centerX + 15, topY + 24);
      ctx.stroke();
    } else if (boss.ornament === "chains") {
      for (let side = -1; side <= 1; side += 2) {
        for (let index = 0; index < 4; index += 1) {
          ctx.beginPath();
          ctx.ellipse(centerX + side * (29 + index * 9), topY - 14 + index * 18, 8, 5, side * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (boss.ornament === "sun") {
      ctx.beginPath();
      ctx.arc(centerX, topY + 3, 23, 0, Math.PI * 2);
      ctx.stroke();
      for (let index = 0; index < 10; index += 1) {
        const angle = index * Math.PI * 2 / 10;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * 29, topY + 3 + Math.sin(angle) * 29);
        ctx.lineTo(centerX + Math.cos(angle) * 43, topY + 3 + Math.sin(angle) * 43);
        ctx.stroke();
      }
    } else if (boss.ornament === "vines") {
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(centerX + side * 14, topY - 20);
        ctx.bezierCurveTo(centerX + side * 58, topY - 2, centerX + side * 18, topY + 31, centerX + side * 54, topY + 58);
        ctx.stroke();
        for (let index = 0; index < 3; index += 1) {
          ctx.beginPath();
          ctx.ellipse(centerX + side * (29 + index * 8), topY + index * 20, 8, 4, side * 0.72, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (boss.ornament === "masks") {
      for (let index = -1; index <= 1; index += 1) {
        const maskX = centerX + index * 34;
        const maskY = topY + Math.abs(index) * 15;
        ctx.beginPath();
        ctx.ellipse(maskX, maskY, 14, 19, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(maskX - 5, maskY - 3, 2, 0, Math.PI * 2);
        ctx.arc(maskX + 5, maskY - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawBattleEffects(battle, fighterY) {
    const ctx = this.ctx;
    battle.effects.forEach((effect) => {
      const progress = 1 - effect.life / effect.maxLife;
      const targetX = effect.side === "enemy" ? this.width * 0.72 : this.width * 0.28;
      const targetY = fighterY + 37 + effect.y;
      ctx.save();
      ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
      if (effect.type === "slash") {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(targetX - 26, targetY + 25);
        ctx.lineTo(targetX + 30, targetY - 27);
        ctx.stroke();
      } else if (effect.type === "orb") {
        const startX = this.width * 0.72;
        const endX = this.width * 0.28;
        const x = startX + (endX - startX) * progress;
        ctx.fillStyle = "#9d82ff";
        ctx.shadowColor = "#7554ff";
        ctx.shadowBlur = 13;
        ctx.beginPath();
        ctx.arc(x, targetY, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.type === "impact") {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 11 + progress * 17, 0, Math.PI * 2);
        ctx.stroke();
      } else if (effect.type === "skill" || effect.type === "skill-wave") {
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 18 + progress * 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(targetX, targetY, 10 + progress * 22, 0, Math.PI * 2);
        ctx.stroke();
      } else if (effect.type === "skill-flame") {
        ctx.fillStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 18;
        for (let index = 0; index < 9; index += 1) {
          const angle = index * Math.PI * 2 / 9;
          const radius = 14 + progress * 39;
          ctx.beginPath();
          ctx.arc(targetX + Math.cos(angle) * radius, targetY + Math.sin(angle) * radius, 9 - progress * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === "skill-thunder") {
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 19;
        ctx.lineWidth = 5;
        for (let index = -1; index <= 1; index += 1) {
          ctx.beginPath();
          ctx.moveTo(targetX + index * 18 - 9, targetY - 54);
          ctx.lineTo(targetX + index * 18 + 8, targetY - 20);
          ctx.lineTo(targetX + index * 18 - 6, targetY + 2);
          ctx.lineTo(targetX + index * 18 + 11, targetY + 43);
          ctx.stroke();
        }
      } else if (effect.type === "skill-frost") {
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 4;
        for (let index = 0; index < 10; index += 1) {
          const angle = index * Math.PI * 2 / 10;
          const radius = 16 + progress * 42;
          ctx.beginPath();
          ctx.moveTo(targetX + Math.cos(angle) * 8, targetY + Math.sin(angle) * 8);
          ctx.lineTo(targetX + Math.cos(angle) * radius, targetY + Math.sin(angle) * radius);
          ctx.stroke();
        }
      } else if (effect.type === "skill-orbit") {
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 4;
        for (let index = 0; index < 3; index += 1) {
          const radius = 20 + index * 13 + progress * 14;
          ctx.beginPath();
          ctx.arc(targetX, targetY, radius, progress * Math.PI + index, progress * Math.PI + index + Math.PI * 1.35);
          ctx.stroke();
        }
      } else if (effect.type === "burst") {
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 15;
        ctx.lineWidth = 4;
        for (let index = 0; index < 8; index += 1) {
          const angle = Math.PI * 2 * index / 8;
          const inner = 7 + progress * 8;
          const outer = 18 + progress * 34;
          ctx.beginPath();
          ctx.moveTo(targetX + Math.cos(angle) * inner, targetY + Math.sin(angle) * inner);
          ctx.lineTo(targetX + Math.cos(angle) * outer, targetY + Math.sin(angle) * outer);
          ctx.stroke();
        }
      }
      if (effect.text) {
        ctx.textAlign = "center";
        ctx.fillStyle = effect.color;
        ctx.font = effect.text.includes("暴击") ? "bold 18px sans-serif" : "bold 15px sans-serif";
        ctx.fillText(effect.text, targetX + effect.x, targetY - 15);
      }
      ctx.restore();
    });
  }

  drawHealthBar(x, y, width, ratio, delayedRatio, color, label) {
    const ctx = this.ctx;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(label, x, y - 7);
    ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
    ctx.fillRect(x, y, width, 12);
    ctx.fillStyle = "#f3cd73";
    ctx.fillRect(x, y, width * Math.max(0, delayedRatio), 12);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * Math.max(0, ratio), 12);
  }

  renderBattleResult(profile, battle) {
    this.renderBattle(profile, battle);
    const ctx = this.ctx;
    const modal = this.getResultLayout();
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f8edd6";
    ctx.fillRect(modal.x, modal.y, modal.width, modal.height);
    ctx.textAlign = "center";
    ctx.fillStyle = battle.victory ? "#388e5f" : "#b24d48";
    ctx.font = "bold 27px sans-serif";
    ctx.fillText(battle.victory ? "挑战成功" : "挑战失败", this.width / 2, modal.y + 58);
    ctx.fillStyle = "#5b4939";
    ctx.font = `${this.width < 350 ? 13 : 14}px sans-serif`;
    ctx.fillText(battle.isPvp ? `仙榜积分 ${battle.rankDelta >= 0 ? "+" : ""}${battle.rankDelta}` : battle.victory ? `获得仙桃 ${battle.rewardPeaches} · 灵石 ${battle.rewardCoins}` : "继续砍树提升妖力后再来", this.width / 2, modal.y + 104);
    if (battle.victory && !battle.isPvp) {
      ctx.fillStyle = "#8b6d4b";
      ctx.font = "12px sans-serif";
      ctx.fillText(`下一关场景：${battle.nextSceneName || "未知秘境"}`, this.width / 2, modal.y + 134);
      this.drawButton(modal.homeButton, "#7f715f", "返回洞府");
      this.drawButton(modal.continueButton, "#477fa8", "继续挑战");
    } else {
      this.drawButton(modal.button, "#477fa8", "返回洞府");
    }
  }

  getResultLayout() {
    const width = Math.min(330, this.width - 32);
    const height = Math.min(243, this.layout.safeBottom - this.layout.contentTop - 28);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const singleWidth = Math.min(185, width - 50);
    const splitGap = 10;
    const splitWidth = (width - 42 - splitGap) / 2;
    const buttonY = y + height - 70;
    return {
      x, y, width, height,
      button: { x: x + (width - singleWidth) / 2, y: buttonY, width: singleWidth, height: 49 },
      homeButton: { x: x + 21, y: buttonY, width: splitWidth, height: 49 },
      continueButton: { x: x + 21 + splitWidth + splitGap, y: buttonY, width: splitWidth, height: 49 }
    };
  }

  drawButton(rect, color, label) {
    const ctx = this.ctx;
    this.fillPanel(rect, color, 8);
    ctx.strokeStyle = "rgba(255, 244, 196, 0.72)";
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(rect.x + 5, rect.y + 5, rect.width - 10, 3);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${rect.width < 110 ? 12 : 14}px sans-serif`;
    ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 5);
  }

  drawToast(message) {
    const ctx = this.ctx;
    const width = Math.min(this.width - 38, 285);
    const x = (this.width - width) / 2;
    const y = this.layout.summary.y + this.layout.summary.height + 8;
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(x, y, width, 37);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(message, this.width / 2, y + 23);
  }

  renderHeroDialogue(profile, message) {
    const ctx = this.ctx;
    const layout = this.getHeroDialogueLayout();
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(0, 0, this.width, this.height);
    this.fillPanel(layout.panel, "rgba(247, 237, 215, 0.98)", 12);
    ctx.strokeStyle = "#d4a755";
    ctx.lineWidth = 2;
    ctx.strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    ctx.fillStyle = "#4b3827";
    ctx.fillRect(layout.panel.x, layout.panel.y, layout.panel.width, 43);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(profile.character.name, layout.panel.x + 15, layout.panel.y + 27);
    ctx.fillStyle = "#765a42";
    ctx.font = "13px sans-serif";
    this.drawWrappedText(message, layout.panel.x + 15, layout.panel.y + 73, layout.panel.width - 30, 21);
    ctx.fillStyle = "#9b7b52";
    ctx.font = "11px sans-serif";
    ctx.fillText("主角会根据修行进度给出不同提示", layout.panel.x + 15, layout.panel.y + layout.panel.height - 22);
    this.drawButton(layout.close, "#7f715f", "收起");
    this.drawButton(layout.next, "#3c9063", "再聊一句");
  }

  getHeroDialogueLayout() {
    const width = Math.min(356, this.width - 24);
    const height = 210;
    const x = (this.width - width) / 2;
    const y = Math.max(this.layout.contentTop + 65, this.height * 0.36);
    return {
      panel: { x, y, width, height },
      close: { x: x + width - 164, y: y + height - 56, width: 66, height: 36 },
      next: { x: x + width - 91, y: y + height - 56, width: 78, height: 36 }
    };
  }

  renderTutorial(stepIndex = 0) {
    const ctx = this.ctx;
    const step = TUTORIAL_STEPS[Math.max(0, Math.min(stepIndex, TUTORIAL_STEPS.length - 1))];
    const layout = this.getTutorialLayout(step);
    const focus = layout.focus;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.64)";
    ctx.fillRect(0, 0, this.width, focus.y);
    ctx.fillRect(0, focus.y, focus.x, focus.height);
    ctx.fillRect(focus.x + focus.width, focus.y, this.width - focus.x - focus.width, focus.height);
    ctx.fillRect(0, focus.y + focus.height, this.width, this.height - focus.y - focus.height);
    ctx.strokeStyle = "#ffe27a";
    ctx.shadowColor = "#ffcc62";
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3;
    ctx.strokeRect(focus.x, focus.y, focus.width, focus.height);
    ctx.restore();

    this.fillPanel(layout.panel, "rgba(247, 237, 215, 0.98)", 11);
    ctx.strokeStyle = "#d4a755";
    ctx.lineWidth = 2;
    ctx.strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    ctx.textAlign = "left";
    ctx.fillStyle = "#5c3e25";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(step.title, layout.panel.x + 15, layout.panel.y + 29);
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    this.drawWrappedText(step.text, layout.panel.x + 15, layout.panel.y + 54, layout.panel.width - 30, 19);
    ctx.fillStyle = "#9b7b52";
    ctx.font = "11px sans-serif";
    ctx.fillText(`${stepIndex + 1} / ${TUTORIAL_STEPS.length}`, layout.panel.x + 15, layout.panel.y + layout.panel.height - 18);
    this.drawButton(layout.next, "#3c9063", stepIndex === TUTORIAL_STEPS.length - 1 ? "开始修行" : "下一步");
    this.drawButton(layout.skip, "#7f715f", "跳过");
  }

  drawWrappedText(text, x, y, maxWidth, lineHeight) {
    let line = "";
    let lineY = y;
    Array.from(text).forEach((character) => {
      const candidate = `${line}${character}`;
      if (line && this.ctx.measureText(candidate).width > maxWidth) {
        this.ctx.fillText(line, x, lineY);
        line = character;
        lineY += lineHeight;
      } else {
        line = candidate;
      }
    });
    if (line) this.ctx.fillText(line, x, lineY);
  }

  getTutorialLayout(step) {
    const source = step.focus === "tree"
      ? this.layout.tree
      : step.focus === "chop"
        ? this.layout.actions.chop
        : step.focus === "stats"
          ? this.layout.statsSummary
          : step.focus === "skills"
            ? this.layout.utilities.skills
            : this.layout.actions.challenge;
    const padding = 5;
    const focus = {
      x: Math.max(2, source.x - padding),
      y: Math.max(2, source.y - padding),
      width: Math.min(this.width - 4, source.width + padding * 2),
      height: Math.min(this.height - 4, source.height + padding * 2)
    };
    const panelWidth = Math.min(360, this.width - 20);
    const panelHeight = 152;
    const panelX = (this.width - panelWidth) / 2;
    const placeAbove = focus.y + focus.height > this.height * 0.62;
    const panelY = placeAbove
      ? Math.max(this.layout.contentTop + 4, focus.y - panelHeight - 13)
      : Math.min(this.layout.safeBottom - panelHeight - 10, focus.y + focus.height + 13);
    const panel = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
    return {
      focus,
      panel,
      skip: { x: panel.x + panel.width - 156, y: panel.y + panel.height - 45, width: 62, height: 32 },
      next: { x: panel.x + panel.width - 87, y: panel.y + panel.height - 45, width: 74, height: 32 }
    };
  }

  getTutorialStepCount() {
    return TUTORIAL_STEPS.length;
  }

  contains(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  isChopButton(x, y) {
    return this.contains(this.layout.actions.chop, x, y);
  }

  isHero(x, y) {
    return this.contains(this.getHomeHeroRect(), x, y);
  }

  isTree(x, y) {
    return this.contains(this.layout.tree, x, y);
  }

  isChallengeButton(x, y) {
    return this.contains(this.layout.actions.challenge, x, y);
  }

  isCultivateButton(x, y) {
    return this.contains(this.layout.actions.cultivate, x, y);
  }

  isExploreButton(x, y) {
    return this.contains(this.layout.utilities.explore, x, y);
  }

  isCollectionButton(x, y) {
    return this.contains(this.layout.utilities.collection, x, y);
  }

  isSkillsButton(x, y) {
    return this.contains(this.layout.utilities.skills, x, y);
  }

  isShopButton(x, y) {
    return this.contains(this.layout.shop, x, y);
  }

  isAudioButton(x, y) {
    return this.contains(this.layout.utilities.audio, x, y);
  }

  isQuickDrawButton(x, y) {
    return this.contains(this.layout.quickDraw, x, y);
  }

  isPvpButton(x, y) {
    return this.contains(this.layout.pvp, x, y);
  }

  isRankingButton(x, y) {
    return this.contains(this.layout.ranking, x, y);
  }

  getEquipmentSlotAt(x, y, profile) {
    const layout = this.layout.equipment;
    const equipment = profile.getEquipmentList();
    const entry = equipment.find((item, index) => {
      const isLeft = index < 3;
      const row = index % 3;
      const rect = {
        x: isLeft ? this.layout.edge : this.width - this.layout.edge - layout.width,
        y: layout.top + row * (layout.height + layout.gap),
        width: layout.width,
        height: layout.height
      };
      return item.item && this.contains(rect, x, y);
    });
    return entry ? entry.id : "";
  }

  getPvpOpponentIndexAt(x, y) {
    return this.getSimpleModalLayout(410).rows.findIndex((rect) => this.contains(rect, x, y));
  }

  isSimpleModalCloseButton(x, y, height) {
    return this.contains(this.getSimpleModalLayout(height).close, x, y);
  }

  isEnhanceActionButton(x, y) {
    return this.contains(this.getSimpleModalLayout(340).action, x, y);
  }

  isSellButton(x, y) {
    return this.contains(this.getModalLayout().sell, x, y);
  }

  isEquipButton(x, y) {
    return this.contains(this.getModalLayout().equip, x, y);
  }

  isCollectionPreviousButton(x, y) {
    return this.contains(this.getCollectionLayout().previous, x, y);
  }

  isCollectionNextButton(x, y) {
    return this.contains(this.getCollectionLayout().next, x, y);
  }

  isCollectionCloseButton(x, y) {
    return this.contains(this.getCollectionLayout().close, x, y);
  }

  getSkillIndexAt(x, y) {
    return this.getSkillsLayout().skillRows.findIndex((rect) => this.contains(rect, x, y));
  }

  isSkillsCloseButton(x, y) {
    return this.contains(this.getSkillsLayout().close, x, y);
  }

  getCosmeticIndexAt(x, y) {
    return this.getShopLayout().cosmeticRows.findIndex((rect) => this.contains(rect, x, y));
  }

  isWheelButton(x, y) {
    return this.contains(this.getShopLayout().wheel, x, y);
  }

  isShopCloseButton(x, y) {
    return this.contains(this.getShopLayout().close, x, y);
  }

  getQuickDrawCountAt(x, y) {
    const entry = this.getQuickDrawLayout().countButtons.find((button) => this.contains(button.rect, x, y));
    return entry ? entry.count : 0;
  }

  isQuickDrawSellButton(x, y) {
    return this.contains(this.getQuickDrawLayout().sell, x, y);
  }

  isQuickDrawEquipButton(x, y) {
    return this.contains(this.getQuickDrawLayout().equip, x, y);
  }

  isQuickDrawSynthesizeButton(x, y) {
    return this.contains(this.getQuickDrawLayout().synthesize, x, y);
  }

  isQuickDrawCloseButton(x, y) {
    return this.contains(this.getQuickDrawLayout().close, x, y);
  }

  isTutorialNextButton(x, y) {
    return TUTORIAL_STEPS.some((step) => this.contains(this.getTutorialLayout(step).next, x, y));
  }

  isTutorialSkipButton(x, y) {
    return TUTORIAL_STEPS.some((step) => this.contains(this.getTutorialLayout(step).skip, x, y));
  }

  isDialogueNextButton(x, y) {
    return this.contains(this.getHeroDialogueLayout().next, x, y);
  }

  isDialogueCloseButton(x, y) {
    return this.contains(this.getHeroDialogueLayout().close, x, y);
  }

  isResultButton(x, y) {
    const layout = this.getResultLayout();
    return this.contains(layout.button, x, y) || this.contains(layout.homeButton, x, y);
  }

  isContinueButton(x, y) {
    return this.contains(this.getResultLayout().continueButton, x, y);
  }
}

module.exports = UI;




  },
  };
  const cache = {};
  function resolveModule(from, request) {
    const parts = (from.split("/").slice(0, -1).join("/") + "/" + request).split("/");
    const resolved = [];
    parts.forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") resolved.pop();
      else resolved.push(part);
    });
    const moduleId = resolved.join("/");
    return moduleId.endsWith(".js") ? moduleId : moduleId + ".js";
  }
  function requireModule(moduleId) {
    if (cache[moduleId]) return cache[moduleId].exports;
    const factory = modules[moduleId];
    if (!factory) throw new Error("Unknown module: " + moduleId);
    const module = { exports: {} };
    cache[moduleId] = module;
    factory((request) => requireModule(resolveModule(moduleId, request)), module, module.exports);
    return module.exports;
  }
  requireModule("game.js");
}());
