const { chromium } = require("playwright");
const fs = require("fs");
const http = require("http");
const path = require("path");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".wav": "audio/wav"
};

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function startStaticServer() {
  const root = path.resolve(__dirname, "..", "web-dist");
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, body) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500);
        response.end(error.code === "ENOENT" ? "Not Found" : "Server Error");
        return;
      }
      response.writeHead(200, { "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream" });
      response.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/` });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function run() {
  const localServer = process.argv[2] ? null : await startStaticServer();
  const baseUrl = process.argv[2] || localServer.baseUrl;
  const executablePath = findBrowserExecutable();
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true
  });
  const errors = [];
  const failedResponses = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      errors.push(`${message.text()} ${location.url || ""}`.trim());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const before = await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas");
    const context = canvas.getContext("2d");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let coloredPixels = 0;
    for (let index = 0; index < pixels.length; index += 400) {
      if (pixels[index + 3] > 0) coloredPixels += 1;
    }
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      hasWxShim: typeof wx === "object",
      nameDialogVisible: !document.getElementById("name-dialog").hidden,
      coloredPixels
    };
  });

  await page.locator("#player-name").fill("初始名字");
  await page.locator("#name-submit").click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: "tmp/web-tutorial.png" });
  await page.mouse.click(325, 232);
  await page.mouse.click(325, 720);
  await page.mouse.click(325, 305);
  await page.mouse.click(325, 261);
  await page.mouse.click(325, 720);
  await page.waitForTimeout(100);
  await page.locator("#rename-button").click();
  await page.locator("#player-name").fill("测试玩家");
  await page.locator("#name-submit").click();
  await page.mouse.click(85, 655);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "tmp/web-dialogue.png" });
  const dialogueChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(17, 300, 356, 220).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });
  await page.mouse.click(320, 478);
  await page.waitForTimeout(100);
  const nextDialogueChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(17, 300, 356, 220).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });
  await page.mouse.click(240, 478);
  await page.waitForTimeout(100);
  await page.mouse.click(195, 400);
  await page.waitForTimeout(1200);
  await page.mouse.click(108, 579);
  await page.waitForTimeout(100);

  const homeChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(17, 190, 356, 458).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });

  await page.mouse.click(145, 107);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "tmp/web-collection.png" });
  const collectionChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(17, 190, 356, 458).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });

  await page.mouse.click(295, 604);
  await page.waitForTimeout(100);
  const nextCollectionChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(17, 190, 356, 458).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });
  await page.mouse.click(187, 604);
  await page.waitForTimeout(100);
  await page.mouse.click(242, 107);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "tmp/web-skills.png" });
  const skillsChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(17, 190, 356, 458).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });
  await page.mouse.click(195, 413);
  await page.waitForTimeout(100);
  const selectedSkillsChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(17, 190, 356, 458).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });
  await page.mouse.click(195, 612);
  await page.waitForTimeout(100);

  const after = await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("spirit-tree-profile-v1"));
    return {
      characterId: profile && profile.characterId,
      characterName: profile && profile.characterName,
      peaches: profile && profile.peaches,
      treeExp: profile && profile.treeExp,
      skillId: profile && profile.skillId,
      tutorialCompleted: profile && profile.tutorialCompleted
    };
  });

  await page.screenshot({ path: "tmp/web-smoke.png" });
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("spirit-tree-profile-v1"));
    profile.stage = 5;
    localStorage.setItem("spirit-tree-profile-v1", JSON.stringify(profile));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.mouse.click(338, 798);
  await page.waitForTimeout(320);
  await page.screenshot({ path: "tmp/web-boss.png" });
  const bossIntroChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(0, 160, 390, 520).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });
  await page.waitForTimeout(2850);
  await page.screenshot({ path: "tmp/web-skill-effect.png" });
  const bossBattleChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(0, 160, 390, 520).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("spirit-tree-profile-v1"));
    profile.stage = 65;
    localStorage.setItem("spirit-tree-profile-v1", JSON.stringify(profile));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.mouse.click(338, 798);
  await page.waitForTimeout(320);
  await page.screenshot({ path: "tmp/web-boss-new.png" });
  const newBossChecksum = await page.evaluate(() => {
    const context = document.getElementById("game-canvas").getContext("2d");
    const pixels = context.getImageData(0, 160, 390, 520).data;
    let checksum = 0;
    for (let index = 0; index < pixels.length; index += 40) checksum = (checksum + pixels[index] + pixels[index + 1] + pixels[index + 2]) >>> 0;
    return checksum;
  });

  const result = {
    before, after, homeChecksum, collectionChecksum, nextCollectionChecksum,
    dialogueChecksum, nextDialogueChecksum, skillsChecksum, selectedSkillsChecksum, bossIntroChecksum, bossBattleChecksum, newBossChecksum,
    failedResponses, errors
  };
  console.log(JSON.stringify(result, null, 2));

  if (!before.hasWxShim || before.canvasWidth <= 0 || before.canvasHeight <= 0) {
    throw new Error("Canvas or wx shim failed to initialize");
  }
  if (!before.nameDialogVisible) {
    throw new Error("First-visit name dialog did not open");
  }
  if (before.coloredPixels <= 0) {
    throw new Error("Canvas remained blank");
  }
  if (after.characterId !== "main-character" || after.characterName !== "测试玩家" || after.peaches !== 29 || after.treeExp !== 1 || after.skillId !== "thunder" || !after.tutorialCompleted) {
    throw new Error("Tutorial, rename, tree click, or skill selection did not save the expected profile");
  }
  if (homeChecksum === collectionChecksum || collectionChecksum === nextCollectionChecksum) {
    throw new Error("Collection modal did not open or switch categories");
  }
  if (dialogueChecksum === nextDialogueChecksum) {
    throw new Error("Hero dialogue did not open or advance");
  }
  if (homeChecksum === skillsChecksum || skillsChecksum === selectedSkillsChecksum) {
    throw new Error("Skill modal did not open or update the selected skill");
  }
  if (bossIntroChecksum === bossBattleChecksum) {
    throw new Error("Boss battle did not animate after the intro");
  }
  if (newBossChecksum === bossIntroChecksum) {
    throw new Error("New boss appearance did not differ from the first boss");
  }
  if (failedResponses.length || errors.length) {
    throw new Error("Browser reported failed resources or runtime errors");
  }
  } finally {
    await browser.close();
    if (localServer) await closeServer(localServer.server);
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
