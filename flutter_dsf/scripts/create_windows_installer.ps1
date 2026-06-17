# Create professional Windows installer for DSF Gateway Flutter
# Uses Inno Setup (if available) or creates a wrapper ZIP with shortcuts

$ErrorActionPreference = 'Stop'

$baseDir = "$PSScriptRoot/.."
$releaseDir = "$baseDir/build/windows/x64/runner/Release"
$distDir = "$baseDir/dist"

if (!(Test-Path $releaseDir)) {
    Write-Host "❌ Release build not found. Run: flutter build windows --release" -ForegroundColor Red
    exit 1
}

New-Item -Path $distDir -ItemType Directory -Force | Out-Null

# Check if Inno Setup is available
$innoPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (Test-Path $innoPath) {
    Write-Host "✓ Inno Setup found, creating professional installer..." -ForegroundColor Green
    
    # Generate .iss script
    $issContent = @"
; Inno Setup Script for DSF Gateway Flutter
[Setup]
AppName=DSF Gateway
AppVersion=0.1.0
AppPublisher=DSF
AppPublisherURL=https://d-me.ly
DefaultDirName={pf}\DSF Gateway
DefaultGroupName=DSF Gateway
OutputDir=$distDir
OutputBaseFilename=DSF-Gateway-0.1.0-x64
SetupIconFile=$releaseDir\dsf_gateway_flutter.exe
UninstallDisplayIcon={app}\dsf_gateway_flutter.exe
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

[Files]
Source: "$releaseDir\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\DSF Gateway"; Filename: "{app}\dsf_gateway_flutter.exe"
Name: "{commondesktop}\DSF Gateway"; Filename: "{app}\dsf_gateway_flutter.exe"

[Run]
Filename: "{app}\dsf_gateway_flutter.exe"; Description: "Launch DSF Gateway"; Flags: nowait postinstall skipifsilent
"@

    $issPath = "$distDir/dsf_gateway.iss"
    $issContent | Out-File -Encoding ASCII -FilePath $issPath
    
    & $innoPath $issPath
    
    Write-Host "✓ Installer created: DSF-Gateway-0.1.0-x64.exe"
    Get-Item "$distDir/DSF-Gateway-0.1.0-x64.exe" | Format-List FullName,Length
    
} else {
    Write-Host "⚠ Inno Setup not found - creating portable ZIP with launcher" -ForegroundColor Yellow
    
    # Create standalone launcher batch file
    $launchBat = "$releaseDir/START_APP.bat"
    $batContent = @"
@echo off
REM DSF Gateway Launcher
cd /d "%~dp0"
start "" dsf_gateway_flutter.exe
"@
    $batContent | Out-File -Encoding ASCII -FilePath $launchBat
    
    # Create ZIP
    $zip = "$distDir/dsf_gateway_flutter-windows-x64.zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    
    Compress-Archive -Path "$releaseDir/*" -DestinationPath $zip
    Write-Host "✓ Portable app packaged: dsf_gateway_flutter-windows-x64.zip"
    Get-Item $zip | Format-List FullName,Length
}

Write-Host ""
Write-Host "✓ Windows distribution ready!" -ForegroundColor Green
Write-Host "   Next: Upload to public/downloads/ and update download link" -ForegroundColor Cyan
