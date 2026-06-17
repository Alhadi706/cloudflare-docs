$ErrorActionPreference = 'Stop'

Set-Location "$PSScriptRoot/.."

flutter --version
flutter pub get
flutter build windows --release --dart-define=DSF_API_BASE_URL=https://dev.d-me.ly

$bundle = "build/windows/x64/runner/Release"
if (!(Test-Path $bundle)) {
  throw "Windows release bundle not found: $bundle"
}

New-Item -Path dist -ItemType Directory -Force | Out-Null
$zip = "dist/dsf_gateway_flutter-windows-x64.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$bundle/*" -DestinationPath $zip

Write-Host "Built: $zip"
Get-Item $zip | Format-List FullName,Length,LastWriteTime

# Create start script inside the ZIP for convenience
$scriptContent = @'
@echo off
REM DSF Gateway Flutter - Windows Launcher
REM Extract this ZIP, then double-click this file to run the app

cd /d "%~dp0"
start "" dsf_gateway_flutter.exe
'@

$launchBat = Join-Path $bundle 'START_DSF_GATEWAY.bat'
$scriptContent | Out-File -Encoding ASCII -FilePath $launchBat

# Re-zip with launcher
Compress-Archive -Path "$bundle/*" -DestinationPath $zip -Force

Write-Host "✓ Release ready with launcher script"

