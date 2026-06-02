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

  function getSavedProfile() {
    const value = global.localStorage.getItem("spirit-tree-profile-v1");
    if (!value) return {};
    try {
      return JSON.parse(value) || {};
    } catch (error) {
      return {};
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
      global.localStorage.setItem(key, JSON.stringify(value));
    },
    getStorageSync(key) {
      const value = global.localStorage.getItem(key);
      if (!value) return undefined;
      try {
        return JSON.parse(value);
      } catch (error) {
        return undefined;
      }
    }
  };

  if (!getSavedProfile().characterName) {
    openNameDialog();
  }
}(globalThis));
