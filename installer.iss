[Setup]
AppName=Artyplexer
AppVersion=0.1.0
AppPublisher=Artyplexer
DefaultDirName={autopf}\Artyplexer
DefaultGroupName=Artyplexer
UninstallDisplayIcon={app}\artyplexer.exe
OutputDir=dist
OutputBaseFilename=Artyplexer-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\artyplexer\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Artyplexer"; Filename: "{app}\artyplexer.exe"
Name: "{autodesktop}\Artyplexer"; Filename: "{app}\artyplexer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\artyplexer.exe"; Description: "{cm:LaunchProgram,Artyplexer}"; Flags: nowait postinstall skipifsilent
