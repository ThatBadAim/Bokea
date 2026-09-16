#!/usr/bin/env bash
# Builds Bokeà for Android and iOS.
#
#   ./build.sh            the web app, the Android project, and a debug APK
#   ./build.sh release    an unsigned release APK instead
#   ./build.sh ios        the web app, the Xcode project, and an archive
#   ./build.sh sync       stop after the web app and both native projects
#
# Produces, in dist/:
#   Bokea-<version>-debug.apk     installable with: adb install -r <file>
#   Bokea-<version>-release-unsigned.apk
#   Bokea.xcarchive               export with Xcode, or with exportArchive
#
# Needs:
#   Node 20 or newer                           always
#   a JDK (21 is what Android Gradle wants)    for the APK
#   the Android SDK, with ANDROID_HOME set     for the APK
#   macOS, Xcode and CocoaPods                 for the iOS archive
#
# Every target except the last of those runs on Linux. `sync` and `ios` both
# build the Xcode project in full - the Swift, the storyboards, the asset
# catalogue, the Info.plist, the Podfile - and only the compile at the end
# needs a Mac. Where there is no Mac, .github/workflows/build-ios.yml does that
# part on a macos-latest runner from the same committed project.
#
# Environment:
#   BOKEA_VERSION   version name stamped on the APK (default 1.0.0)
#   ANDROID_HOME    the Android SDK, if it is not in one of the usual places
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="${BOKEA_VERSION:-1.0.0}"
TARGET="${1:-debug}"
DIST="$HERE/dist"

step() { printf '\n== %s\n' "$*"; }
fail() { printf '\nbuild: %s\n' "$*" >&2; exit 1; }

case "$TARGET" in
  debug|release|sync|ios) ;;
  *) fail "Unknown target '$TARGET'. Use debug, release, ios or sync." ;;
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
# Only the platform being built, so an Android build on a machine with no
# CocoaPods does not print a warning about it, and the other way round.
case "$TARGET" in
  ios)   (cd "$HERE" && npx cap sync ios) ;;
  sync)  (cd "$HERE" && npx cap sync) ;;
  *)     (cd "$HERE" && npx cap sync android) ;;
esac

if [[ "$TARGET" == "sync" ]]; then
  step "Done"
  echo "android/ and ios/ are up to date."
  echo "Open them with: npm run open:android   /   npm run open:ios"
  exit 0
fi

if [[ "$TARGET" == "ios" ]]; then
  step "Toolchain"
  # Xcode is the whole of it: it brings xcodebuild, the SDKs and the simulators,
  # and none of them exist off macOS. CocoaPods is separate and is what turns
  # the Podfile into the workspace xcodebuild is pointed at below.
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
  # No signing: an archive is the last thing that can be made without a
  # developer account, and exporting it to an .ipa is where the team ID and
  # the provisioning profile come in. See README.md, "Signing a release".
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
  exit 0
fi

step "Toolchain"
# The Android SDK, wherever this machine keeps it.
if [[ -z "${ANDROID_HOME:-}" ]]; then
  for candidate in "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" /usr/lib/android-sdk /opt/android-sdk; do
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi

missing=""
[[ -n "${ANDROID_HOME:-}" && -d "${ANDROID_HOME:-}" ]] || missing+="  - the Android SDK. Install Android Studio, or the command line tools, then
    set ANDROID_HOME to it (for example ~/Android/Sdk).
"
if ! command -v java >/dev/null && [[ ! -x "${JAVA_HOME:-}/bin/java" ]]; then
  missing+="  - a JDK. Android Gradle wants 21: install it and set JAVA_HOME, or use
    the one bundled with Android Studio (jbr/ inside the install).
"
fi

if [[ -n "$missing" ]]; then
  printf '\nThe web app and the native project are built and up to date.\n'
  printf 'The APK needs two more things on this machine:\n\n%s\n' "$missing"
  printf 'With both in place, run this again - or open android/ in Android Studio\n'
  printf 'and press Run, which needs neither set up by hand.\n'
  exit 1
fi

echo "ANDROID_HOME=$ANDROID_HOME"
echo "java: $(java -version 2>&1 | head -1)"

step "APK"
mkdir -p "$DIST"
case "$TARGET" in
  debug)
    (cd "$HERE/android" && ./gradlew --no-daemon assembleDebug -PbokeaVersion="$VERSION")
    cp "$HERE/android/app/build/outputs/apk/debug/app-debug.apk" "$DIST/Bokea-$VERSION-debug.apk"
    ;;
  release)
    (cd "$HERE/android" && ./gradlew --no-daemon assembleRelease -PbokeaVersion="$VERSION")
    # Unsigned: signing needs a keystore, which is not something a build script
    # should invent. See README.md, "Signing a release".
    cp "$HERE/android/app/build/outputs/apk/release/app-release-unsigned.apk" \
       "$DIST/Bokea-$VERSION-release-unsigned.apk"
    ;;
esac

step "Done"
ls -la "$DIST"
