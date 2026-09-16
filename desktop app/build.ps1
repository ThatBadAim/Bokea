# Builds Bokeà for Windows, on Windows. build.sh does the same on Linux or macOS.
#
#   powershell -ExecutionPolicy Bypass -File build.ps1
#
# Needs the .NET 10 SDK. Inno Setup 6 (https://jrsoftware.org/isinfo.php) is
# used for the installer when it is installed; without it you still get the
# portable folder and the zip.
param(
    [string]$Version = $(if ($env:BOKEA_VERSION) { $env:BOKEA_VERSION } else { "1.0.0" })
)

$ErrorActionPreference = "Stop"
$Here = $PSScriptRoot
$Build = Join-Path $Here "build"
$Dist = Join-Path $Here "dist"
$Stage = Join-Path $Dist "Bokea-win-x64"
$WebSource = Join-Path (Split-Path $Here -Parent) "Bokeà\wwwroot"

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Check() { if ($LASTEXITCODE -ne 0) { throw "Step failed with exit code $LASTEXITCODE" } }

Step "Build tools"
dotnet build (Join-Path $Here "tools\Packager") -c Release -o (Join-Path $Build "tools") --nologo -v quiet; Check
$Packager = Join-Path $Build "tools\Packager.dll"

Step "Web files (copied from Bokeà\wwwroot, which is never modified)"
dotnet $Packager web --source $WebSource --out (Join-Path $Build "web") --cache (Join-Path $Build "cache"); Check

Step "WebKit engine"
dotnet $Packager webkit --out (Join-Path $Build "runtime") --cache (Join-Path $Build "cache"); Check

Step "Bokea.exe"
dotnet publish (Join-Path $Here "src\Bokea.Desktop") -c Release -o (Join-Path $Build "app") -p:Version=$Version --nologo -v quiet; Check

Step "Stage"
New-Item -ItemType Directory -Force $Dist | Out-Null
dotnet $Packager stage --app (Join-Path $Build "app") --web (Join-Path $Build "web") --runtime (Join-Path $Build "runtime") `
    --notices (Join-Path $Here "THIRD-PARTY-NOTICES.txt") --out $Stage; Check
dotnet $Packager zip --dir $Stage --out (Join-Path $Dist "Bokea-$Version-win-x64.zip"); Check

Step "Installer"
$Iscc = @(
    $env:ISCC,
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($Iscc) {
    Push-Location (Join-Path $Here "installer")
    try { & $Iscc /Q "/DAppVersion=$Version" Bokea.iss; Check } finally { Pop-Location }
    Write-Host "dist\Bokea-Setup-$Version.exe"
} else {
    Write-Host "Skipped: install Inno Setup 6 to build the installer."
}

Step "Done"
Get-ChildItem $Dist
