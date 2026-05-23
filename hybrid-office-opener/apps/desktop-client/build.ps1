param(
    [ValidateSet("win","mac","mac-arm","linux","all")]
    [string]$Target = "win"
)

$PKG = "pkg.cmd"
if (-not (Get-Command $PKG -ErrorAction SilentlyContinue)) {
    $PKG = "npx pkg"
}

switch ($Target) {
    "win"     { & $PKG src/index.js --targets node18-win-x64 --output dist/OfficeX.exe --public --compress GZip }
    "mac"     { & $PKG src/index.js --targets node18-macos-x64 --output dist/OfficeX --public --compress GZip }
    "mac-arm" { & $PKG src/index.js --targets node18-macos-arm64 --output dist/OfficeX --public --compress GZip }
    "linux"   { & $PKG src/index.js --targets node18-linux-x64 --output dist/OfficeX --public --compress GZip }
    "all"     { & $PKG src/index.js --targets node18-win-x64,node18-macos-x64,node18-macos-arm64,node18-linux-x64 --output dist/OfficeX --public --compress GZip }
}

Copy-Item "config.json" "dist\"
Copy-Item "extension-key.pem" "dist\"
Copy-Item "src\assets\icon.ico" "dist\"
Copy-Item "setup-gui.ps1" "dist\"
Copy-Item "uninstall.bat" "dist\"
Copy-Item "setup.bat" "dist\"

Write-Output "Build complete! Files in dist/:"
Get-ChildItem dist | Select-Object Name, Length
