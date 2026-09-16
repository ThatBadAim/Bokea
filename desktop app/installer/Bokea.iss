; Bokeà for Windows - installer
;
; Built by build.sh / build.ps1 with Inno Setup 6. Installs for the current
; user only, so no administrator prompt. The user's tasks and settings live in
; %LOCALAPPDATA%\Bokea and are left alone by both upgrades and uninstalling.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define AppName "Bokeà"
#define SourceDir "..\dist\Bokea-win-x64"

[Setup]
AppId={{6C1F0B7E-3D2A-4E8B-9F5C-2A7D1E0B4C93}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppName}
VersionInfoVersion={#AppVersion}
VersionInfoProductName={#AppName}
DefaultDirName={autopf}\Bokea
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir=..\dist
OutputBaseFilename=Bokea-Setup-{#AppVersion}
SetupIconFile=..\src\Bokea.Desktop\Assets\icon.ico
UninstallDisplayIcon={app}\Bokea.exe
UninstallDisplayName={#AppName}
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[InstallDelete]
; An upgrade replaces the engine and the web files wholesale, so nothing from
; an older version is left behind to be loaded by mistake.
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\web"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\Bokea.exe"; AppUserModelID: "Bokea.Desktop"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\Bokea.exe"; AppUserModelID: "Bokea.Desktop"; Tasks: desktopicon

[Run]
Filename: "{app}\Bokea.exe"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
