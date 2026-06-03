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
    this.shopPage = 0;
    this.lastShopTotal = 0;
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
    const sprite = skin ? skin.sprite : profile.character.sprite;
    const image = this.assets.get(sprite);
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
    const weapon = this.getCharacterWeaponPreset(sprite, profile.getEquipped("weapon"));
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
    this.drawHeldWeaponAt(heroX + width * weapon.homeX, heroY + height * weapon.homeY, height, weapon, {
      elapsed,
      action: swing,
      angle: weapon.homeAngle - swing * 0.55
    });
  }

  getCharacterWeaponPreset(sprite, equippedWeapon = null, fallbackColor = "") {
    const presets = {
      "hero-main-character": { style: "sword", color: "#d8ecff", accent: "#ffe08a", homeX: 0.72, homeY: 0.57, battleX: 0.7, battleY: 0.6, homeAngle: -0.62, battleAngle: -0.72, scale: 1 },
      "hero-skin-streetwear": { style: "blade", color: "#f7f7f7", accent: "#54f0ff", homeX: 0.74, homeY: 0.6, battleX: 0.72, battleY: 0.62, homeAngle: -0.78, battleAngle: -0.82, scale: 0.9 },
      "hero-skin-wuxia": { style: "sword", color: "#bfefff", accent: "#78c9ff", homeX: 0.73, homeY: 0.56, battleX: 0.72, battleY: 0.58, homeAngle: -0.68, battleAngle: -0.78, scale: 1.08 },
      "hero-skin-royal": { style: "spear", color: "#ffe6a3", accent: "#ffbd45", homeX: 0.71, homeY: 0.61, battleX: 0.7, battleY: 0.63, homeAngle: -0.42, battleAngle: -0.5, scale: 1.12 },
      "hero-skin-bunny": { style: "bow", color: "#eecbff", accent: "#ffeb8a", homeX: 0.69, homeY: 0.58, battleX: 0.68, battleY: 0.61, homeAngle: -0.48, battleAngle: -0.58, scale: 0.98 },
      "hero-skin-nurse": { style: "staff", color: "#fff4f6", accent: "#ff8fa3", homeX: 0.68, homeY: 0.6, battleX: 0.68, battleY: 0.62, homeAngle: -0.38, battleAngle: -0.48, scale: 0.95 },
      "hero-skin-bocchi-shirt": { style: "guitar", color: "#ff9bc3", accent: "#ffe17a", homeX: 0.68, homeY: 0.62, battleX: 0.67, battleY: 0.64, homeAngle: -0.58, battleAngle: -0.66, scale: 0.92 },
      "hero-skin-samurai": { style: "katana", color: "#f9d39b", accent: "#d64b43", homeX: 0.72, homeY: 0.58, battleX: 0.7, battleY: 0.61, homeAngle: -0.84, battleAngle: -0.9, scale: 1.04 },
      "hero-skin-cyberpunk": { style: "laser", color: "#dbfbff", accent: "#1ce3ff", homeX: 0.71, homeY: 0.59, battleX: 0.69, battleY: 0.61, homeAngle: -0.72, battleAngle: -0.82, scale: 1 },
      "hero-skin-frost-king": { style: "ice-staff", color: "#e9f8ff", accent: "#9fe7ff", homeX: 0.69, homeY: 0.58, battleX: 0.69, battleY: 0.61, homeAngle: -0.44, battleAngle: -0.54, scale: 1.02 },
      "hero-skin-magma-warlord": { style: "lava-axe", color: "#ffd0a8", accent: "#ff7a3c", homeX: 0.73, homeY: 0.6, battleX: 0.71, battleY: 0.63, homeAngle: -0.58, battleAngle: -0.66, scale: 1.08 },
      "hero-skin-jade-monk": { style: "jade-staff", color: "#d9ffe9", accent: "#55d69c", homeX: 0.69, homeY: 0.59, battleX: 0.68, battleY: 0.61, homeAngle: -0.4, battleAngle: -0.48, scale: 0.98 },
      "hero-skin-desert-pharaoh": { style: "scepter", color: "#f8e2aa", accent: "#d8b15b", homeX: 0.7, homeY: 0.59, battleX: 0.69, battleY: 0.62, homeAngle: -0.38, battleAngle: -0.46, scale: 1.04 },
      "hero-skin-jungle-guardian": { style: "vine-bow", color: "#def6c9", accent: "#6fc56f", homeX: 0.69, homeY: 0.58, battleX: 0.68, battleY: 0.61, homeAngle: -0.52, battleAngle: -0.6, scale: 1 },
      "hero-skin-steampunk": { style: "hammer", color: "#f9d9b2", accent: "#c48d57", homeX: 0.72, homeY: 0.6, battleX: 0.7, battleY: 0.62, homeAngle: -0.63, battleAngle: -0.72, scale: 0.98 },
      "hero-skin-star-priest": { style: "star-orb", color: "#f1ebff", accent: "#b6a7ff", homeX: 0.68, homeY: 0.59, battleX: 0.68, battleY: 0.62, homeAngle: -0.34, battleAngle: -0.44, scale: 1 },
      "hero-skin-sakura-festival": { style: "fan", color: "#ffe5ef", accent: "#ff8fb4", homeX: 0.7, homeY: 0.58, battleX: 0.69, battleY: 0.61, homeAngle: -0.48, battleAngle: -0.56, scale: 0.96 },
      "hero-skin-deep-sea-captain": { style: "trident", color: "#dffcff", accent: "#3fc9d8", homeX: 0.72, homeY: 0.61, battleX: 0.7, battleY: 0.63, homeAngle: -0.5, battleAngle: -0.58, scale: 1.12 }
    };
    const base = presets[sprite] || presets["hero-main-character"];
    return {
      ...base,
      color: (equippedWeapon && equippedWeapon.color) || fallbackColor || base.color,
      accent: (equippedWeapon && equippedWeapon.setColor) || base.accent,
      rarity: equippedWeapon && equippedWeapon.rarity
    };
  }

  getWeaponVisualStyle(weapon) {
    if (weapon && weapon.style) return weapon.style;
    const match = String(weapon.catalogId || "").match(/-(\d+)/);
    const index = match ? Number(match[1]) : 0;
    return ["sword", "blade", "staff", "bow"][index % 4];
  }

  drawHeldWeaponAt(x, y, heroHeight, weapon, options = {}) {
    if (!weapon) return;
    const ctx = this.ctx;
    const style = this.getWeaponVisualStyle(weapon);
    const length = this.clamp(heroHeight * 0.48 * (weapon.scale || 1), 56, 112);
    const grip = Math.max(11, length * 0.16);
    const color = weapon.color || "#d7d7d7";
    const accent = weapon.setColor || "#ffe7a3";
    const action = options.action || 0;
    ctx.save();
    ctx.translate(x, y + Math.sin((options.elapsed || 0) * 4) * 1.4);
    ctx.rotate((options.angle === undefined ? -0.65 : options.angle) + action * 0.22);
    if (options.flip) ctx.scale(-1, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 4;

    if (style === "staff" || style === "ice-staff" || style === "jade-staff" || style === "scepter" || style === "star-orb") {
      ctx.strokeStyle = "#6a432b";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, grip);
      ctx.lineTo(0, -length);
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -length * 0.25);
      ctx.lineTo(0, -length * 0.95);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      if (style === "ice-staff") {
        ctx.moveTo(0, -length - 20);
        ctx.lineTo(11, -length - 6);
        ctx.lineTo(0, -length + 8);
        ctx.lineTo(-11, -length - 6);
        ctx.closePath();
      } else if (style === "scepter") {
        ctx.arc(0, -length - 9, 10, 0, Math.PI * 2);
        ctx.moveTo(-12, -length - 2);
        ctx.lineTo(12, -length - 2);
      } else if (style === "star-orb") {
        for (let i = 0; i < 5; i += 1) {
          const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
          const r = i === 0 ? 13 : 13;
          ctx.lineTo(Math.cos(a) * r, -length - 8 + Math.sin(a) * r);
          const b = a + Math.PI / 5;
          ctx.lineTo(Math.cos(b) * 6, -length - 8 + Math.sin(b) * 6);
        }
        ctx.closePath();
      } else {
        ctx.arc(0, -length - 8, 9, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.strokeStyle = "#fff4bc";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-7, -length - 8);
      ctx.lineTo(7, -length - 8);
      ctx.moveTo(0, -length - 15);
      ctx.lineTo(0, -length - 1);
      ctx.stroke();
    } else if (style === "bow" || style === "vine-bow") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -length * 0.35, length * 0.38, -Math.PI * 0.72, Math.PI * 0.72);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(length * 0.23, -length * 0.66);
      ctx.lineTo(-length * 0.05, length * 0.03);
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-length * 0.03, -length * 0.31);
      ctx.lineTo(length * 0.31, -length * 0.31);
      ctx.lineTo(length * 0.22, -length * 0.38);
      ctx.stroke();
      if (style === "vine-bow") {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-length * 0.08, -length * 0.55, 5, 0, Math.PI * 1.7);
        ctx.arc(length * 0.11, -length * 0.18, 4, Math.PI, Math.PI * 2.5);
        ctx.stroke();
      }
    } else if (style === "spear" || style === "trident") {
      ctx.strokeStyle = "#6a432b";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, grip + 11);
      ctx.lineTo(0, -length * 1.05);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -length * 1.25);
      ctx.lineTo(10, -length * 1.02);
      ctx.lineTo(0, -length * 0.93);
      ctx.lineTo(-10, -length * 1.02);
      ctx.closePath();
      ctx.fill();
      if (style === "trident") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-14, -length * 1.11);
        ctx.lineTo(-10, -length * 0.92);
        ctx.moveTo(14, -length * 1.11);
        ctx.lineTo(10, -length * 0.92);
        ctx.stroke();
      }
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, -length * 0.92);
      ctx.quadraticCurveTo(-4, -length * 0.76, -16, -length * 0.62);
      ctx.moveTo(13, -length * 0.92);
      ctx.quadraticCurveTo(4, -length * 0.76, 16, -length * 0.62);
      ctx.stroke();
    } else if (style === "guitar") {
      ctx.strokeStyle = "#5c3728";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, grip + 6);
      ctx.lineTo(0, -length * 0.75);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -length * 0.05, 16, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, -length * 0.05, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -length * 0.58);
      ctx.lineTo(10, -length * 0.58);
      ctx.stroke();
    } else if (style === "lava-axe" || style === "hammer") {
      ctx.strokeStyle = "#6a432b";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, grip + 9);
      ctx.lineTo(0, -length * 0.9);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      if (style === "lava-axe") {
        ctx.moveTo(-6, -length * 0.88);
        ctx.quadraticCurveTo(-34, -length * 0.74, -18, -length * 0.52);
        ctx.lineTo(0, -length * 0.63);
        ctx.lineTo(18, -length * 0.52);
        ctx.quadraticCurveTo(34, -length * 0.74, 6, -length * 0.88);
      } else {
        ctx.moveTo(-16, -length * 0.92);
        ctx.lineTo(16, -length * 0.92);
        ctx.quadraticCurveTo(22, -length * 0.92, 22, -length * 0.86);
        ctx.lineTo(22, -length * 0.78);
        ctx.quadraticCurveTo(22, -length * 0.72, 16, -length * 0.72);
        ctx.lineTo(-16, -length * 0.72);
        ctx.quadraticCurveTo(-22, -length * 0.72, -22, -length * 0.78);
        ctx.lineTo(-22, -length * 0.86);
        ctx.quadraticCurveTo(-22, -length * 0.92, -16, -length * 0.92);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (style === "fan") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, grip);
      ctx.arc(0, -length * 0.12, length * 0.38, -Math.PI * 0.92, -Math.PI * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, grip);
        ctx.lineTo(i * length * 0.12, -length * 0.42 + Math.abs(i) * 3);
        ctx.stroke();
      }
    } else {
      const bladeWidth = style === "blade" || style === "laser" ? 13 : style === "katana" ? 6 : 8;
      ctx.strokeStyle = "#6a432b";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, grip);
      ctx.lineTo(0, -grip);
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-13, -grip);
      ctx.lineTo(13, -grip);
      ctx.stroke();
      ctx.fillStyle = style === "laser" ? accent : color;
      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.lineTo(bladeWidth, -grip - (style === "katana" ? 8 : 2));
      ctx.lineTo(0, -grip - 12);
      ctx.lineTo(-bladeWidth, -grip - (style === "katana" ? 8 : 2));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -length + 10);
      ctx.lineTo(0, -grip - 12);
      ctx.stroke();
    }
    ctx.restore();
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

  drawAvatar(entry, x, y, size = 28) {
    const ctx = this.ctx;
    const sprite = entry && entry.avatarSprite;
    const image = sprite ? this.assets.get(sprite) : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (image) {
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
    } else {
      ctx.fillStyle = (entry && entry.avatarColor) || "#f1bf62";
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size * 0.38, size * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size * 0.86, size * 0.34, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = (entry && entry.avatarColor) || "#d4a755";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 0.75, 0, Math.PI * 2);
    ctx.stroke();
    if (sprite) {
      this.drawAvatarWeapon(sprite, x, y, size, entry && entry.avatarColor);
    }
  }

  drawAvatarWeapon(sprite, x, y, size, fallbackColor = "") {
    const weapon = this.getCharacterWeaponPreset(sprite, null, fallbackColor);
    const ctx = this.ctx;
    const cx = x + size * 0.74;
    const cy = y + size * 0.72;
    const length = size * 0.58;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.62);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 2;
    if (weapon.style === "bow") {
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -length * 0.22, length * 0.34, -Math.PI * 0.72, Math.PI * 0.72);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(length * 0.18, -length * 0.48);
      ctx.lineTo(-length * 0.02, length * 0.05);
      ctx.stroke();
    } else if (weapon.style === "staff") {
      ctx.strokeStyle = weapon.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, length * 0.15);
      ctx.lineTo(0, -length * 0.75);
      ctx.stroke();
      ctx.fillStyle = weapon.color;
      ctx.beginPath();
      ctx.arc(0, -length * 0.88, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (weapon.style === "spear") {
      ctx.strokeStyle = "#6a432b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, length * 0.2);
      ctx.lineTo(0, -length * 0.8);
      ctx.stroke();
      ctx.fillStyle = weapon.color;
      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.lineTo(size * 0.08, -length * 0.78);
      ctx.lineTo(-size * 0.08, -length * 0.78);
      ctx.closePath();
      ctx.fill();
    } else if (weapon.style === "guitar") {
      ctx.strokeStyle = "#5c3728";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, length * 0.15);
      ctx.lineTo(0, -length * 0.55);
      ctx.stroke();
      ctx.fillStyle = weapon.color;
      ctx.beginPath();
      ctx.ellipse(0, -length * 0.02, size * 0.12, size * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const bladeWidth = weapon.style === "blade" ? size * 0.09 : size * 0.055;
      ctx.strokeStyle = "#6a432b";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, length * 0.15);
      ctx.lineTo(0, -length * 0.14);
      ctx.stroke();
      ctx.fillStyle = weapon.color;
      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.lineTo(bladeWidth, -length * 0.18);
      ctx.lineTo(0, -length * 0.32);
      ctx.lineTo(-bladeWidth, -length * 0.18);
      ctx.closePath();
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
      this.drawAvatar(entry, modal.x + 22, y + 2, 23);
      ctx.textAlign = "left";
      ctx.fillStyle = entry.self ? "#287b50" : "#5b4939";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(`${index + 1}. ${entry.name}`, modal.x + 52, y + 18);
      ctx.textAlign = "right";
      ctx.fillText(`${entry.score} 分`, modal.x + modal.width - 25, y + 18);
    });
    this.drawButton(modal.close, "#7f715f", "关闭");
  }

  renderPvpLobby(profile, opponents, status = "") {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getSimpleModalLayout(410);
    this.drawModalShell(modal, "草原演武场");
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(status || "本地演示匹配", this.width / 2, modal.y + 74);
    opponents.slice(0, modal.rows.length).forEach((entry, index) => {
      const rect = modal.rows[index];
      this.fillPanel(rect, "rgba(91, 73, 57, 0.09)", 7);
      this.drawAvatar(entry, rect.x + 9, rect.y + 7, 36);
      ctx.textAlign = "left";
      ctx.fillStyle = "#5b4939";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(entry.name, rect.x + 53, rect.y + 19);
      ctx.font = "11px sans-serif";
      ctx.fillText(`${entry.realm} · 妖力 ${entry.power}`, rect.x + 53, rect.y + 37);
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
      const chance = typeof profile.getEnhanceChance === "function" ? profile.getEnhanceChance(slot) : 100;
      const cost = profile.getEnhanceCost(slot);
      const failCost = Math.max(1, Math.round(cost * 0.4));
      ctx.fillStyle = "#5b4939";
      ctx.font = "12px sans-serif";
      ctx.fillText(`当前加成：基础属性 +${level * 8}%`, this.width / 2, modal.y + 124);
      ctx.fillText(level >= 15 ? "已达到最高强化等级" : `下一级：基础属性 +${(level + 1) * 8}%`, this.width / 2, modal.y + 148);
      ctx.fillStyle = chance >= 70 ? "#317d54" : chance >= 45 ? "#9b6b3f" : "#b24d48";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(level >= 15 ? "成功率 0%" : `成功率 ${chance}% · 失败消耗 ${failCost} 灵石`, this.width / 2, modal.y + 174);
      this.drawButton(modal.action, level >= 15 ? "#6f6a61" : "#b07a35", level >= 15 ? "已满级" : `强化 -${cost} 灵石`);
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
      ctx.fillText("金色神品装备会自动进入背包保留", this.width / 2, modal.y + 284);
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

  renderShop(profile, shopMessage = "") {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getShopLayout();
    const cosmetics = profile.getCosmetics();
    this.lastShopTotal = cosmetics.length;
    const pageSize = modal.cosmeticRows.length;
    const pageCount = Math.max(1, Math.ceil(cosmetics.length / pageSize));
    this.shopPage = this.clamp(this.shopPage || 0, 0, pageCount - 1);
    const pageStart = this.shopPage * pageSize;
    const visibleCosmetics = cosmetics.slice(pageStart, pageStart + pageSize);
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

    visibleCosmetics.forEach((item, index) => {
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
    ctx.fillText(shopMessage || "所有皮肤只能通过灵石直接购买", this.width / 2, modal.prev.y - 10);
    ctx.fillText(`第 ${this.shopPage + 1} / ${pageCount} 页`, this.width / 2, modal.close.y - 12);
    this.drawButton(modal.prev, this.shopPage > 0 ? "#8b6d4b" : "#c5bba7", "上一页");
    this.drawButton(modal.next, this.shopPage < pageCount - 1 ? "#8b6d4b" : "#c5bba7", "下一页");
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
      prev: { x: x + 18, y: y + height - 106, width: (width - 48) / 2, height: 35 },
      next: { x: x + 30 + (width - 48) / 2, y: y + height - 106, width: (width - 48) / 2, height: 35 },
      close: { x: x + 18, y: y + height - 61, width: width - 36, height: 43 }
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

    skills.slice(0, modal.skillRows.length).forEach((skill, index) => {
      const rect = modal.skillRows[index];
      this.fillPanel(rect, skill.selected ? "rgba(60, 144, 99, 0.2)" : "rgba(91, 73, 57, 0.08)", 7);
      ctx.strokeStyle = skill.selected ? "#3c9063" : "rgba(118, 90, 66, 0.24)";
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      this.drawSkillIcon(rect.x + 18, rect.y + rect.height / 2, Math.min(12, rect.height * 0.3), skill.type, skill.color);
      ctx.textAlign = "left";
      ctx.fillStyle = "#4b3827";
      ctx.font = `bold ${rect.height < 38 ? 11 : 12}px sans-serif`;
      ctx.fillText(skill.name, rect.x + 38, rect.y + rect.height * 0.38);
      ctx.fillStyle = "#816d5d";
      ctx.font = `${rect.height < 38 ? 9 : 10}px sans-serif`;
      ctx.fillText(skill.description, rect.x + 38, rect.y + rect.height * 0.78);
      ctx.textAlign = "right";
      ctx.fillStyle = skill.selected ? "#317d54" : "#8b6d4b";
      ctx.font = `bold ${rect.height < 38 ? 10 : 11}px sans-serif`;
      ctx.fillText(skill.selected ? "已装备" : `${skill.cooldown.toFixed(1)}秒`, rect.x + rect.width - 9, rect.y + rect.height * 0.6);
    });
    this.drawButton(modal.close, "#9b6b3f", "完成");
  }

  getSkillsLayout() {
    const width = Math.min(356, this.width - 24);
    const height = Math.min(690, this.layout.safeBottom - this.layout.contentTop - 22);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const rowX = x + 14;
    const rowWidth = width - 28;
    const rowHeight = this.height < 720 ? 34 : 36;
    const rowGap = this.height < 720 ? 3 : 4;
    const rowY = y + 88;
    const available = Math.max(1, height - 154);
    const rowCount = Math.max(5, Math.floor(available / (rowHeight + rowGap)));
    return {
      x, y, width, height,
      headerHeight: 50,
      skillRows: Array.from({ length: rowCount }, (_, index) => ({
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
    ctx.fillText(battle.isPvp ? `${battle.fairMode ? "公平演武" : "演武场"} · 对阵 ${battle.enemy.name}` : `${battle.enemy.isBoss ? "首领挑战" : "冒险挑战"} · 第 ${battle.stage} 关`, this.width / 2, top + 21);
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
    const heroSprite = skin ? skin.sprite : profile.character.sprite;
    const weapon = this.getCharacterWeaponPreset(heroSprite, profile.getEquipped("weapon"));
    this.drawBattleFighter(heroSprite, this.width * 0.09 + heroLunge, fighterBaseY - heroHeight + heroIdle, heroHeight, {
      flip: false,
      shake: battle.enemyAction > 0 ? 2 : 0,
      weapon,
      elapsed: battle.elapsed,
      action: battle.heroAction > 0 ? 1 : 0
    });
    this.drawBattleFighter(enemySprite, this.width - this.width * 0.09 - enemyWidth - enemyLunge, fighterBaseY - scaledEnemyHeight + enemyIdle, scaledEnemyHeight, {
      flip: true,
      shake: battle.heroAction > 0 ? 2 : 0,
      boss: battle.enemy.isBoss ? battle.enemy : null,
      weapon: battle.isPvp && enemySprite.startsWith("hero-") ? this.getCharacterWeaponPreset(enemySprite, null, battle.enemy.avatarColor) : null,
      elapsed: battle.elapsed,
      action: battle.enemyAction > 0 ? 1 : 0
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
    if (options.weapon) {
      const weaponX = options.flip ? 1 - (options.weapon.battleX || 0.7) : (options.weapon.battleX || 0.7);
      this.drawHeldWeaponAt(x + shakeX + width * weaponX, y + height * (options.weapon.battleY || 0.6), height, options.weapon, {
        elapsed: options.elapsed || 0,
        action: options.action || 0,
        angle: (options.weapon.battleAngle || -0.72) - (options.action || 0) * 0.28,
        flip: options.flip
      });
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
    const layout = this.getShopLayout();
    const pageSize = layout.cosmeticRows.length;
    const pageCount = Math.max(1, Math.ceil((this.lastShopTotal || pageSize) / pageSize));
    if (this.contains(layout.prev, x, y)) {
      this.shopPage = this.clamp((this.shopPage || 0) - 1, 0, pageCount - 1);
      return -1;
    }
    if (this.contains(layout.next, x, y)) {
      this.shopPage = this.clamp((this.shopPage || 0) + 1, 0, pageCount - 1);
      return -1;
    }
    const rowIndex = layout.cosmeticRows.findIndex((rect) => this.contains(rect, x, y));
    if (rowIndex < 0) return -1;
    const itemIndex = (this.shopPage || 0) * pageSize + rowIndex;
    return itemIndex < (this.lastShopTotal || 0) ? itemIndex : -1;
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

  createLayout() {
    const safeTop = Math.max(0, this.safeArea.top || 0);
    const safeBottom = Math.min(this.height, this.safeArea.bottom || this.height);
    const menuBottom = this.menuButton ? this.menuButton.bottom : safeTop;
    const contentTop = Math.max(safeTop + 5, menuBottom + 5);
    const edge = this.clamp(this.width * 0.026, 8, 13);
    const gap = this.clamp(this.width * 0.018, 5, 8);
    const resource = { x: 0, y: contentTop, width: this.width, height: 36 };
    const summary = { x: edge, y: resource.y + resource.height + 5, width: this.width - edge * 2, height: 42 };
    const utilityY = summary.y + summary.height + 5;
    const utilityHeight = 30;
    const utilityWidth = (this.width - edge * 2 - gap * 4) / 5;
    const utilities = {
      explore: { x: edge, y: utilityY, width: utilityWidth, height: utilityHeight },
      inventory: { x: edge + (utilityWidth + gap), y: utilityY, width: utilityWidth, height: utilityHeight },
      collection: { x: edge + (utilityWidth + gap) * 2, y: utilityY, width: utilityWidth, height: utilityHeight },
      skills: { x: edge + (utilityWidth + gap) * 3, y: utilityY, width: utilityWidth, height: utilityHeight },
      audio: { x: edge + (utilityWidth + gap) * 4, y: utilityY, width: utilityWidth, height: utilityHeight }
    };
    const statsSummary = { x: edge, y: utilityY + utilityHeight + 5, width: this.width - edge * 2, height: 39 };
    const actionHeight = this.clamp(this.height * 0.092, 56, 68);
    const actionY = safeBottom - actionHeight - 10;
    const actionInnerWidth = this.width - edge * 2 - gap * 2;
    const chopWidth = Math.round(actionInnerWidth * 0.46);
    const cultivateWidth = Math.round(actionInnerWidth * 0.24);
    const actions = {
      chop: { x: edge, y: actionY, width: chopWidth, height: actionHeight },
      cultivate: { x: edge + chopWidth + gap, y: actionY, width: cultivateWidth, height: actionHeight },
      challenge: { x: edge + chopWidth + gap * 2 + cultivateWidth, y: actionY, width: actionInnerWidth - chopWidth - cultivateWidth, height: actionHeight }
    };
    const treeInfo = { x: edge, y: actionY - 72, width: this.width - edge * 2, height: 30 };
    const secondaryWidth = (this.width - edge * 2 - gap * 4) / 5;
    const secondaryY = actionY - 37;
    return {
      safeTop,
      safeBottom,
      contentTop,
      edge,
      gap,
      resource,
      summary,
      utilities,
      statsSummary,
      actions,
      treeInfo,
      signIn: { x: edge, y: secondaryY, width: secondaryWidth, height: 30 },
      quickDraw: { x: edge + (secondaryWidth + gap), y: secondaryY, width: secondaryWidth, height: 30 },
      shop: { x: edge + (secondaryWidth + gap) * 2, y: secondaryY, width: secondaryWidth, height: 30 },
      pvp: { x: edge + (secondaryWidth + gap) * 3, y: secondaryY, width: secondaryWidth, height: 30 },
      ranking: { x: edge + (secondaryWidth + gap) * 4, y: secondaryY, width: secondaryWidth, height: 30 },
      playTop: statsSummary.y + statsSummary.height + 6,
      playBottom: treeInfo.y - 5,
      equipment: {
        width: this.clamp(this.width * 0.145, 46, 59),
        height: this.clamp(((treeInfo.y - 5) - (statsSummary.y + statsSummary.height + 6) - 14) / 3, 40, 49),
        gap: this.clamp((((treeInfo.y - 5) - (statsSummary.y + statsSummary.height + 6)) - this.clamp(((treeInfo.y - 5) - (statsSummary.y + statsSummary.height + 6) - 14) / 3, 40, 49) * 3) / 2, 5, 12),
        top: statsSummary.y + statsSummary.height + 6
      },
      tree: (() => {
        const playTop = statsSummary.y + statsSummary.height + 6;
        const playBottom = treeInfo.y - 5;
        const treeHeight = this.clamp((playBottom - playTop) * 0.98, 205, 335);
        const treeWidth = treeHeight * 620 / 731;
        return {
          x: this.width / 2 - treeWidth / 2,
          y: playTop + (playBottom - playTop - treeHeight) / 2,
          width: treeWidth,
          height: treeHeight
        };
      })()
    };
  }

  renderHome(profile, toast, treePulse = 0, elapsed = 0, audioEnabled = true, homeAction = 0) {
    const ctx = this.ctx;
    const stats = profile.getStats();
    const realm = profile.getRealm();
    const { summary, treeInfo, signIn, quickDraw, shop, pvp, ranking, actions } = this.layout;
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
    this.drawMiniButton(signIn, "#4c9a74", profile.signInLastDate ? "今日签到" : "每日签到");
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
    const { explore, inventory, collection, skills, audio } = this.layout.utilities;
    const progress = profile.getCollectionProgress();
    this.drawMiniButton(explore, "#477c82", `游历 ${profile.exploreEnergy}/8`);
    this.drawMiniButton(inventory, "#7e6ca8", `背包 ${profile.getInventory().length}`);
    this.drawMiniButton(collection, "#6d6689", `图鉴 ${progress.found}/${progress.total}`);
    this.drawSkillMiniButton(skills, profile.character.skill);
    this.drawMiniButton(audio, audioEnabled ? "#947345" : "#5b6370", audioEnabled ? "声音 开" : "声音 关");
  }

  getModalLayout() {
    const maxWidth = Math.min(348, this.width - 24);
    const maxHeight = this.layout.safeBottom - this.layout.contentTop - 22;
    const scale = Math.min(1, maxWidth / 348, maxHeight / 430);
    const width = 348 * scale;
    const height = 430 * scale;
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (maxHeight - height) / 2;
    const buttonY = y + height - 65 * scale;
    const buttonGap = 8 * scale;
    const buttonWidth = (width - 38 * scale - buttonGap * 2) / 3;
    const buttonHeight = 45 * scale;
    return {
      x, y, width, height, scale,
      headerHeight: 50 * scale,
      close: { x: x + width - 44 * scale, y: y + 10 * scale, width: 28 * scale, height: 28 * scale },
      sell: { x: x + 19 * scale, y: buttonY, width: buttonWidth, height: buttonHeight },
      stash: { x: x + 19 * scale + buttonWidth + buttonGap, y: buttonY, width: buttonWidth, height: buttonHeight },
      equip: { x: x + width - 19 * scale - buttonWidth, y: buttonY, width: buttonWidth, height: buttonHeight }
    };
  }

  renderLoot(profile, item) {
    this.renderHome(profile, "");
    this.renderEquipmentPanel(profile, item, "灵树掉落装备", { sell: "分解", stash: "入包", equip: "穿戴" });
  }

  renderItemInspect(profile, item, source) {
    const title = source === "inventory" ? "背包装备" : "抽取装备详情";
    const labels = source === "inventory"
      ? { sell: "出售", stash: "返回", equip: "装备" }
      : { sell: "分解", stash: "入包", equip: "穿戴" };
    this.renderEquipmentPanel(profile, item, title, labels);
  }

  renderEquipmentPanel(profile, item, title, labels) {
    const ctx = this.ctx;
    const comparison = profile.getEquipmentComparison(item);
    const oldItem = comparison.current;
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
    ctx.fillText(title, this.width / 2, modal.y + 32 * modal.scale);
    this.drawButton(modal.close, "#7f715f", "X");

    ctx.fillStyle = item.color;
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
    this.drawButton(modal.sell, "#9b6b3f", labels.sell);
    this.drawButton(modal.stash, "#7f715f", labels.stash);
    this.drawButton(modal.equip, "#3c9063", labels.equip);
  }

  getLootActionAt(x, y) {
    const modal = this.getModalLayout();
    if (this.contains(modal.close, x, y)) return "close";
    if (this.contains(modal.sell, x, y)) return "sell";
    if (this.contains(modal.stash, x, y)) return "stash";
    if (this.contains(modal.equip, x, y)) return "equip";
    return "";
  }

  getInspectActionAt(x, y, source) {
    const action = this.getLootActionAt(x, y);
    if (action === "close") return "close";
    if (source === "inventory" && action === "stash") return "stash";
    return action;
  }

  getQuickDrawItemIndexAt(x, y, resultCount) {
    const cards = this.getQuickDrawLayout().resultCards.slice(0, Math.min(resultCount, 6));
    return cards.findIndex((rect) => this.contains(rect, x, y));
  }

  renderInventory(profile, page = 0) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getInventoryLayout();
    const items = profile.getInventory();
    const totalPages = Math.max(1, Math.ceil(items.length / 6));
    const pageIndex = Math.max(0, Math.min(totalPages - 1, page));
    const view = items.slice(pageIndex * 6, pageIndex * 6 + 6);
    this.drawModalShell(modal, "玩家背包");
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.fillText(`已存放 ${items.length} 件装备`, this.width / 2, modal.y + 72);
    if (!view.length) {
      ctx.fillStyle = "#5b4939";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("背包还是空的", this.width / 2, modal.y + 180);
    }
    view.forEach((item, index) => {
      const rect = modal.rows[index];
      this.fillPanel(rect, item.rarity === "legend" ? "rgba(255, 210, 80, 0.18)" : "rgba(91, 73, 57, 0.08)", 7);
      ctx.strokeStyle = item.color;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.textAlign = "left";
      ctx.fillStyle = item.color;
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(item.icon, rect.x + 12, rect.y + 24);
      ctx.fillStyle = "#4b3827";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(item.name, rect.x + 40, rect.y + 18);
      ctx.fillStyle = "#816d5d";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${item.rarityName} · ${item.slotName} · 妖力 ${item.power}`, rect.x + 40, rect.y + 34);
    });
    ctx.textAlign = "center";
    ctx.fillStyle = "#8b6d4b";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${pageIndex + 1} / ${totalPages}`, this.width / 2, modal.y + modal.height - 91);
    this.drawButton(modal.previous, "#7f715f", "上一页");
    this.drawButton(modal.close, "#9b6b3f", "关闭");
    this.drawButton(modal.next, "#477fa8", "下一页");
  }

  getInventoryLayout() {
    const width = Math.min(356, this.width - 24);
    const height = Math.min(458, this.layout.safeBottom - this.layout.contentTop - 22);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const rowGap = 8;
    const rowHeight = 46;
    const buttonGap = 8;
    const buttonWidth = (width - 40 - buttonGap * 2) / 3;
    const buttonY = y + height - 67;
    return {
      x, y, width, height,
      headerHeight: 50,
      rows: Array.from({ length: 6 }, (_, index) => ({
        x: x + 16,
        y: y + 92 + index * (rowHeight + rowGap),
        width: width - 32,
        height: rowHeight
      })),
      previous: { x: x + 12, y: buttonY, width: buttonWidth, height: 45 },
      close: { x: x + 12 + buttonWidth + buttonGap, y: buttonY, width: buttonWidth, height: 45 },
      next: { x: x + 12 + (buttonWidth + buttonGap) * 2, y: buttonY, width: buttonWidth, height: 45 }
    };
  }

  getInventoryItemIndexAt(x, y, profile, page = 0) {
    const items = profile.getInventory().slice(page * 6, page * 6 + 6);
    return this.getInventoryLayout().rows.slice(0, items.length).findIndex((rect) => this.contains(rect, x, y));
  }

  isInventoryPrevButton(x, y) {
    return this.contains(this.getInventoryLayout().previous, x, y);
  }

  isInventoryNextButton(x, y) {
    return this.contains(this.getInventoryLayout().next, x, y);
  }

  isInventoryCloseButton(x, y) {
    return this.contains(this.getInventoryLayout().close, x, y);
  }

  renderSignIn(profile, rewards, todayKey) {
    this.renderHome(profile, "");
    const ctx = this.ctx;
    const modal = this.getSignInLayout();
    this.drawModalShell(modal, "30日签到");
    ctx.fillStyle = "#765a42";
    ctx.font = "12px sans-serif";
    ctx.fillText(`今日 ${todayKey} · 已签到 ${profile.signInClaimedDays}/${rewards.length}`, this.width / 2, modal.y + 72);
    rewards.forEach((reward, index) => {
      const rect = modal.cells[index];
      const claimed = index < profile.signInClaimedDays;
      const current = index === profile.signInClaimedDays;
      this.fillPanel(rect, claimed ? "rgba(60, 144, 99, 0.22)" : current ? "rgba(255, 210, 80, 0.2)" : "rgba(91, 73, 57, 0.08)", 6);
      ctx.strokeStyle = claimed ? "#3c9063" : current ? "#d29a38" : "rgba(118, 90, 66, 0.24)";
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.textAlign = "center";
      ctx.fillStyle = claimed ? "#317d54" : "#5b4939";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`第${reward.day}天`, rect.x + rect.width / 2, rect.y + 16);
      ctx.font = "10px sans-serif";
      this.drawWrappedText(reward.label, rect.x + 6, rect.y + 30, rect.width - 12, 11);
    });
    this.drawButton(modal.claim, profile.signInClaimedDays >= rewards.length || profile.signInLastDate === todayKey ? "#6f6a61" : "#3c9063", profile.signInClaimedDays >= rewards.length ? "已领完" : profile.signInLastDate === todayKey ? "今日已签" : "领取今日奖励");
    this.drawButton(modal.close, "#7f715f", "关闭");
  }

  getSignInLayout() {
    const width = Math.min(356, this.width - 24);
    const height = Math.min(520, this.layout.safeBottom - this.layout.contentTop - 18);
    const x = (this.width - width) / 2;
    const y = this.layout.contentTop + (this.layout.safeBottom - this.layout.contentTop - height) / 2;
    const cellGap = 6;
    const cellWidth = (width - 44 - cellGap * 4) / 5;
    const cellHeight = 42;
    return {
      x, y, width, height,
      headerHeight: 50,
      cells: Array.from({ length: 30 }, (_, index) => ({
        x: x + 16 + (index % 5) * (cellWidth + cellGap),
        y: y + 92 + Math.floor(index / 5) * (cellHeight + cellGap),
        width: cellWidth,
        height: cellHeight
      })),
      claim: { x: x + 20, y: y + height - 64, width: width - 120, height: 43 },
      close: { x: x + width - 88, y: y + height - 64, width: 68, height: 43 }
    };
  }

  isSignInClaimButton(x, y) {
    return this.contains(this.getSignInLayout().claim, x, y);
  }

  isSignInCloseButton(x, y) {
    return this.contains(this.getSignInLayout().close, x, y);
  }

  isInventoryButton(x, y) {
    return this.contains(this.layout.utilities.inventory, x, y);
  }

  isSignInButton(x, y) {
    return this.contains(this.layout.signIn, x, y);
  }
}

module.exports = UI;



