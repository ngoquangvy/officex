// installer.js — Module cài đặt tự động (Platform Dispatcher).
// Tự động nhận diện OS và phân phối sang module platform tương ứng.
// Hỗ trợ tự cài extension lên Chrome, Edge, Brave trên mọi nền tảng.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { loadConfig } = require('./config');
const { findChrome } = require('./browser');

// ========== CẤU HÌNH CHUNG ==========
const GOOGLE_OFFICE_EXT_ID = 'gbkeegbaiigmenfmjfclcdgdpimamgkj';
const CHROME_WEBSTORE_UPDATE_URL = 'https://clients2.google.com/service/update2/crx';
const EDGE_WEBSTORE_UPDATE_URL = 'https://edge.microsoft.com/extensionwebstorebase/v1/crx';
const GOOGLE_OFFICE_WEBSTORE_URL = `https://chrome.google.com/webstore/detail/office-editing-for-docs-s/${GOOGLE_OFFICE_EXT_ID}`;

// Cấu hình trình duyệt Chromium hỗ trợ (Windows Registry paths)
const CHROMIUM_BROWSERS = {
    chrome: {
        name: 'Google Chrome',
        policyKey: 'Software\\Policies\\Google\\Chrome\\ExtensionInstallForcelist',
        extKey: 'Software\\Google\\Chrome\\Extensions',
        updateUrl: CHROME_WEBSTORE_UPDATE_URL,
        // macOS/Linux External Extensions paths
        macExtDir: '/Library/Application Support/Google/Chrome/External Extensions',
        linuxExtDir: '/opt/google/chrome/extensions',
    },
    edge: {
        name: 'Microsoft Edge',
        policyKey: 'Software\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist',
        extKey: 'Software\\Microsoft\\Edge\\Extensions',
        updateUrl: EDGE_WEBSTORE_UPDATE_URL,
        macExtDir: '/Library/Application Support/Microsoft Edge/External Extensions',
        linuxExtDir: '/opt/microsoft/msedge/extensions',
    },
    brave: {
        name: 'Brave Browser',
        policyKey: 'Software\\Policies\\BraveSoftware\\Brave\\ExtensionInstallForcelist',
        extKey: 'Software\\BraveSoftware\\Brave\\Extensions',
        updateUrl: CHROME_WEBSTORE_UPDATE_URL,
        macExtDir: '/Library/Application Support/BraveSoftware/Brave-Browser/External Extensions',
        linuxExtDir: '/opt/brave.com/brave/extensions',
    },
};

// ========== CÀI ĐẶT EXTENSION ĐA TRÌNH DUYỆT ==========

/**
 * Cài extension bằng JSON Preference File (macOS/Linux).
 * Đặt file <extension_id>.json vào thư mục External Extensions của trình duyệt.
 */
function installExtensionViaJSON(extensionId, browser) {
    const platform = process.platform;
    let extDirs = [];

    if (platform === 'darwin') {
        // macOS: System-wide + Per-user
        extDirs = [
            browser.macExtDir,
            path.join(os.homedir(), browser.macExtDir.replace(/^\/Library/, 'Library')),
        ];
    } else if (platform === 'linux') {
        extDirs = [browser.linuxExtDir];
    }

    let installed = false;
    for (const dir of extDirs) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            const jsonPath = path.join(dir, `${extensionId}.json`);
            const content = JSON.stringify({
                external_update_url: browser.updateUrl
            }, null, 2);
            fs.writeFileSync(jsonPath, content, 'utf8');
            console.log(`[Installer]    ✅ ${browser.name}: ${jsonPath}`);
            installed = true;
        } catch (e) {
            // Có thể cần sudo cho thư mục system-wide, bỏ qua lỗi
            console.log(`[Installer]    ⚠️ ${browser.name}: ${dir} (${e.code || e.message})`);
        }
    }
    return installed;
}

/**
 * Cài extension bằng Windows Registry.
 * Hỗ trợ cả HKCU (không cần admin) và HKLM.
 */
function installExtensionViaRegistry(extensionId, browser, slot) {
    try {
        const { setRegistryValue } = require('./registry');
        const value = `${extensionId};${browser.updateUrl}`;
        const policyKey = `HKCU\\${browser.policyKey}`;
        const success = setRegistryValue(policyKey, String(slot), value);
        if (success) {
            console.log(`[Installer]    ✅ ${browser.name}: Policy đã ghi`);
            return true;
        }
    } catch (_) {}

    // Fallback: Dùng External Extensions Registry key
    try {
        const { setRegistryValue } = require('./registry');
        const extKey = `HKCU\\${browser.extKey}\\${extensionId}`;
        const success = setRegistryValue(extKey, 'update_url', browser.updateUrl);
        if (success) {
            console.log(`[Installer]    ✅ ${browser.name}: External Extension key đã ghi`);
            return true;
        }
    } catch (_) {}

    return false;
}

/**
 * Cài một extension lên TẤT CẢ các trình duyệt Chromium có sẵn.
 */
function installExtensionAllBrowsers(extensionId, label, slot) {
    console.log(`\n[Installer] 📦 Cài đặt ${label}...`);
    const platform = process.platform;
    let anySuccess = false;

    for (const [key, browser] of Object.entries(CHROMIUM_BROWSERS)) {
        if (platform === 'win32') {
            if (installExtensionViaRegistry(extensionId, browser, slot)) {
                anySuccess = true;
            }
        } else {
            if (installExtensionViaJSON(extensionId, browser)) {
                anySuccess = true;
            }
        }
    }

    if (!anySuccess) {
        console.log(`[Installer] ⚠️  Không cài tự động được. Đang mở Chrome Web Store...`);
        const chrome = findChrome();
        if (chrome) {
            exec(`"${chrome.path}" "${GOOGLE_OFFICE_WEBSTORE_URL}"`);
        } else if (process.platform === 'darwin') {
            exec(`open -a "Google Chrome" "${GOOGLE_OFFICE_WEBSTORE_URL}"`);
        }
    }

    return anySuccess;
}

// ========== WRAPPER FUNCTIONS ==========

function installGoogleOfficeEditing() {
    return installExtensionAllBrowsers(
        GOOGLE_OFFICE_EXT_ID,
        'Google Office Editing Extension',
        1
    );
}

function installOurExtension() {
    const { extensionId, publishedOnWebStore } = loadConfig();
    if (!publishedOnWebStore) {
        console.log('\n[Installer] 📦 Extension OfficeX:');
        console.log('[Installer]    Chưa publish lên Chrome Web Store.');
        console.log('[Installer]    → Load Unpacked trong chrome://extensions/');
        console.log(`[Installer]    → Thư mục: ${path.resolve(__dirname, '..', '..', 'browser-extension')}`);
        return false;
    }

    return installExtensionAllBrowsers(extensionId, 'OfficeX Extension', 2);
}

// ========== SETUP TỔNG (Platform Dispatcher) ==========

function runFullSetup() {
    const platform = process.platform;
    const platformNames = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
    const platformName = platformNames[platform] || platform;

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log(`║     🚀 OfficeX — Cài đặt (${platformName})`.padEnd(51) + '║');
    console.log('╚══════════════════════════════════════════════════╝');

    // Bước 1: Cài extensions lên TẤT CẢ trình duyệt Chromium
    installGoogleOfficeEditing();
    installOurExtension();

    // Bước 2: Đăng ký file associations (theo từng OS)
    // Khi chạy từ pkg, dùng chính exe làm launcher
    const launcherPath = process.pkg ? process.execPath : path.resolve(__dirname, 'index.js');

    if (platform === 'win32') {
        const { setupWindows } = require('./platform/windows');
        setupWindows(launcherPath);
    } else if (platform === 'darwin') {
        const { setupMacOS } = require('./platform/macos');
        setupMacOS(launcherPath);
    } else if (platform === 'linux') {
        const { setupLinux } = require('./platform/linux');
        setupLinux(launcherPath);
    } else {
        console.error(`[Installer] ❌ Hệ điều hành "${platform}" chưa được hỗ trợ.`);
        return;
    }

    console.log('');
    console.log('[Installer] 🎉 Cài đặt hoàn tất!');
}

function runFullUninstall() {
    const platform = process.platform;
    const platformNames = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
    const platformName = platformNames[platform] || platform;

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log(`║     🗑️  OfficeX — Gỡ cài đặt (${platformName})`.padEnd(51) + '║');
    console.log('╚══════════════════════════════════════════════════╝');

    const launcherPath = path.resolve(__dirname, 'index.js');

    if (platform === 'win32') {
        const { uninstallWindows } = require('./platform/windows');
        uninstallWindows(launcherPath);
    } else if (platform === 'darwin') {
        const { uninstallMacOS } = require('./platform/macos');
        uninstallMacOS(launcherPath);
    } else if (platform === 'linux') {
        const { uninstallLinux } = require('./platform/linux');
        uninstallLinux(launcherPath);
    } else {
        console.error(`[Installer] ❌ Hệ điều hành "${platform}" chưa được hỗ trợ.`);
    }
}

module.exports = {
    installGoogleOfficeEditing,
    installOurExtension,
    runFullSetup,
    runFullUninstall
};
