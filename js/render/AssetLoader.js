const IMAGE_PATHS = {
  background: "assets/images/background.jpg",
  "scene-moon": "assets/images/background.jpg",
  "scene-bamboo": "assets/images/scenes/bamboo.jpg",
  "scene-canyon": "assets/images/scenes/canyon.jpg",
  "scene-snow": "assets/images/scenes/snow.jpg",
  "scene-aurora": "assets/images/scenes/aurora.png",
  tree: "assets/images/spirit-tree.png",
  "enemy-imp": "assets/images/enemies/imp.png",
  "enemy-brute": "assets/images/enemies/brute.png",
  "enemy-wisp": "assets/images/enemies/wisp.png",
  "enemy-bamboo-scout": "assets/images/enemies/bamboo-scout.png",
  "enemy-stone-beast": "assets/images/enemies/stone-beast.png",
  "enemy-vine-spirit": "assets/images/enemies/vine-spirit.png",
  "enemy-frostwing": "assets/images/enemies/frostwing.png",
  "enemy-moon-assassin": "assets/images/enemies/moon-assassin.png",
  "boss-crystal-emperor": "assets/images/bosses/crystal-emperor.png",
  "boss-abyss-seer": "assets/images/bosses/abyss-seer.png",
  "boss-sun-crow": "assets/images/bosses/sun-crow.png",
  "boss-vine-queen": "assets/images/bosses/vine-queen.png",
  "boss-eclipse-monarch": "assets/images/bosses/eclipse-monarch.png",
  "hero-main-character": "assets/images/heroes/main-character.png",
  "hero-skin-streetwear": "assets/images/heroes/skins/streetwear.png",
  "hero-skin-wuxia": "assets/images/heroes/skins/wuxia.png",
  "hero-skin-royal": "assets/images/heroes/skins/royal.png",
  "hero-skin-bunny": "assets/images/heroes/skins/bunny.png",
  "hero-skin-nurse": "assets/images/heroes/skins/nurse.png",
  "hero-skin-bocchi-shirt": "assets/images/heroes/skins/bocchi-shirt.png",
  "hero-skin-samurai": "assets/images/heroes/skins/samurai.png",
  "hero-skin-cyberpunk": "assets/images/heroes/skins/cyberpunk.png",
  "hero-skin-frost-king": "assets/images/heroes/skins/frost-king.png",
  "hero-skin-magma-warlord": "assets/images/heroes/skins/magma-warlord.png",
  "hero-skin-jade-monk": "assets/images/heroes/skins/jade-monk.png",
  "hero-skin-desert-pharaoh": "assets/images/heroes/skins/desert-pharaoh.png",
  "hero-skin-jungle-guardian": "assets/images/heroes/skins/jungle-guardian.png",
  "hero-skin-steampunk": "assets/images/heroes/skins/steampunk.png",
  "hero-skin-star-priest": "assets/images/heroes/skins/star-priest.png",
  "hero-skin-sakura-festival": "assets/images/heroes/skins/sakura-festival.png",
  "hero-skin-deep-sea-captain": "assets/images/heroes/skins/deep-sea-captain.png"
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
