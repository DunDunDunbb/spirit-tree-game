const MAIN_CHARACTER = require("../config/characters");
const { createEquipment, getSynthesisCandidate, synthesizeEquipment } = require("../config/equipment");
const { getSignInReward, SIGN_IN_REWARDS } = require("../config/signin");
const { getSceneForStage } = require("../config/scenes");
const { getBossForStage } = require("../config/bosses");
const { getBattleMultiplier, getEnemyAttackMultiplier } = require("../config/difficulty");
const Profile = require("../systems/Profile");
const AudioManager = require("../systems/AudioManager");
const AssetLoader = require("../render/AssetLoader");
const UI = require("../render/UI");

const GAME_STATE = {
  HOME: "home",
  LOOT: "loot",
  COLLECTION: "collection",
  SKILLS: "skills",
  BATTLE: "battle",
  BATTLE_RESULT: "battle-result",
  SHOP: "shop",
  QUICK_DRAW: "quick-draw",
  INVENTORY: "inventory",
  SIGN_IN: "sign-in",
  RANKING: "ranking",
  PVP: "pvp",
  ENHANCE: "enhance"
};

const STORAGE_KEY = "spirit-tree-profile-v1";
const ENEMIES = [
  { type: "imp", name: "赤角小妖", hp: 84, atk: 12, spd: 42 },
  { type: "bamboo-scout", name: "竹林狸妖", hp: 92, atk: 13, spd: 47 },
  { type: "stone-beast", name: "岩甲兽", hp: 136, atk: 15, spd: 29 },
  { type: "vine-spirit", name: "毒藤精", hp: 108, atk: 15, spd: 35 },
  { type: "brute", name: "山林妖将", hp: 122, atk: 16, spd: 31 },
  { type: "frostwing", name: "霜羽妖", hp: 98, atk: 18, spd: 49 },
  { type: "moon-assassin", name: "月影刺客", hp: 86, atk: 21, spd: 58 },
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
    this.shopMessage = "";
    this.quickDrawResults = [];
    this.quickDrawSynthesis = null;
    this.inventoryPage = 0;
    this.inspectedItem = null;
    this.inspectedItemSource = "";
    this.enhanceSlot = "";
    this.pvpOpponents = this.createPvpOpponents();
    this.pvpStatus = "本地演示匹配";
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
      this.ui.renderShop(this.profile, this.shopMessage);
    } else if (this.state === GAME_STATE.QUICK_DRAW) {
      this.ui.renderQuickDraw(this.profile, this.quickDrawResults, this.visualTime);
    } else if (this.state === GAME_STATE.INVENTORY) {
      this.ui.renderInventory(this.profile, this.inventoryPage);
    } else if (this.state === GAME_STATE.SIGN_IN) {
      this.ui.renderSignIn(this.profile, SIGN_IN_REWARDS, this.getTodayKey());
    } else if (this.state === GAME_STATE.RANKING) {
      this.ui.renderRanking(this.profile, this.rankingEntries, this.rankingStatus);
    } else if (this.state === GAME_STATE.PVP) {
      this.ui.renderPvpLobby(this.profile, this.pvpOpponents, this.pvpStatus);
    } else if (this.state === GAME_STATE.ENHANCE) {
      this.ui.renderEnhance(this.profile, this.enhanceSlot);
    }
    if (!this.profile.tutorialCompleted) {
      this.ui.renderTutorial(this.tutorialStep);
    } else if (this.dialogue) {
      this.ui.renderHeroDialogue(this.profile, this.dialogue.lines[this.dialogue.index]);
    }
    if (this.inspectedItem) {
      this.ui.renderItemInspect(this.profile, this.inspectedItem, this.inspectedItemSource);
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
    if (oldItem) this.profile.addToInventory(oldItem);
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

  stashLoot() {
    if (!this.currentLoot) return;
    this.profile.addToInventory(this.currentLoot);
    this.currentLoot = null;
    this.state = GAME_STATE.HOME;
    this.showToast("装备已放入背包");
    this.saveProfile();
  }

  openQuickDraw() {
    this.quickDrawResults = [];
    this.quickDrawSynthesis = null;
    this.inspectedItem = null;
    this.inspectedItemSource = "";
    this.state = GAME_STATE.QUICK_DRAW;
  }

  closeQuickDraw() {
    if (this.quickDrawResults.length) {
      this.resolveQuickDraw();
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
    this.inspectedItem = null;
    this.inspectedItemSource = "";
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
    this.shopMessage = "点击皮肤可直接用灵石购买或换上";
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

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  getFairPvpStats(source = {}) {
    const rawStats = source.rawStats || {};
    const score = Number(source.rankScore === undefined ? source.power : source.rankScore) || 1000;
    const wins = Number(source.pvpWins === undefined ? source.wins : source.pvpWins) || 0;
    const losses = Number(source.pvpLosses === undefined ? source.losses : source.pvpLosses) || 0;
    const equipmentBonus = rawStats.power ? this.clamp(Math.round(Math.sqrt(rawStats.power)), 0, 220) : 0;
    const power = this.clamp(Math.round(score + wins * 35 - losses * 18 + equipmentBonus), 900, 50000);
    return {
      power,
      hp: this.clamp(Math.round(520 + power * 0.34), 760, 6800),
      atk: this.clamp(Math.round(42 + power / 82), 52, 520),
      spd: this.clamp(Math.round(118 + wins * 1.8 - losses * 0.9 + power / 260), 105, 260),
      crit: this.clamp(Math.round(10 + wins / 8 + power / 2400), 8, 35),
      dodge: this.clamp(Math.round(5 + power / 4200), 4, 18),
      combo: this.clamp(Math.round(7 + wins / 10 + power / 3600), 6, 26),
      lifesteal: this.clamp(Math.round(power / 6500), 0, 8),
      counter: this.clamp(Math.round(3 + losses / 20), 3, 14)
    };
  }

  getAttackInterval(speed, base) {
    return this.clamp(base - (speed - 120) / 520, 0.54, 1.12);
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
    this.pvpOpponents = [];
    this.pvpStatus = "正在读取实时玩家...";
    if (typeof wx.fetchPvpOpponents !== "function") {
      this.pvpOpponents = this.createPvpOpponents();
      this.pvpStatus = "本地演示匹配";
      return;
    }
    wx.fetchPvpOpponents()
      .then((opponents) => {
        if (opponents.length) {
          this.pvpOpponents = opponents;
          this.pvpStatus = "实时玩家匹配";
        } else {
          this.pvpOpponents = this.createPvpOpponents();
          this.pvpStatus = "暂无其他玩家，已切换本地演示";
        }
      })
      .catch((error) => {
        this.pvpOpponents = this.createPvpOpponents();
        this.pvpStatus = `实时玩家读取失败：${error.message}`;
      });
  }

  openEnhance(slot) {
    this.enhanceSlot = slot;
    this.state = GAME_STATE.ENHANCE;
  }

  enhanceSelectedEquipment() {
    const result = this.profile.enhanceEquipment(this.enhanceSlot);
    if (!result.ok) {
      this.showToast(result.reason === "coins"
        ? `灵石不足，需要 ${result.cost}`
        : result.reason === "failed"
          ? `强化失败，消耗 ${result.paid} 灵石`
          : result.reason === "max"
            ? "装备已强化至最高等级"
            : "该部位尚未装备");
      if (result.reason === "failed") {
        this.audio.playSfx("dodge");
        this.saveProfile();
      }
      return;
    }
    this.showToast(`${result.item.name} 强化至 +${result.item.enhanceLevel}，消耗 ${result.paid} 灵石`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  selectCosmetic(index) {
    const item = this.profile.getCosmetics()[index];
    if (!item) return;
    const result = this.profile.buyOrEquipCosmetic(item.id);
    if (!result.ok) {
      this.shopMessage = `灵石不足，需要 ${item.price}`;
      return;
    }
    this.shopMessage = item.owned ? `已换上：${item.name}` : `已购买并换上：${item.name}`;
    this.audio.playSfx("equip");
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
    const heroFair = this.getFairPvpStats({
      rankScore: this.profile.rankScore,
      pvpWins: this.profile.pvpWins,
      pvpLosses: this.profile.pvpLosses,
      rawStats: stats
    });
    const enemyFair = this.getFairPvpStats(opponent);
    const scene = getSceneForStage(index + 2);
    this.battle = {
      stage: this.profile.stage,
      scene,
      isPvp: true,
      fairMode: true,
      enemy: { ...opponent, ...enemyFair, type: opponent.type || (index % 2 ? "brute" : "imp"), sprite: opponent.avatarSprite || "hero-main-character", maxHp: enemyFair.hp, hp: enemyFair.hp, isBoss: false },
      heroMaxHp: heroFair.hp, heroHp: heroFair.hp, heroDisplayedHp: heroFair.hp,
      heroAttack: heroFair.atk, heroCrit: heroFair.crit, heroCombo: heroFair.combo, heroDodge: heroFair.dodge,
      heroLifesteal: heroFair.lifesteal, heroCounter: heroFair.counter,
      heroAttackInterval: this.getAttackInterval(heroFair.spd, 0.82),
      enemyAttackInterval: this.getAttackInterval(enemyFair.spd, 0.98),
      heroAttackTimer: 0.3, skillTimer: 1.7, skillAction: 0, enemyAttackTimer: 0.85,
      enemyDisplayedHp: opponent.hp, message: "演武场切磋开始", introTime: 0.72, elapsed: 0,
      heroAction: 0, enemyAction: 0, effects: [], hitStop: 0, screenShake: 0, screenFlash: 0,
      talk: opponent.quote, talkTime: 2.2, nextTalkTime: 3.5, victory: false, rewardPeaches: 0, rewardCoins: 0
    };
    this.battle.enemyDisplayedHp = enemyFair.hp;
    this.battle.message = "公平演武开始";
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
      battle.heroAttackTimer = battle.heroAttackInterval || (0.72 * battle.scene.heroAttackSpeed);
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
      battle.enemyAttackTimer = battle.enemyAttackInterval || (1.02 * battle.scene.enemyAttackSpeed);
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
      if (opponentIndex >= 0 && opponentIndex < this.pvpOpponents.length) this.startPvpBattle(opponentIndex);
      else if (opponentIndex >= 0) this.pvpStatus = "正在匹配实时玩家，请稍候";
      else if (this.ui.isSimpleModalCloseButton(x, y, 410)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.ENHANCE) {
      if (this.ui.isEnhanceActionButton(x, y)) this.enhanceSelectedEquipment();
      else if (this.ui.isSimpleModalCloseButton(x, y, 340)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.BATTLE_RESULT) {
      if (this.ui.isContinueButton(x, y) && this.battle.victory && !this.battle.isPvp) this.startBattle();
      else if (this.ui.isResultButton(x, y)) {
        this.state = GAME_STATE.HOME;
        this.audio.playBgm("home");
      }
    }
  }

  getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  openInventory() {
    this.inventoryPage = 0;
    this.state = GAME_STATE.INVENTORY;
  }

  changeInventoryPage(offset) {
    const totalPages = Math.max(1, Math.ceil(this.profile.getInventory().length / 6));
    this.inventoryPage = (this.inventoryPage + offset + totalPages) % totalPages;
  }

  closeInventory() {
    this.state = GAME_STATE.HOME;
  }

  openSignIn() {
    this.state = GAME_STATE.SIGN_IN;
  }

  closeSignIn() {
    this.state = GAME_STATE.HOME;
  }

  canClaimSignIn() {
    return this.profile.signInClaimedDays < SIGN_IN_REWARDS.length && this.profile.signInLastDate !== this.getTodayKey();
  }

  applySignInReward(reward) {
    if (!reward) return "无奖励";
    if (reward.type === "peaches") {
      this.profile.peaches += reward.amount || 0;
      return `${reward.label}`;
    }
    if (reward.type === "coins") {
      this.profile.coins += reward.amount || 0;
      return `${reward.label}`;
    }
    if (reward.type === "cultivation") {
      this.profile.cultivation += reward.amount || 0;
      return `${reward.label}`;
    }
    if (reward.type === "cosmetic") {
      const item = this.profile.unlockCosmetic(reward.cosmeticId);
      return item ? `解锁皮肤 ${item.name}` : reward.label;
    }
    if (reward.type === "equipment") {
      const item = typeof reward.item === "function" ? reward.item() : null;
      if (item) {
        this.profile.addToInventory(item);
        return `获得装备 ${item.name}`;
      }
    }
    return reward.label || "奖励已发放";
  }

  claimDailySignIn() {
    if (this.profile.signInClaimedDays >= SIGN_IN_REWARDS.length) {
      this.showToast("30日签到已全部完成");
      return;
    }
    if (!this.canClaimSignIn()) {
      this.showToast("今日已签到，请明天再来");
      return;
    }
    const reward = getSignInReward(this.profile.signInClaimedDays);
    const resultText = this.applySignInReward(reward);
    this.profile.signInClaimedDays += 1;
    this.profile.signInLastDate = this.getTodayKey();
    this.showToast(`签到成功：${resultText}`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  inspectItem(item, source) {
    if (!item) return;
    this.inspectedItem = item;
    this.inspectedItemSource = source;
  }

  closeInspectedItem() {
    this.inspectedItem = null;
    this.inspectedItemSource = "";
  }

  equipLoot() {
    if (!this.currentLoot) return;
    const oldItem = this.profile.getEquipped(this.currentLoot.slot);
    if (oldItem) this.profile.addToInventory(oldItem);
    this.profile.equip(this.currentLoot);
    this.currentLoot = null;
    this.state = GAME_STATE.HOME;
    this.showToast(oldItem ? "新装备已穿戴，旧装备已放入背包" : "装备已穿戴");
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

  stashLoot() {
    if (!this.currentLoot) return;
    this.profile.addToInventory(this.currentLoot);
    this.currentLoot = null;
    this.state = GAME_STATE.HOME;
    this.showToast("装备已放入背包");
    this.saveProfile();
  }

  openQuickDraw() {
    this.quickDrawResults = [];
    this.quickDrawSynthesis = null;
    this.closeInspectedItem();
    this.state = GAME_STATE.QUICK_DRAW;
  }

  closeQuickDraw() {
    if (this.quickDrawResults.length) {
      this.resolveQuickDraw();
      return;
    }
    this.closeInspectedItem();
    this.state = GAME_STATE.HOME;
    this.quickDrawSynthesis = null;
  }

  sellQuickDraw() {
    if (!this.quickDrawResults.length) return;
    const coins = this.quickDrawResults.reduce((total, item) => total + item.price, 0);
    this.profile.coins += coins;
    this.quickDrawResults = [];
    this.closeInspectedItem();
    this.state = GAME_STATE.HOME;
    this.showToast(`批量分解完成，灵石 +${coins}`);
    this.saveProfile();
  }

  resolveQuickDraw() {
    if (!this.quickDrawResults.length) return;
    const storedItems = this.quickDrawResults.filter((item) => item.rarity === "legend");
    const soldItems = this.quickDrawResults.filter((item) => item.rarity !== "legend");
    storedItems.forEach((item) => this.profile.addToInventory(item));
    const coins = soldItems.reduce((total, item) => total + item.price, 0);
    this.profile.coins += coins;
    this.quickDrawResults = [];
    this.closeInspectedItem();
    this.state = GAME_STATE.HOME;
    this.showToast(`已收纳 ${storedItems.length} 件金装，其余分解获得 ${coins} 灵石`);
    this.saveProfile();
  }

  equipBestQuickDraw() {
    if (!this.quickDrawResults.length) return;
    const bestBySlot = new Map();
    this.quickDrawResults.forEach((item) => {
      const comparison = this.profile.getEquipmentComparison(item);
      if (comparison.powerDelta <= 0) return;
      const current = bestBySlot.get(item.slot);
      if (!current || item.power > current.item.power) {
        bestBySlot.set(item.slot, { item, comparison });
      }
    });
    const equippedIds = new Set();
    let equippedCount = 0;
    bestBySlot.forEach(({ item }) => {
      const oldItem = this.profile.getEquipped(item.slot);
      if (oldItem) this.profile.addToInventory(oldItem);
      this.profile.equip(item);
      equippedIds.add(item.id);
      equippedCount += 1;
    });
    const remaining = this.quickDrawResults.filter((item) => !equippedIds.has(item.id));
    const storedItems = remaining.filter((item) => item.rarity === "legend");
    const soldItems = remaining.filter((item) => item.rarity !== "legend");
    storedItems.forEach((item) => this.profile.addToInventory(item));
    const coins = soldItems.reduce((total, item) => total + item.price, 0);
    this.profile.coins += coins;
    this.quickDrawResults = [];
    this.closeInspectedItem();
    this.state = GAME_STATE.HOME;
    this.showToast(`已装备 ${equippedCount} 件最强装备，保存 ${storedItems.length} 件金装，获得 ${coins} 灵石`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  openQuickDrawItem(index) {
    const item = this.quickDrawResults[index];
    if (item) this.inspectItem(item, "quick-draw");
  }

  storeInspectedQuickDrawItem() {
    if (!this.inspectedItem) return;
    this.quickDrawResults = this.quickDrawResults.filter((item) => item.id !== this.inspectedItem.id);
    this.profile.addToInventory(this.inspectedItem);
    this.showToast("装备已移入背包");
    this.closeInspectedItem();
    this.saveProfile();
  }

  sellInspectedQuickDrawItem() {
    if (!this.inspectedItem) return;
    this.quickDrawResults = this.quickDrawResults.filter((item) => item.id !== this.inspectedItem.id);
    this.profile.coins += this.inspectedItem.price || 0;
    this.showToast(`已分解 ${this.inspectedItem.name}`);
    this.closeInspectedItem();
    this.saveProfile();
  }

  equipInspectedQuickDrawItem() {
    if (!this.inspectedItem) return;
    const oldItem = this.profile.getEquipped(this.inspectedItem.slot);
    if (oldItem) this.profile.addToInventory(oldItem);
    this.profile.equip(this.inspectedItem);
    this.quickDrawResults = this.quickDrawResults.filter((item) => item.id !== this.inspectedItem.id);
    this.showToast("已穿戴选中装备");
    this.audio.playSfx("equip");
    this.closeInspectedItem();
    this.saveProfile();
  }

  openInventoryItem(index) {
    const items = this.profile.getInventory().slice(this.inventoryPage * 6, this.inventoryPage * 6 + 6);
    const item = items[index];
    if (item) this.inspectItem(item, "inventory");
  }

  sellInspectedInventoryItem() {
    if (!this.inspectedItem) return;
    this.profile.sellInventoryItem(this.inspectedItem.id);
    this.showToast(`已出售 ${this.inspectedItem.name}`);
    this.closeInspectedItem();
    this.saveProfile();
  }

  equipInspectedInventoryItem() {
    if (!this.inspectedItem) return;
    this.profile.equipFromInventory(this.inspectedItem.id);
    this.showToast("已从背包装备");
    this.audio.playSfx("equip");
    this.closeInspectedItem();
    this.saveProfile();
  }

  handleInspectedItemAction(action) {
    if (!action) return false;
    if (action === "close") {
      this.closeInspectedItem();
      return true;
    }
    if (this.inspectedItemSource === "quick-draw") {
      if (action === "equip") this.equipInspectedQuickDrawItem();
      else if (action === "stash") this.storeInspectedQuickDrawItem();
      else if (action === "sell") this.sellInspectedQuickDrawItem();
      return true;
    }
    if (this.inspectedItemSource === "inventory") {
      if (action === "equip") this.equipInspectedInventoryItem();
      else if (action === "sell") this.sellInspectedInventoryItem();
      else if (action === "stash") this.closeInspectedItem();
      return true;
    }
    return false;
  }

  createPvpOpponents() {
    return [
      { name: "草原悍匪·阿塔", realm: "炼气九层", power: 1320, hp: 390, atk: 43, spd: 148, quote: "你的仙桃，归我了。" },
      { name: "黑风寨·大头领", realm: "筑基初期", power: 1760, hp: 510, atk: 55, spd: 136, quote: "让我看看你能撑几招。" },
      { name: "赤霄真人", realm: "筑基中期", power: 2180, hp: 620, atk: 64, spd: 154, quote: "草原之上，强者为尊。" },
      { name: "月坛剑客", realm: "筑基后期", power: 2640, hp: 730, atk: 72, spd: 168, quote: "此剑，只问胜负。" }
    ];
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

  selectSkill(index) {
    const skill = this.profile.getSkills()[index];
    if (!skill || !this.profile.setSkill(skill.id)) return;
    this.showToast(`已装备技能：${skill.name}`);
    this.saveProfile();
  }

  openShop() {
    this.shopMessage = "点击皮肤可直接用灵石购买或换上";
    this.state = GAME_STATE.SHOP;
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
          ? "离线预览榜单 · 联网后显示实时玩家"
          : entries.length ? "实时玩家榜单" : "暂无玩家记录";
      })
      .catch((error) => {
        this.rankingStatus = `仙榜读取失败：${error.message}`;
      });
  }

  openPvp() {
    this.state = GAME_STATE.PVP;
    this.pvpOpponents = [];
    this.pvpStatus = "正在读取实时玩家...";
    if (typeof wx.fetchPvpOpponents !== "function") {
      this.pvpOpponents = this.createPvpOpponents();
      this.pvpStatus = "本地演示匹配";
      return;
    }
    wx.fetchPvpOpponents()
      .then((opponents) => {
        if (opponents.length) {
          this.pvpOpponents = opponents;
          this.pvpStatus = "实时玩家匹配";
        } else {
          this.pvpOpponents = this.createPvpOpponents();
          this.pvpStatus = "暂无其他玩家，已切换本地演示";
        }
      })
      .catch((error) => {
        this.pvpOpponents = this.createPvpOpponents();
        this.pvpStatus = `实时玩家读取失败：${error.message}`;
      });
  }

  enhanceSelectedEquipment() {
    const result = this.profile.enhanceEquipment(this.enhanceSlot);
    if (!result.ok) {
      this.showToast(result.reason === "coins"
        ? `灵石不足，需要 ${result.cost}`
        : result.reason === "failed"
          ? `强化失败，消耗 ${result.paid} 灵石`
          : result.reason === "max"
            ? "装备已强化至最高等级"
            : "该部位尚未装备");
      if (result.reason === "failed") {
        this.audio.playSfx("dodge");
        this.saveProfile();
      }
      return;
    }
    this.showToast(`${result.item.name} 强化至 +${result.item.enhanceLevel}，消耗 ${result.paid} 灵石`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  completeTutorial() {
    this.profile.tutorialCompleted = true;
    this.saveProfile();
    this.showToast("新手引导完成，开始修行吧");
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

  cultivate() {
    const cost = 12 + Math.floor(this.profile.cultivation / 45) * 4;
    if (this.profile.coins < cost) {
      this.showToast(`灵石不足，吐纳需要 ${cost}`);
      return;
    }
    this.profile.coins -= cost;
    this.profile.cultivation += 24 + this.profile.treeLevel * 3;
    this.showToast("吐纳淬炼完成，修为提升");
    this.saveProfile();
  }

  applySignInReward(reward) {
    if (!reward) return "无奖励";
    if (reward.type === "peaches") {
      this.profile.peaches += reward.amount || 0;
      return reward.label;
    }
    if (reward.type === "coins") {
      this.profile.coins += reward.amount || 0;
      return reward.label;
    }
    if (reward.type === "cultivation") {
      this.profile.cultivation += reward.amount || 0;
      return reward.label;
    }
    if (reward.type === "cosmetic") {
      const item = this.profile.unlockCosmetic(reward.cosmeticId);
      return item ? `解锁皮肤 ${item.name}` : reward.label;
    }
    if (reward.type === "equipment") {
      const item = typeof reward.item === "function" ? reward.item() : null;
      if (item) {
        this.profile.addToInventory(item);
        return `获得装备 ${item.name}`;
      }
    }
    return reward.label || "奖励已发放";
  }

  claimDailySignIn() {
    if (this.profile.signInClaimedDays >= SIGN_IN_REWARDS.length) {
      this.showToast("30日签到已全部完成");
      return;
    }
    if (!this.canClaimSignIn()) {
      this.showToast("今日已签到，请明天再来");
      return;
    }
    const reward = getSignInReward(this.profile.signInClaimedDays);
    const resultText = this.applySignInReward(reward);
    this.profile.signInClaimedDays += 1;
    this.profile.signInLastDate = this.getTodayKey();
    this.showToast(`签到成功：${resultText}`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  equipLoot() {
    if (!this.currentLoot) return;
    const oldItem = this.profile.getEquipped(this.currentLoot.slot);
    if (oldItem) this.profile.addToInventory(oldItem);
    this.profile.equip(this.currentLoot);
    this.currentLoot = null;
    this.state = GAME_STATE.HOME;
    this.showToast(oldItem ? "新装备已穿戴，旧装备已放入背包" : "装备已穿戴");
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

  stashLoot() {
    if (!this.currentLoot) return;
    this.profile.addToInventory(this.currentLoot);
    this.currentLoot = null;
    this.state = GAME_STATE.HOME;
    this.showToast("装备已放入背包");
    this.saveProfile();
  }

  sellQuickDraw() {
    if (!this.quickDrawResults.length) return;
    const coins = this.quickDrawResults.reduce((total, item) => total + item.price, 0);
    this.profile.coins += coins;
    this.quickDrawResults = [];
    this.closeInspectedItem();
    this.state = GAME_STATE.HOME;
    this.showToast(`批量分解完成，灵石 +${coins}`);
    this.saveProfile();
  }

  resolveQuickDraw() {
    if (!this.quickDrawResults.length) return;
    const storedItems = this.quickDrawResults.filter((item) => item.rarity === "legend");
    const soldItems = this.quickDrawResults.filter((item) => item.rarity !== "legend");
    storedItems.forEach((item) => this.profile.addToInventory(item));
    const coins = soldItems.reduce((total, item) => total + item.price, 0);
    this.profile.coins += coins;
    this.quickDrawResults = [];
    this.closeInspectedItem();
    this.state = GAME_STATE.HOME;
    this.showToast(`已收纳 ${storedItems.length} 件金装，其余分解获得 ${coins} 灵石`);
    this.saveProfile();
  }

  equipBestQuickDraw() {
    if (!this.quickDrawResults.length) return;
    const bestBySlot = new Map();
    this.quickDrawResults.forEach((item) => {
      const comparison = this.profile.getEquipmentComparison(item);
      if (comparison.powerDelta <= 0) return;
      const current = bestBySlot.get(item.slot);
      if (!current || item.power > current.item.power) bestBySlot.set(item.slot, { item, comparison });
    });
    const equippedIds = new Set();
    let equippedCount = 0;
    bestBySlot.forEach(({ item }) => {
      const oldItem = this.profile.getEquipped(item.slot);
      if (oldItem) this.profile.addToInventory(oldItem);
      this.profile.equip(item);
      equippedIds.add(item.id);
      equippedCount += 1;
    });
    const remaining = this.quickDrawResults.filter((item) => !equippedIds.has(item.id));
    const storedItems = remaining.filter((item) => item.rarity === "legend");
    const soldItems = remaining.filter((item) => item.rarity !== "legend");
    storedItems.forEach((item) => this.profile.addToInventory(item));
    const coins = soldItems.reduce((total, item) => total + item.price, 0);
    this.profile.coins += coins;
    this.quickDrawResults = [];
    this.closeInspectedItem();
    this.state = GAME_STATE.HOME;
    this.showToast(`已装备 ${equippedCount} 件最强装备，保存 ${storedItems.length} 件金装，获得 ${coins} 灵石`);
    this.audio.playSfx("equip");
    this.saveProfile();
  }

  storeInspectedQuickDrawItem() {
    if (!this.inspectedItem) return;
    this.quickDrawResults = this.quickDrawResults.filter((item) => item.id !== this.inspectedItem.id);
    this.profile.addToInventory(this.inspectedItem);
    this.showToast("装备已移入背包");
    this.closeInspectedItem();
    this.saveProfile();
  }

  sellInspectedQuickDrawItem() {
    if (!this.inspectedItem) return;
    this.quickDrawResults = this.quickDrawResults.filter((item) => item.id !== this.inspectedItem.id);
    this.profile.coins += this.inspectedItem.price || 0;
    this.showToast(`已分解 ${this.inspectedItem.name}`);
    this.closeInspectedItem();
    this.saveProfile();
  }

  equipInspectedQuickDrawItem() {
    if (!this.inspectedItem) return;
    const oldItem = this.profile.getEquipped(this.inspectedItem.slot);
    if (oldItem) this.profile.addToInventory(oldItem);
    this.profile.equip(this.inspectedItem);
    this.quickDrawResults = this.quickDrawResults.filter((item) => item.id !== this.inspectedItem.id);
    this.showToast("已穿戴选中装备");
    this.audio.playSfx("equip");
    this.closeInspectedItem();
    this.saveProfile();
  }

  sellInspectedInventoryItem() {
    if (!this.inspectedItem) return;
    this.profile.sellInventoryItem(this.inspectedItem.id);
    this.showToast(`已出售 ${this.inspectedItem.name}`);
    this.closeInspectedItem();
    this.saveProfile();
  }

  equipInspectedInventoryItem() {
    if (!this.inspectedItem) return;
    this.profile.equipFromInventory(this.inspectedItem.id);
    this.showToast("已从背包装备");
    this.audio.playSfx("equip");
    this.closeInspectedItem();
    this.saveProfile();
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
      name: boss ? `${boss.title} · ${boss.name}` : baseTemplate.name,
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
    const heroFair = this.getFairPvpStats({
      rankScore: this.profile.rankScore,
      pvpWins: this.profile.pvpWins,
      pvpLosses: this.profile.pvpLosses,
      rawStats: stats
    });
    const enemyFair = this.getFairPvpStats(opponent);
    const scene = getSceneForStage(index + 2);
    this.battle = {
      stage: this.profile.stage,
      scene,
      isPvp: true,
      fairMode: true,
      enemy: { ...opponent, ...enemyFair, type: opponent.type || (index % 2 ? "brute" : "imp"), sprite: opponent.avatarSprite || "hero-main-character", maxHp: enemyFair.hp, hp: enemyFair.hp, isBoss: false },
      heroMaxHp: heroFair.hp,
      heroHp: heroFair.hp,
      heroDisplayedHp: heroFair.hp,
      heroAttack: heroFair.atk,
      heroCrit: heroFair.crit,
      heroCombo: heroFair.combo,
      heroDodge: heroFair.dodge,
      heroLifesteal: heroFair.lifesteal,
      heroCounter: heroFair.counter,
      heroAttackInterval: this.getAttackInterval(heroFair.spd, 0.82),
      enemyAttackInterval: this.getAttackInterval(enemyFair.spd, 0.98),
      heroAttackTimer: 0.3,
      skillTimer: 1.7,
      skillAction: 0,
      enemyAttackTimer: 0.85,
      enemyDisplayedHp: enemyFair.hp,
      message: "演武场切磋开始",
      introTime: 0.72,
      elapsed: 0,
      heroAction: 0,
      enemyAction: 0,
      effects: [],
      hitStop: 0,
      screenShake: 0,
      screenFlash: 0,
      talk: opponent.quote,
      talkTime: 2.2,
      nextTalkTime: 3.5,
      victory: false,
      rewardPeaches: 0,
      rewardCoins: 0
    };
    this.state = GAME_STATE.BATTLE;
    this.audio.playStageBgm(index + 2, false);
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

  synthesizeQuickDraw() {
    const synthesis = this.getQuickDrawSynthesisPreview();
    if (!synthesis) {
      this.showToast("至少需要 3 件同部位装备才能合成");
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

  selectCosmetic(index) {
    const item = this.profile.getCosmetics()[index];
    if (!item) return;
    const result = this.profile.buyOrEquipCosmetic(item.id);
    if (!result.ok) {
      this.shopMessage = `灵石不足，需要 ${item.price}`;
      return;
    }
    this.shopMessage = item.owned ? `已换上：${item.name}` : `已购买并换上：${item.name}`;
    this.audio.playSfx("equip");
    this.saveProfile();
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
    if (this.inspectedItem) {
      this.handleInspectedItemAction(this.ui.getInspectActionAt(x, y, this.inspectedItemSource));
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
      else if (this.ui.isInventoryButton(x, y)) this.openInventory();
      else if (this.ui.isCollectionButton(x, y)) this.openCollection();
      else if (this.ui.isSkillsButton(x, y)) this.openSkills();
      else if (this.ui.isShopButton(x, y)) this.openShop();
      else if (this.ui.isAudioButton(x, y)) this.audio.toggle();
      else if (this.ui.isSignInButton(x, y)) this.openSignIn();
      else if (this.ui.isQuickDrawButton(x, y)) this.openQuickDraw();
      else if (this.ui.isPvpButton(x, y)) this.openPvp();
      else if (this.ui.isRankingButton(x, y)) this.openRanking();
    } else if (this.state === GAME_STATE.LOOT) {
      const action = this.ui.getLootActionAt(x, y);
      if (action === "sell") this.sellLoot();
      else if (action === "stash") this.stashLoot();
      else if (action === "equip") this.equipLoot();
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
      else if (this.ui.isShopCloseButton(x, y)) this.closeShop();
    } else if (this.state === GAME_STATE.QUICK_DRAW) {
      const count = this.ui.getQuickDrawCountAt(x, y);
      const cardIndex = this.ui.getQuickDrawItemIndexAt(x, y, this.quickDrawResults.length);
      if (count) this.quickDraw(count);
      else if (cardIndex >= 0) this.openQuickDrawItem(cardIndex);
      else if (this.ui.isQuickDrawSellButton(x, y)) this.sellQuickDraw();
      else if (this.ui.isQuickDrawEquipButton(x, y)) this.equipBestQuickDraw();
      else if (this.ui.isQuickDrawSynthesizeButton(x, y)) this.synthesizeQuickDraw();
      else if (this.ui.isQuickDrawCloseButton(x, y)) this.closeQuickDraw();
    } else if (this.state === GAME_STATE.INVENTORY) {
      const itemIndex = this.ui.getInventoryItemIndexAt(x, y, this.profile, this.inventoryPage);
      if (itemIndex >= 0) this.openInventoryItem(itemIndex);
      else if (this.ui.isInventoryPrevButton(x, y)) this.changeInventoryPage(-1);
      else if (this.ui.isInventoryNextButton(x, y)) this.changeInventoryPage(1);
      else if (this.ui.isInventoryCloseButton(x, y)) this.closeInventory();
    } else if (this.state === GAME_STATE.SIGN_IN) {
      if (this.ui.isSignInClaimButton(x, y)) this.claimDailySignIn();
      else if (this.ui.isSignInCloseButton(x, y)) this.closeSignIn();
    } else if (this.state === GAME_STATE.RANKING) {
      if (this.ui.isSimpleModalCloseButton(x, y, 390)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.PVP) {
      const opponentIndex = this.ui.getPvpOpponentIndexAt(x, y);
      if (opponentIndex >= 0 && opponentIndex < this.pvpOpponents.length) this.startPvpBattle(opponentIndex);
      else if (opponentIndex >= 0) this.pvpStatus = "姝ｅ湪鍖归厤瀹炴椂鐜╁锛岃绋嶅€?";
      else if (this.ui.isSimpleModalCloseButton(x, y, 410)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.ENHANCE) {
      if (this.ui.isEnhanceActionButton(x, y)) this.enhanceSelectedEquipment();
      else if (this.ui.isSimpleModalCloseButton(x, y, 340)) this.state = GAME_STATE.HOME;
    } else if (this.state === GAME_STATE.BATTLE_RESULT) {
      if (this.ui.isContinueButton(x, y) && this.battle.victory && !this.battle.isPvp) this.startBattle();
      else if (this.ui.isResultButton(x, y)) {
        this.state = GAME_STATE.HOME;
        this.audio.playBgm("home");
      }
    }
  }
}

module.exports = Game;
