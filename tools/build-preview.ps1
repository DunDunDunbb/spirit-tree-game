$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$entry = "game.js"
$modules = [ordered]@{}
$preview = Join-Path $root "tmp/dev-preview"

function Normalize-Path([string]$path) {
  return ($path -replace "\\", "/")
}

function Resolve-Module([string]$from, [string]$request) {
  if (-not $request.StartsWith(".")) {
    throw "Only relative imports are supported in the preview bundle: $request"
  }
  $sourcePath = Join-Path $root $from
  $parent = [System.IO.Path]::GetDirectoryName($sourcePath)
  $resolved = Normalize-Path ([System.IO.Path]::GetFullPath([System.IO.Path]::Combine($parent, $request)))
  $rootPath = Normalize-Path ([string]$root)
  $relative = $resolved.Substring($rootPath.Length + 1)
  if ($relative.EndsWith(".js")) { return $relative }
  return "$relative.js"
}

function Collect-Module([string]$moduleId) {
  if ($modules.Contains($moduleId)) { return }
  $source = Get-Content -Raw -Encoding utf8 -Path (Join-Path $root $moduleId)
  $modules[$moduleId] = $source
  foreach ($match in [regex]::Matches($source, 'require\(["'']([^"'']+)["'']\)')) {
    Collect-Module (Resolve-Module $moduleId $match.Groups[1].Value)
  }
}

Collect-Module $entry
$factoryBlocks = New-Object System.Collections.Generic.List[string]
foreach ($entryPair in $modules.GetEnumerator()) {
  $factoryBlocks.Add(("""{0}"": function(require, module, exports) {{`r`n{1}`r`n  }}," -f $entryPair.Key, $entryPair.Value))
}

$bundle = @"
(function runGameBundle() {
  const modules = {
$([string]::Join("`r`n", ($factoryBlocks | ForEach-Object { "    $_" })))
  };
  const cache = {};
  function resolveModule(from, request) {
    const parts = (from.split("/").slice(0, -1).join("/") + "/" + request).split("/");
    const resolved = [];
    parts.forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") resolved.pop();
      else resolved.push(part);
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
  requireModule("$entry");
}());
"@

New-Item -ItemType Directory -Force -Path $preview | Out-Null
Copy-Item -LiteralPath (Join-Path $root "index.html") -Destination (Join-Path $preview "index.html") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $preview "web") | Out-Null
Copy-Item -LiteralPath (Join-Path $root "web/wx-shim.js") -Destination (Join-Path $preview "web/wx-shim.js") -Force
Copy-Item -LiteralPath (Join-Path $root "assets") -Destination $preview -Recurse -Force
Set-Content -LiteralPath (Join-Path $preview "web-game.bundle.js") -Value $bundle -Encoding utf8
Write-Host "Prepared tmp/dev-preview with $($modules.Count) modules"
