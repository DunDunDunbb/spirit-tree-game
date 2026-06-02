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
  "enemy-bamboo-scout": "assets/images/enemies/bamboo-scout.png",
  "enemy-stone-beast": "assets/images/enemies/stone-beast.png",
  "enemy-vine-spirit": "assets/images/enemies/vine-spirit.png",
  "enemy-frostwing": "assets/images/enemies/frostwing.png",
  "enemy-moon-assassin": "assets/images/enemies/moon-assassin.png",
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
