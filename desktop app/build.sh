#!/usr/bin/env bash
# Builds Bokeà for Windows. Runs on Linux or macOS; build.ps1 does the same on Windows.
#
#   ./build.sh
#
# Needs the .NET 10 SDK. Produces, in dist/:
#   Bokea-win-x64/                  the app, ready to run
#   Bokea-<version>-win-x64.zip     the same folder, zipped
#   Bokea-Setup-<version>.exe       the installer, when Inno Setup is available:
#                                   ISCC="wine /path/to/ISCC.exe" ./build.sh
#
# Environment:
#   BOKEA_VERSION   version number stamped on the app and installer (default 1.0.0)
#   ISCC            command that runs Inno Setup's ISCC.exe
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="${BOKEA_VERSION:-1.0.0}"
BUILD="$HERE/build"
DIST="$HERE/dist"
STAGE="$DIST/Bokea-win-x64"
WEB_SOURCE="$HERE/../Bokeà/wwwroot"

step() { printf '\n== %s\n' "$*"; }

step "Build tools"
dotnet build "$HERE/tools/Packager" -c Release -o "$BUILD/tools" --nologo -v quiet
pack() { dotnet "$BUILD/tools/Packager.dll" "$@"; }

step "Web files (copied from Bokeà/wwwroot, which is never modified)"
pack web --source "$WEB_SOURCE" --out "$BUILD/web" --cache "$BUILD/cache"

step "WebKit engine"
pack webkit --out "$BUILD/runtime" --cache "$BUILD/cache"

step "Bokea.exe"
dotnet publish "$HERE/src/Bokea.Desktop" -c Release -o "$BUILD/app" -p:Version="$VERSION" --nologo -v quiet

step "Stage"
mkdir -p "$DIST"
pack stage --app "$BUILD/app" --web "$BUILD/web" --runtime "$BUILD/runtime" \
  --notices "$HERE/THIRD-PARTY-NOTICES.txt" --out "$STAGE"
pack zip --dir "$STAGE" --out "$DIST/Bokea-$VERSION-win-x64.zip"

step "Installer"
if [[ -n "${ISCC:-}" ]]; then
  # shellcheck disable=SC2086 # ISCC may be "wine /path/ISCC.exe"
  (cd "$HERE/installer" && $ISCC /Q "/DAppVersion=$VERSION" Bokea.iss)
  echo "dist/Bokea-Setup-$VERSION.exe"
else
  echo "Skipped: set ISCC to Inno Setup's ISCC.exe (through Wine on Linux) to build the installer."
fi

step "Done"
ls -la "$DIST"
