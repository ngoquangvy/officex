const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execSync } = require('child_process');
const { loadConfig } = require('./config');
const { findChrome } = require('./browser');

const GOOGLE_OFFICE_EXT_ID = 'gbkeegbaiigmenfmjfclcdgdpimamgkj';
const CHROME_WEBSTORE_UPDATE_URL = 'https://clients2.google.com/service/update2/crx';
const EDGE_WEBSTORE_UPDATE_URL = 'https://edge.microsoft.com/extensionwebstorebase/v1/crx';
const GOOGLE_OFFICE_WEBSTORE_URL = `https://chrome.google.com/webstore/detail/office-editing-for-docs-s/${GOOGLE_OFFICE_EXT_ID}`;

const CHROMIUM_BROWSERS = {
    chrome: {
        name: 'Google Chrome',
        policyKey: 'Software\\Policies\\Google\\Chrome\\ExtensionInstallForcelist',
        extKey: 'Software\\Google\\Chrome\\Extensions',
        updateUrl: CHROME_WEBSTORE_UPDATE_URL,
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

function getExtensionDir() {
    if (process.pkg) {
        const p = path.resolve(path.dirname(process.execPath), '..', '..', 'browser-extension');
        if (fs.existsSync(path.join(p, 'manifest.json'))) return p;
    }
    const p = path.resolve(__dirname, '..', '..', 'browser-extension');
    if (fs.existsSync(path.join(p, 'manifest.json'))) return p;
    return null;
}

function getKeyPath() {
    if (process.pkg) {
        const p = path.resolve(path.dirname(process.execPath), 'extension-key.pem');
        if (fs.existsSync(p)) return p;
    }
    const p = path.resolve(__dirname, '..', 'extension-key.pem');
    if (fs.existsSync(p)) return p;
    return null;
}

function getCrxDir() {
    const d = path.join(os.homedir(), 'Library', 'Application Support', 'OfficeX', 'crx');
    fs.mkdirSync(d, { recursive: true });
    return d;
}

function packExtension(extensionDir, keyPath, extensionId) {
    const chrome = findChrome();
    if (!chrome) {
        console.error('[Installer] ❌ Không tìm thấy Chrome để đóng gói extension.');
        return null;
    }
    const crxDir = getCrxDir();
    const crxOutput = path.join(crxDir, `${extensionId}.crx`);
    if (fs.existsSync(crxOutput)) {
        console.log(`[Installer] ✅ CRX đã tồn tại: ${crxOutput}`);
        return crxOutput;
    }

    const extCopyDir = path.join(crxDir, 'extension-src');
    if (fs.existsSync(extCopyDir)) fs.rmSync(extCopyDir, { recursive: true, force: true });
    fs.cpSync(extensionDir, extCopyDir, { recursive: true });

    const tempProfile = path.join(os.tmpdir(), `officex-pack-${Date.now()}`);
    try {
        execSync(`"${chrome.path}" --pack-extension="${extCopyDir}" --pack-extension-key="${keyPath}" --user-data-dir="${tempProfile}" --no-first-run --no-startup-window`, {
            timeout: 30000,
            stdio: 'pipe'
        });
        const generated = extCopyDir + '.crx';
        if (fs.existsSync(generated)) {
            fs.renameSync(generated, crxOutput);
            if (fs.existsSync(extCopyDir)) fs.rmSync(extCopyDir, { recursive: true, force: true });
            console.log(`[Installer] ✅ Đã tạo CRX: ${crxOutput}`);
            return crxOutput;
        }
    } catch (e) {
        console.error(`[Installer] ⚠️ Lỗi đóng gói CRX: ${e.message}`);
    }
    try { if (fs.existsSync(extCopyDir)) fs.rmSync(extCopyDir, { recursive: true }); } catch (_) {}
    try { if (fs.existsSync(tempProfile)) fs.rmSync(tempProfile, { recursive: true }); } catch (_) {}
    return null;
}

function installExtensionViaJSON(extensionId, browser, crxPath) {
    const platform = process.platform;
    let extDirs = [];
    if (platform === 'darwin') {
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
            const content = JSON.stringify(
                crxPath
                    ? { external_crx: crxPath, external_version: '1.2' }
                    : { external_update_url: browser.updateUrl },
                null, 2
            );
            fs.writeFileSync(jsonPath, content, 'utf8');
            console.log(`[Installer]    ✅ ${browser.name}: ${jsonPath}`);
            installed = true;
        } catch (e) {
            console.log(`[Installer]    ⚠️ ${browser.name}: ${dir} (${e.code || e.message})`);
        }
    }
    return installed;
}

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

function installExtensionAllBrowsers(extensionId, label, slot, crxPath) {
    console.log(`\n[Installer] 📦 Cài đặt ${label}...`);
    const platform = process.platform;
    let anySuccess = false;
    for (const [key, browser] of Object.entries(CHROMIUM_BROWSERS)) {
        if (platform === 'win32') {
            if (installExtensionViaRegistry(extensionId, browser, slot)) {
                anySuccess = true;
            }
        } else {
            if (installExtensionViaJSON(extensionId, browser, crxPath)) {
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

function installGoogleOfficeEditing() {
    return installExtensionAllBrowsers(GOOGLE_OFFICE_EXT_ID, 'Google Office Editing Extension', 1);
}

function installOurExtension() {
    const { extensionId, publishedOnWebStore } = loadConfig();

    if (!publishedOnWebStore) {
        console.log('\n[Installer] 📦 Extension OfficeX (tự động)...');

        const extDir = getExtensionDir();
        if (!extDir) {
            console.log('[Installer] ❌ Không tìm thấy thư mục browser-extension/');
            return false;
        }

        const keyPath = getKeyPath();
        if (!keyPath) {
            console.log('[Installer] ❌ Không tìm thấy extension-key.pem');
            return false;
        }

        console.log(`[Installer] Extension: ${extDir}`);
        console.log(`[Installer] Extension ID: ${extensionId}`);

        let crxPath = null;
        const crxDir = getCrxDir();
        const existingCrx = path.join(crxDir, `${extensionId}.crx`);
        if (fs.existsSync(existingCrx)) {
            crxPath = existingCrx;
            console.log(`[Installer] ✅ CRX đã tồn tại: ${crxPath}`);
        } else {
            crxPath = packExtension(extDir, keyPath, extensionId);
        }

        if (crxPath && fs.existsSync(crxPath)) {
            console.log(`[Installer] Đang cài đặt CRX qua External Extensions...`);
            const platform = process.platform;
            let anySuccess = false;

            for (const [key, browser] of Object.entries(CHROMIUM_BROWSERS)) {
                if (platform === 'win32') {
                    if (installExtensionViaRegistry(extensionId, browser, 2)) anySuccess = true;
                } else {
                    if (installExtensionViaJSON(extensionId, browser, crxPath)) anySuccess = true;
                }
            }

            if (anySuccess) {
                console.log('');
                console.log('[Installer] ✅ Extension OfficeX đã được cài đặt tự động!');
                console.log('[Installer]    Vui lòng khởi động lại Chrome để kích hoạt.');
                return true;
            }
        }

        console.log('[Installer] ⚠️  Không thể cài tự động. Vui lòng làm thủ công:');
        console.log('[Installer]    1. Mở chrome://extensions/');
        console.log('[Installer]    2. Bật "Developer mode"');
        console.log('[Installer]    3. Chọn "Load unpacked"');
        console.log(`[Installer]    4. Chọn thư mục: ${extDir}`);
        console.log('[Installer]    5. Vào chrome://extensions/ ?id=' + extensionId);
        console.log('[Installer]    6. Bật "Allow access to file URLs"');
        return false;
    }

    return installExtensionAllBrowsers(extensionId, 'OfficeX Extension', 2);
}

function runFullSetup() {
    const platform = process.platform;
    const platformNames = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
    const platformName = platformNames[platform] || platform;

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log(`║     🚀 OfficeX — Cài đặt (${platformName})`.padEnd(51) + '║');
    console.log('╚══════════════════════════════════════════════════╝');

    installGoogleOfficeEditing();
    installOurExtension();

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
