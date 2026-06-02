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
