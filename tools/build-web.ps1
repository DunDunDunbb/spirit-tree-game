$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$entry = "game.js"
$modules = [ordered]@{}

function Normalize-Path([string]$path) {
  return ($path -replace "\\", "/")
}

function Resolve-Module([string]$from, [string]$request) {
  if (-not $request.StartsWith(".")) {
    throw "Only relative imports are supported in the web bundle: $request"
  }
  $sourcePath = Join-Path $root $from
  $parent = [System.IO.Path]::GetDirectoryName($sourcePath)
  $joined = [System.IO.Path]::Combine($parent, $request)
  $resolved = Normalize-Path ([System.IO.Path]::GetFullPath($joined))
  $rootPath = Normalize-Path ([string]$root)
  if ($resolved.StartsWith($rootPath)) {
    $relative = $resolved.Substring($rootPath.Length + 1)
    if ($relative.EndsWith(".js")) { return $relative }
    return "$relative.js"
  }
  if ($resolved.EndsWith(".js")) { return $resolved }
  return "$resolved.js"
}

function Collect-Module([string]$moduleId) {
  if ($modules.Contains($moduleId)) { return }
  $sourcePath = Join-Path $root $moduleId
  $source = Get-Content -Raw -Encoding utf8 -Path $sourcePath
  $modules[$moduleId] = $source
  foreach ($match in [regex]::Matches($source, 'require\(["'']([^"'']+)["'']\)')) {
    Collect-Module (Resolve-Module $moduleId $match.Groups[1].Value)
  }
}

Collect-Module $entry

$factoryBlocks = New-Object System.Collections.Generic.List[string]
foreach ($entryPair in $modules.GetEnumerator()) {
  $moduleId = $entryPair.Key
  $source = $entryPair.Value
  $factoryBlocks.Add(("""{0}"": function(require, module, exports) {{`r`n{1}`r`n  }}," -f $moduleId, $source))
}

$bundle = @"
(function runGameBundle() {
  const modules = {
$([string]::Join("`r`n", ($factoryBlocks | ForEach-Object { "    $_" })))
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
    panel.textContent = "Game failed to start:\n" + message;
    document.body.appendChild(panel);
  }

  try {
    requireModule("$entry");
  } catch (error) {
    showBootError(error);
    console.error(error);
  }
}());
"@

$bundlePath = Join-Path $root "web-game.bundle.js"
Set-Content -Path $bundlePath -Value $bundle -Encoding utf8

$dist = Join-Path $root "web-dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

function Copy-WebFile([string]$relativePath) {
  $sourcePath = Join-Path $root $relativePath
  $destinationPath = Join-Path $dist $relativePath
  $destinationDirectory = Split-Path -Parent $destinationPath
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

function Copy-WebDirectory([string]$relativePath) {
  $sourcePath = Join-Path $root $relativePath
  $destinationPath = Join-Path $dist $relativePath
  New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null
  Copy-Item -Path (Join-Path $sourcePath "*") -Destination $destinationPath -Recurse -Force
}

@(
  "index.html",
  "admin.html",
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
  "assets/images/heroes/skins/bocchi-shirt.png",
  "assets/images/heroes/skins/samurai.png",
  "assets/images/heroes/skins/cyberpunk.png",
  "assets/images/heroes/skins/frost-king.png",
  "assets/images/heroes/skins/magma-warlord.png",
  "assets/images/heroes/skins/jade-monk.png",
  "assets/images/heroes/skins/desert-pharaoh.png",
  "assets/images/heroes/skins/jungle-guardian.png",
  "assets/images/heroes/skins/steampunk.png",
  "assets/images/heroes/skins/star-priest.png",
  "assets/images/heroes/skins/sakura-festival.png",
  "assets/images/heroes/skins/deep-sea-captain.png"
) | ForEach-Object { Copy-WebFile $_ }

@(
  "assets/audio",
  "assets/images/bosses",
  "assets/images/enemies",
  "assets/images/scenes"
) | ForEach-Object { Copy-WebDirectory $_ }

Write-Host "Built web-game.bundle.js with $($modules.Count) modules"
Write-Host "Prepared web-dist for static hosting"
