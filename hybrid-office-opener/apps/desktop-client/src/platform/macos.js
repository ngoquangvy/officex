// platform/macos.js — Logic cài đặt dành riêng cho macOS.
// Tạo Application Bundle (.app) và đăng ký Launch Services.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const APP_NAME = 'OfficeX';
const BUNDLE_ID = 'com.officex.app';

// Danh sách UTI (Uniform Type Identifier) chính xác cho từng định dạng Office
const DOCUMENT_TYPES = [
    { ext: 'doc',  name: 'Word Document (Legacy)',  uti: 'com.microsoft.word.doc' },
    { ext: 'docx', name: 'Word Document',           uti: 'org.openxmlformats.wordprocessingml.document' },
    { ext: 'xls',  name: 'Excel Spreadsheet (Legacy)', uti: 'com.microsoft.excel.xls' },
    { ext: 'xlsx', name: 'Excel Spreadsheet',       uti: 'org.openxmlformats.spreadsheetml.sheet' },
    { ext: 'ppt',  name: 'PowerPoint (Legacy)',     uti: 'com.microsoft.powerpoint.ppt' },
    { ext: 'pptx', name: 'PowerPoint',              uti: 'org.openxmlformats.presentationml.presentation' },
    { ext: 'csv',  name: 'CSV File',                uti: 'public.comma-separated-values-text' },
];

/**
 * Tạo nội dung Info.plist với CFBundleDocumentTypes cho tất cả định dạng Office.
 */
function generateInfoPlist(launcherPath) {
    const documentTypesXml = DOCUMENT_TYPES.map(dt => `
        <dict>
            <key>CFBundleTypeExtensions</key>
            <array>
                <string>${dt.ext}</string>
            </array>
            <key>CFBundleTypeName</key>
            <string>${dt.name}</string>
            <key>CFBundleTypeRole</key>
            <string>Viewer</string>
            <key>LSHandlerRank</key>
            <string>Alternate</string>
            <key>LSItemContentTypes</key>
            <array>
                <string>${dt.uti}</string>
            </array>
        </dict>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleDocumentTypes</key>
    <array>
${documentTypesXml}
    </array>
</dict>
</plist>`;
}

/**
 * Tạo shell script thực thi bên trong .app bundle.
 * Script này sẽ được macOS gọi khi double-click file.
 */
function generateExecutableScript(launcherPath) {
    return `#!/bin/bash
# OfficeX Launcher — macOS App Bundle Executable
# Tìm đường dẫn node
NODE_BIN=$(which node 2>/dev/null)
if [ -z "$NODE_BIN" ]; then
    # Thử các đường dẫn phổ biến trên macOS
    for p in /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node/*/bin/node"; do
        if [ -x "$p" ]; then
            NODE_BIN="$p"
            break
        fi
    done
fi

if [ -z "$NODE_BIN" ]; then
    osascript -e 'display dialog "OfficeX cần Node.js để chạy.\\nVui lòng cài đặt Node.js từ https://nodejs.org" with title "OfficeX" buttons {"OK"} default button "OK" with icon stop'
    exit 1
fi

exec "$NODE_BIN" "${launcherPath}" "$@"
`;
}

/**
 * Setup chính cho macOS:
 * 1. Tạo cấu trúc thư mục .app
 * 2. Ghi Info.plist + script thực thi
 * 3. Đăng ký Launch Services
 */
function setupMacOS(launcherPath) {
    console.log('\n[macOS] 🍏 Bắt đầu cài đặt OfficeX cho macOS...');

    // Dùng ~/Applications/ để không cần sudo
    const appDir = path.join(os.homedir(), 'Applications');
    const bundlePath = path.join(appDir, `${APP_NAME}.app`);
    const contentsPath = path.join(bundlePath, 'Contents');
    const macosPath = path.join(contentsPath, 'MacOS');
    const resourcesPath = path.join(contentsPath, 'Resources');

    // 1. Tạo cấu trúc thư mục
    console.log('[macOS] 📁 Đang tạo Application Bundle...');
    fs.mkdirSync(macosPath, { recursive: true });
    fs.mkdirSync(resourcesPath, { recursive: true });

    // Sao chép logo vào Resources
    try {
        const clientPngPath = path.resolve(__dirname, '..', 'assets', 'icon.png');
        if (fs.existsSync(clientPngPath)) {
            fs.copyFileSync(clientPngPath, path.join(resourcesPath, 'icon.png'));
            console.log('[macOS] ✅ Đã chèn logo thương hiệu vào App Resources');
        }
    } catch (_) {}

    // 2. Ghi Info.plist
    const plistContent = generateInfoPlist(launcherPath);
    fs.writeFileSync(path.join(contentsPath, 'Info.plist'), plistContent, 'utf8');
    console.log('[macOS] ✅ Đã tạo Info.plist');

    // 3. Ghi file thực thi
    const executablePath = path.join(macosPath, APP_NAME);
    const scriptContent = generateExecutableScript(launcherPath);
    fs.writeFileSync(executablePath, scriptContent, { encoding: 'utf8', mode: 0o755 });
    console.log('[macOS] ✅ Đã tạo file thực thi');

    // 4. Đăng ký Launch Services
    console.log('[macOS] 🔄 Đăng ký Launch Services...');
    try {
        const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
        execSync(`"${lsregister}" -f "${bundlePath}"`, { stdio: 'pipe' });
        console.log('[macOS] ✅ Launch Services đã nhận diện OfficeX!');
    } catch (e) {
        console.warn('[macOS] ⚠️ Không gọi được lsregister:', e.message);
        // Fallback: touch để macOS quét lại
        try { execSync(`touch "${bundlePath}"`); } catch (_) {}
    }

    // 5. Hướng dẫn người dùng
    console.log('');
    console.log(`[macOS] ✅ Đã cài đặt thành công tại: ${bundlePath}`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  📌 HƯỚNG DẪN (Làm 1 lần duy nhất):             ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  1. Click chuột phải vào file .docx bất kỳ     ║');
    console.log('║  2. Chọn "Open With" → "Other..."              ║');
    console.log('║  3. Tìm và chọn "OfficeX" trong ~/Applications ║');
    console.log('║  4. Tích ✅ "Always Open With"                   ║');
    console.log('║                                                  ║');
    console.log('║  5. Mở Chrome → chrome://extensions/            ║');
    console.log('║  6. BẬT "Allow access to file URLs" cho:       ║');
    console.log('║     • Office Editing for Docs, Sheets...        ║');
    console.log('║     • OfficeX                                   ║');
    console.log('╚══════════════════════════════════════════════════╝');

    // Thử hiện dialog hướng dẫn bằng osascript
    try {
        execSync(`osascript -e 'display dialog "OfficeX đã cài đặt thành công!\\n\\nĐể đặt mặc định:\\n1. Click chuột phải file .docx\\n2. Open With → Other → chọn OfficeX\\n3. Tích Always Open With" with title "OfficeX" buttons {"OK"} default button "OK"'`, { stdio: 'pipe' });
    } catch (_) {
        // osascript có thể fail nếu chạy qua SSH
    }
}

function uninstallMacOS(launcherPath) {
    console.log('\n[macOS] 🗑️ Bắt đầu gỡ cài đặt OfficeX cho macOS...');

    const appDir = path.join(os.homedir(), 'Applications');
    const bundlePath = path.join(appDir, `${APP_NAME}.app`);

    // 1. Huỷ đăng ký Launch Services
    console.log('[macOS] 🔄 Huỷ đăng ký Launch Services...');
    try {
        const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
        execSync(`"${lsregister}" -u "${bundlePath}"`, { stdio: 'pipe' });
        console.log('[macOS] ✅ Đã huỷ đăng ký Launch Services!');
    } catch (_) {}

    // 2. Xoá Application Bundle (.app)
    try {
        if (fs.existsSync(bundlePath)) {
            fs.rmSync(bundlePath, { recursive: true, force: true });
            console.log('[macOS] 🗑️ Đã xoá OfficeX.app');
        }
    } catch (e) {
        console.error('[macOS] ❌ Không thể xoá OfficeX.app:', e.message);
    }

    // 3. Xoá các JSON file tự cài Extension trong Chrome, Edge, Brave
    const GOOGLE_OFFICE_EXT_ID = 'gbkeegbaiigmenfmjfclcdgdpimamgkj';
    const macBrowserDirs = [
        'Library/Application Support/Google/Chrome/External Extensions',
        'Library/Application Support/Microsoft Edge/External Extensions',
        'Library/Application Support/BraveSoftware/Brave-Browser/External Extensions'
    ];

    let extId = '';
    try {
        extId = require('../config').loadConfig().extensionId;
    } catch (_) {}

    for (const bDir of macBrowserDirs) {
        const fullDir = path.join(os.homedir(), bDir);
        // Xoá Google Office Editing json
        try {
            const googleJson = path.join(fullDir, `${GOOGLE_OFFICE_EXT_ID}.json`);
            if (fs.existsSync(googleJson)) {
                fs.unlinkSync(googleJson);
            }
        } catch (_) {}

        // Xoá OfficeX extension json
        if (extId) {
            try {
                const officexJson = path.join(fullDir, `${extId}.json`);
                if (fs.existsSync(officexJson)) {
                    fs.unlinkSync(officexJson);
                }
            } catch (_) {}
        }
    }

    console.log('[macOS] 🎉 Đã gỡ bỏ hoàn toàn OfficeX khỏi macOS!');
}

module.exports = { setupMacOS, uninstallMacOS };
