& "$env:APPDATA\npm\pkg.cmd" src/index.js --targets node18-win-x64 --output dist/OfficeX.exe --public --compress GZip

Copy-Item "config.json" "dist\"
Copy-Item "src\assets\icon.ico" "dist\"
Copy-Item "setup-gui.ps1" "dist\"
Copy-Item "uninstall.bat" "dist\"
Copy-Item "setup.bat" "dist\"

Write-Output "Build complete! Files in dist/:"
Get-ChildItem dist | Select-Object Name, Length
