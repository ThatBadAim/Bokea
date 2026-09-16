#!/usr/bin/env bash
# Builds Bokeà for Android.
#
#   ./build.sh            the web app, the Android project, and a debug APK
#   ./build.sh release    an unsigned release APK instead
#   ./build.sh sync       stop after the web app and the native project
#
# Produces, in dist/:
#   Bokea-<version>-debug.apk     installable with: adb install -r <file>
#   Bokea-<version>-release-unsigned.apk
#
# Needs:
#   Node 20 or newer                           always
#   a JDK (21 is what Android Gradle wants)    for the APK
#   the Android SDK, with ANDROID_HOME set     for the APK
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
  debug|release|sync) ;;
  *) fail "Unknown target '$TARGET'. Use debug, release, or sync." ;;
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
(cd "$HERE" && npx cap sync android)

if [[ "$TARGET" == "sync" ]]; then
  step "Done"
  echo "android/ is up to date."
  echo "Open it with: npm run open"
  exit 0
fi

step "Toolchain"
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
    cp "$HERE/android/app/build/outputs/apk/release/app-release-unsigned.apk" \
       "$DIST/Bokea-$VERSION-release-unsigned.apk"
    ;;
esac

step "Done"
ls -la "$DIST"
