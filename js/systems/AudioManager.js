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
