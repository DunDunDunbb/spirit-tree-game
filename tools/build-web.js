const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const entry = "game.js";
const modules = new Map();

function normalize(filePath) {
  return filePath.replace(/\\/g, "/");
}

function resolveModule(from, request) {
  if (!request.startsWith(".")) {
    throw new Error(`Only relative imports are supported in the web bundle: ${request}`);
  }
  const parent = path.posix.dirname(from);
  const resolved = path.posix.normalize(path.posix.join(parent, request));
  return resolved.endsWith(".js") ? resolved : `${resolved}.js`;
}

function collect(moduleId) {
  if (modules.has(moduleId)) return;
  const sourcePath = path.join(root, moduleId);
  const source = fs.readFileSync(sourcePath, "utf8");
  modules.set(moduleId, source);
  const requirePattern = /require\(["']([^"']+)["']\)/g;
  let match;
  while ((match = requirePattern.exec(source))) {
    collect(resolveModule(moduleId, match[1]));
  }
}

collect(entry);

const factories = Array.from(modules.entries())
  .map(([moduleId, source]) => `${JSON.stringify(moduleId)}: function(require, module, exports) {\n${source}\n}`)
  .join(",\n");

const bundle = `(function runGameBundle() {
  const modules = {
${factories}
  };
  const cache = {};

  function resolveModule(from, request) {
    const segments = (from.split("/").slice(0, -1).join("/") + "/" + request).split("/");
    const resolved = [];
    segments.forEach((segment) => {
      if (!segment || segment === ".") return;
      if (segment === "..") resolved.pop();
      else resolved.push(segment);
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

  requireModule(${JSON.stringify(entry)});
}());
`;

fs.writeFileSync(path.join(root, "web-game.bundle.js"), bundle);

const dist = path.join(root, "web-dist");
if (!dist.startsWith(`${root}${path.sep}`)) {
  throw new Error(`Refusing to replace directory outside project: ${dist}`);
}
fs.rmSync(dist, { recursive: true, force: true });

function copyFile(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(dist, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(dist, relativePath);
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

[
  "index.html",
  "web-game.bundle.js",
  "web/wx-shim.js",
  "assets/images/background.jpg",
  "assets/images/spirit-tree.png",
  "assets/images/ui/uganda-login-cover.png",
  "assets/images/heroes/main-character.png",
  "assets/images/heroes/skins/streetwear.png",
  "assets/images/heroes/skins/wuxia.png",
  "assets/images/heroes/skins/royal.png",
  "assets/images/heroes/skins/bunny.png",
  "assets/images/heroes/skins/nurse.png",
  "assets/images/heroes/skins/bocchi-shirt.png"
].forEach(copyFile);
[
  "assets/audio",
  "assets/images/bosses",
  "assets/images/enemies",
  "assets/images/scenes"
].forEach(copyDirectory);

console.log(`Built web-game.bundle.js with ${modules.size} modules`);
console.log("Prepared web-dist for static hosting");
