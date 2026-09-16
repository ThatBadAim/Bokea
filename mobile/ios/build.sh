#!/usr/bin/env bash
# Builds Bokeà for iOS.
#
#   ./build.sh            the web app, the Xcode project, and an archive
#   ./build.sh sync       stop after the web app and the Xcode project
#
# Produces, in dist/:
#   Bokea.xcarchive       export with Xcode, or with exportArchive
#
# Needs:
#   Node 20 or newer                           always
#   macOS, Xcode and CocoaPods                 for the iOS archive
#
# Environment:
#   BOKEA_VERSION   version name stamped on the build (default 1.0.0)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="${BOKEA_VERSION:-1.0.0}"
TARGET="${1:-ios}"
DIST="$HERE/dist"

step() { printf '\n== %s\n' "$*"; }
fail() { printf '\nbuild: %s\n' "$*" >&2; exit 1; }

case "$TARGET" in
  ios|sync) ;;
  *) fail "Unknown target '$TARGET'. Use ios or sync." ;;
esac

command -v node >/dev/null || fail "Node is not installed. https://nodejs.org"

step "Dependencies"
if [[ ! -d "$HERE/node_modules" ]]; then
  (cd "$HERE" && npm install)
else
  echo "node_modules is present"
fi

step "Web app"
(cd "$HERE" && npm run --silent sync:web)

step "Native project"
(cd "$HERE" && npx cap sync ios)

if [[ "$TARGET" == "sync" ]]; then
  step "Done"
  echo "ios/ is up to date."
  echo "Open it with: npm run open"
  exit 0
fi

step "Toolchain"
missing=""
command -v xcodebuild >/dev/null || missing+="  - Xcode, which is macOS only. Install it from the App Store, then
    run: sudo xcode-select --switch /Applications/Xcode.app
"
command -v pod >/dev/null || missing+="  - CocoaPods. Install it with: sudo gem install cocoapods
"

if [[ -n "$missing" ]]; then
  printf '\nThe web app and the Xcode project are built and up to date.\n'
  printf 'ios/ is complete and ready to open; the archive needs two more\n'
  printf 'things, and neither of them runs on this machine:\n\n%s\n' "$missing"
  printf 'On a Mac, run this again. Without one, push the branch and let\n'
  printf '.github/workflows/build-ios.yml archive it on a macos-latest runner -\n'
  printf 'it builds this same committed project, so nothing here has to change.\n'
  exit 1
fi

echo "xcodebuild: $(xcodebuild -version | head -1)"
echo "cocoapods:  $(pod --version)"

step "Pods"
(cd "$HERE/ios/App" && pod install)

step "Archive"
mkdir -p "$DIST"
(cd "$HERE/ios/App" && xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath "$DIST/Bokea.xcarchive" \
  MARKETING_VERSION="$VERSION" \
  CODE_SIGNING_ALLOWED=NO \
  archive)

step "Done"
ls -la "$DIST"
