(function createBrowserWxShim(global) {
  if (global.wx) return;

  const canvas = document.getElementById("game-canvas");
  const renameButton = document.getElementById("rename-button");
  const nameDialog = document.getElementById("name-dialog");
  const nameForm = document.getElementById("name-form");
  const nameInput = document.getElementById("player-name");
  const visibilityHandlers = { hide: [], show: [] };
  let playerNameHandler = null;
  let pendingPlayerName = "";

  function getProfileKey() {
    const account = global.localStorage.getItem("uganda-current-account") || "guest";
    return `uganda-profile-v1:${account}`;
  }

  function getSessionToken() {
    return global.localStorage.getItem("uganda-session-token") || "";
  }

  function getCurrentAccount() {
    return global.localStorage.getItem("uganda-current-account") || "";
  }

  function getAccountUserKey(account = getCurrentAccount()) {
    return account ? `uganda-account-user:${account}` : "";
  }

  function getAccountUser() {
    const key = getAccountUserKey();
    if (!key) return {};
    try {
      return JSON.parse(global.localStorage.getItem(key) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function saveAccountUser(user = {}) {
    const username = user.username || getCurrentAccount();
    if (!username) return;
    const current = getAccountUser();
    global.localStorage.setItem(getAccountUserKey(username), JSON.stringify({ ...current, ...user, username }));
  }

  function bindProfileToAccount(profile = {}) {
    const user = getAccountUser();
    const displayName = String(user.displayName || "").trim().slice(0, 8);
    if (!displayName) return profile;
    if (profile.characterName === displayName) return profile;
    return { ...profile, characterName: displayName };
  }

  const avatarBySkin = {
    streetwear: { sprite: "hero-skin-streetwear", color: "#f1bf62" },
    wuxia: { sprite: "hero-skin-wuxia", color: "#78c9ff" },
    royal: { sprite: "hero-skin-royal", color: "#ffd86b" },
    bunny: { sprite: "hero-skin-bunny", color: "#e5b8ff" },
    nurse: { sprite: "hero-skin-nurse", color: "#ff9fb0" },
    "bocchi-shirt": { sprite: "hero-skin-bocchi-shirt", color: "#ff9bc3" }
  };

  function getAvatar(profile = {}) {
    const skinId = profile.equippedCosmetics && profile.equippedCosmetics.skin;
    return avatarBySkin[skinId] || { sprite: "hero-main-character", color: "#f1bf62" };
  }

  function apiRequest(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return global.fetch(path, { ...options, headers }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "服务器请求失败");
      return result;
    });
  }

  function getSavedProfile() {
    const value = global.localStorage.getItem(getProfileKey());
    if (!value) return bindProfileToAccount({});
    try {
      return bindProfileToAccount(JSON.parse(value) || {});
    } catch (error) {
      return bindProfileToAccount({});
    }
  }

  function normalizePlayerName(value) {
    return String(value || "").trim().slice(0, 8);
  }

  function openNameDialog() {
    const saved = getSavedProfile();
    nameInput.value = saved.characterName || "";
    nameDialog.hidden = false;
    global.setTimeout(() => nameInput.focus(), 0);
  }

  function closeNameDialog() {
    nameDialog.hidden = true;
  }

  renameButton.addEventListener("click", openNameDialog);
  nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = normalizePlayerName(nameInput.value);
    if (!name) {
      nameInput.focus();
      return;
    }
    saveAccountUser({ displayName: name });
    if (playerNameHandler) playerNameHandler(name);
    else pendingPlayerName = name;
    closeNameDialog();
  });

  function getSystemInfoSync() {
    const width = global.innerWidth;
    const height = global.innerHeight;
    return {
      windowWidth: width,
      windowHeight: height,
      screenWidth: width,
      screenHeight: height,
      pixelRatio: Math.min(global.devicePixelRatio || 1, 2),
      safeArea: { top: 0, right: width, bottom: height, left: 0, width, height }
    };
  }

  function createInnerAudioContext() {
    const audio = new Audio();
    return {
      get loop() {
        return audio.loop;
      },
      set loop(value) {
        audio.loop = value;
      },
      get volume() {
        return audio.volume;
      },
      set volume(value) {
        audio.volume = value;
      },
      get src() {
        return audio.src;
      },
      set src(value) {
        audio.src = value;
      },
      play() {
        audio.play().catch(() => {});
      },
      pause() {
        audio.pause();
      },
      stop() {
        audio.pause();
        audio.currentTime = 0;
      },
      onEnded(handler) {
        audio.addEventListener("ended", handler);
      },
      destroy() {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }

  document.addEventListener("visibilitychange", () => {
    const key = document.hidden ? "hide" : "show";
    visibilityHandlers[key].forEach((handler) => handler());
  });

  global.wx = {
    getSystemInfoSync,
    createCanvas() {
      return canvas;
    },
    createImage() {
      return new Image();
    },
    createInnerAudioContext,
    onTouchStart(handler) {
      canvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const touch = { clientX: event.clientX, clientY: event.clientY };
        handler({ changedTouches: [touch], touches: [touch] });
      });
    },
    onWindowResize(handler) {
      global.addEventListener("resize", () => handler(getSystemInfoSync()));
    },
    onHide(handler) {
      visibilityHandlers.hide.push(handler);
    },
    onShow(handler) {
      visibilityHandlers.show.push(handler);
    },
    onPlayerNameChange(handler) {
      playerNameHandler = handler;
      if (pendingPlayerName) {
        handler(pendingPlayerName);
        pendingPlayerName = "";
      }
    },
    vibrateShort() {
      if (navigator.vibrate) navigator.vibrate(25);
    },
    setStorageSync(key, value) {
      const storageKey = key === "spirit-tree-profile-v1" ? getProfileKey() : key;
      global.localStorage.setItem(storageKey, JSON.stringify(value));
    },
    getStorageSync(key) {
      const storageKey = key === "spirit-tree-profile-v1" ? getProfileKey() : key;
      const value = global.localStorage.getItem(storageKey);
      if (!value) return undefined;
      try {
        const parsed = JSON.parse(value);
        return key === "spirit-tree-profile-v1" ? bindProfileToAccount(parsed) : parsed;
      } catch (error) {
        return undefined;
      }
    },
    syncLeaderboard(profile) {
      const avatar = getAvatar(profile);
      saveAccountUser({
        displayName: profile.characterName,
        avatarSprite: avatar.sprite,
        avatarColor: avatar.color
      });
      return apiRequest("/api/leaderboard/sync", {
        method: "POST",
        body: JSON.stringify({
          displayName: profile.characterName,
          avatarSprite: avatar.sprite,
          avatarColor: avatar.color,
          rankScore: profile.rankScore,
          pvpWins: profile.pvpWins,
          pvpLosses: profile.pvpLosses
        })
      }).catch(() => {});
    },
    fetchLeaderboard() {
      if (global.location.protocol === "file:") {
        const profile = getSavedProfile();
        return Promise.resolve([
          { name: "狮王散人", score: 1640 },
          { name: "月坛剑客", score: 1488 },
          { name: "赤霞真人", score: 1325 },
          { name: profile.characterName || "离线玩家", score: profile.rankScore || 1000, self: true },
          { name: "草原悍匪·阿坤", score: 884 }
        ].sort((left, right) => right.score - left.score));
      }
      return apiRequest("/api/leaderboard").then((result) => result.entries);
    },
    fetchPvpOpponents() {
      if (global.location.protocol === "file:") {
        return Promise.resolve([]);
      }
      return apiRequest("/api/pvp/opponents").then((result) => result.opponents || []);
    },
    getCurrentAccount
  };

  if (global.localStorage.getItem("uganda-current-account") && !getSavedProfile().characterName) {
    openNameDialog();
  }
}(globalThis));
