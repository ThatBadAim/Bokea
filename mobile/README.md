# Bokeà Mobile Apps

This directory contains the mobile applications for Bokeà, split into two completely standalone projects:

## 1. Android (`mobile/android/`)
Self-contained Android Capacitor project:
* To sync web changes: `cd mobile/android && npm run sync`
* To build debug APK: `cd mobile/android && ./build.sh` (or `npm run build:debug`)
* To open in Android Studio: `cd mobile/android && npm run open`

## 2. iOS (`mobile/ios/`)
Self-contained iOS Capacitor & Xcode project:
* To sync web changes: `cd mobile/ios && npm run sync`
* To build archive: `cd mobile/ios && ./build.sh`
* To open in Xcode: `cd mobile/ios && npm run open`

Both projects can be moved or copied independently without dependencies on each other.
