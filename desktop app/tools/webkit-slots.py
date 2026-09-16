#!/usr/bin/env python3
"""Prints the WebKit C API client slot numbers used by src/Bokea.Desktop/Native/WebKit.cs.

The host fills WebKit's client structs by hand, one function pointer per slot,
so the slot numbers must match the engine's headers exactly. Run this after
changing the engine revision in tools/Packager/Program.cs and copy any changed
numbers into WebKit.cs.

    python3 tools/webkit-slots.py [webkit-commit]

The commit is Playwright's BASE_REVISION for the build, from
https://github.com/microsoft/playwright/blob/main/browser_patches/webkit/UPSTREAM_CONFIG.sh
"""
import re
import sys
import urllib.request

COMMIT = sys.argv[1] if len(sys.argv) > 1 else "56453fdfe0b0ca6258c23e6453b34f70b885d13f"
RAW = f"https://raw.githubusercontent.com/WebKit/WebKit/{COMMIT}/Source/WebKit/UIProcess/API/C/"
PLAYWRIGHT_PATCH = "https://raw.githubusercontent.com/microsoft/playwright/main/browser_patches/webkit/patches/bootstrap.diff"

# (header, struct, fields the host uses)
STRUCTS = [
    ("WKPageUIClient.h", "WKPageUIClientV14", [
        "close", "focus", "didNotHandleKeyEvent", "runOpenPanel", "decidePolicyForNotificationPermissionRequest",
        "createNewPage", "runJavaScriptAlert", "runJavaScriptConfirm", "runJavaScriptPrompt", "runBeforeUnloadConfirmPanel"]),
    ("WKPageNavigationClient.h", "WKPageNavigationClientV3", [
        "decidePolicyForNavigationAction", "decidePolicyForNavigationResponse", "didFinishNavigation",
        "renderingProgressDidChange", "webProcessDidTerminate", "navigationActionDidBecomeDownload",
        "navigationResponseDidBecomeDownload"]),
    ("WKPageStateClient.h", "WKPageStateClientV0", ["didChangeTitle"]),
    ("WKNotificationProvider.h", "WKNotificationProviderV0", ["show", "cancel", "notificationPermissions", "clearNotifications"]),
    ("WKDownloadClient.h", "WKDownloadClientV0", ["decideDestinationWithResponse", "didFinish", "didFailWithError"]),
]


def fetch(url):
    with urllib.request.urlopen(url) as response:
        return response.read().decode("utf-8")


def fields(source, struct):
    match = re.search(r"typedef struct " + struct + r" \{(.*?)\} " + struct + ";", source, re.S)
    if not match:
        raise SystemExit(f"{struct} not found")
    names = []
    for line in match.group(1).splitlines():
        line = line.split("//")[0].strip()
        found = re.match(r"(.+?)\s+(\w+);$", line)
        if found and found.group(2) != "base":
            names.append(found.group(2))
    return names


def main():
    patch = fetch(PLAYWRIGHT_PATCH)
    # Playwright's build adds one callback to the UI client, straight after
    # runWebAuthenticationPanel, which moves every later slot along by one.
    adds_dialog_callback = "WKPageHandleJavaScriptDialogCallback" in patch

    for header, struct, used in STRUCTS:
        names = fields(fetch(RAW + header), struct)
        if struct.startswith("WKPageUIClient") and adds_dialog_callback:
            names.insert(names.index("runWebAuthenticationPanel") + 1, "handleJavaScriptDialog")
        print(f"{struct}: SlotCount = {len(names)}")
        for name in used:
            print(f"    {name[0].upper() + name[1:]} = {names.index(name)};")


if __name__ == "__main__":
    main()
