const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BROWSERS = {
    chrome: { name: 'Google Chrome' },
    edge: { name: 'Microsoft Edge' },
    safari: { name: 'Safari' },
};

// ========== CHROME ==========

function findChromeWindows() {
    const possiblePaths = [
        process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) {
            return { path: p, browser: 'chrome' };
        }
    }

    try {
        const result = execSync('where chrome', { encoding: 'utf8' }).trim().split('\n')[0];
        if (result && fs.existsSync(result.trim())) {
            return { path: result.trim(), browser: 'chrome' };
        }
    } catch (_) {}

    return null;
}

function findChromeMacOS() {
    const possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return { path: p, browser: 'chrome' };
        }
    }

    return null;
}

function findChromeLinux() {
    const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/opt/google/chrome/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return { path: p, browser: 'chrome' };
        }
    }

    try {
        const result = execSync('which google-chrome || which chromium-browser || which chromium', { encoding: 'utf8' }).trim().split('\n')[0];
        if (result) {
            return { path: result, browser: 'chrome' };
        }
    } catch (_) {}

    return null;
}

function findChrome() {
    const platform = process.platform;
    if (platform === 'win32') return findChromeWindows();
    if (platform === 'darwin') return findChromeMacOS();
    return findChromeLinux();
}

// ========== EDGE (Windows + macOS) ==========

function findEdgeWindows() {
    const possiblePaths = [
        process.env['PROGRAMFILES(X86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env['PROGRAMFILES'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env['LOCALAPPDATA'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    ];

    for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) {
            return { path: p, browser: 'edge' };
        }
    }

    try {
        const result = execSync('where msedge', { encoding: 'utf8' }).trim().split('\n')[0];
        if (result && fs.existsSync(result.trim())) {
            return { path: result.trim(), browser: 'edge' };
        }
    } catch (_) {}

    return null;
}

function findEdgeMacOS() {
    const possiblePaths = [
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        path.join(os.homedir(), 'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return { path: p, browser: 'edge' };
        }
    }

    return null;
}

function findEdge() {
    const platform = process.platform;
    if (platform === 'win32') return findEdgeWindows();
    if (platform === 'darwin') return findEdgeMacOS();
    return null;
}

// ========== SAFARI (macOS only) ==========

function findSafari() {
    if (process.platform !== 'darwin') return null;

    const possiblePaths = [
        '/Applications/Safari.app/Contents/MacOS/Safari',
        path.join(os.homedir(), 'Applications/Safari.app/Contents/MacOS/Safari'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return { path: p, browser: 'safari' };
        }
    }

    return null;
}

// ========== BROWSER DETECTION (Priority) ==========

function findAvailableBrowsers() {
    const platform = process.platform;
    const found = [];

    const chrome = findChrome();
    if (chrome) found.push(chrome);

    if (platform === 'win32') {
        const edge = findEdge();
        if (edge) found.push(edge);
    }

    if (platform === 'darwin') {
        const safari = findSafari();
        if (safari) found.push(safari);
    }

    return found;
}

function findPreferredBrowser() {
    const platform = process.platform;

    // Ưu tiên Chrome trên mọi nền tảng
    const chrome = findChrome();
    if (chrome) return chrome;

    // Fallback: browser mặc định của OS
    if (platform === 'win32') {
        const edge = findEdge();
        if (edge) return edge;
    }

    if (platform === 'darwin') {
        const safari = findSafari();
        if (safari) return safari;
    }

    return null;
}

// ========== LAUNCH COMMANDS ==========

function buildLaunchCommand(browserInfo, extensionId, filePath) {
    const targetUrl = `chrome-extension://${extensionId}/src/pages/trigger.html?file=${encodeURIComponent(filePath)}`;
    const platform = process.platform;

    if (browserInfo.browser === 'chrome') {
        if (platform === 'darwin' && !fs.existsSync(browserInfo.path)) {
            return `open -a "Google Chrome" "${targetUrl}"`;
        }
        return `"${browserInfo.path}" "${targetUrl}"`;
    }

    if (browserInfo.browser === 'edge') {
        if (platform === 'darwin' && !fs.existsSync(browserInfo.path)) {
            return `open -a "Microsoft Edge" "${targetUrl}"`;
        }
        return `"${browserInfo.path}" "${targetUrl}"`;
    }

    // Safari - cần extension URL riêng (safari-web-extension://),
    // hiện tại dùng open để mở URL tạm thời
    if (browserInfo.browser === 'safari') {
        return `open -a Safari "${targetUrl}"`;
    }

    return null;
}

// ========== OPEN FILE (Main) ==========

function openFile(extensionId, filePath, preferredBrowser) {
    let browserInfo;

    if (preferredBrowser) {
        browserInfo = findBrowserByName(preferredBrowser);
        if (!browserInfo) {
            return Promise.reject(new Error(
                `Không tìm thấy trình duyệt "${BROWSERS[preferredBrowser]?.name || preferredBrowser}". Vui lòng cài đặt và thử lại.`
            ));
        }
    } else {
        browserInfo = findPreferredBrowser();
    }

    if (!browserInfo) {
        const platform = process.platform;
        let message = 'Không tìm thấy trình duyệt nào hỗ trợ.';
        if (platform === 'win32') {
            message = 'Vui lòng cài Google Chrome hoặc Microsoft Edge để sử dụng OfficeX.';
        } else if (platform === 'darwin') {
            message = 'Vui lòng cài Google Chrome để sử dụng OfficeX. Safari chưa được hỗ trợ.';
        } else {
            message = 'Vui lòng cài Google Chrome hoặc Chromium để sử dụng OfficeX.';
        }
        return Promise.reject(new Error(message));
    }

    if (browserInfo.browser === 'safari') {
        return Promise.reject(new Error(
            'Safari chưa được hỗ trợ. Vui lòng cài Google Chrome để sử dụng OfficeX.'
        ));
    }

    const command = buildLaunchCommand(browserInfo, extensionId, filePath);
    if (!command) {
        return Promise.reject(new Error('Không thể tạo lệnh khởi chạy trình duyệt.'));
    }

    console.log(`[Browser] Trình duyệt: ${BROWSERS[browserInfo.browser]?.name || browserInfo.browser}`);
    console.log(`[Browser] Extension ID: ${extensionId}`);
    console.log(`[Browser] URL: ${command}`);

    return new Promise((resolve, reject) => {
        const child = exec(command, { windowsHide: false }, (error, stdout, stderr) => {
            if (error) {
                if (error.code === 1) {
                    console.log("[Browser] Trình duyệt đã mở URL thành công (đang chạy sẵn).");
                    return resolve();
                }
                console.error(`[Browser] Lỗi khi khởi chạy trình duyệt: ${error.message}`);
                return reject(new Error(`Không thể mở trình duyệt: ${error.message}`));
            }
            console.log("[Browser] Đã ra lệnh mở trình duyệt thành công.");
            resolve();
        });
        child.unref();
    });
}

function findBrowserByName(name) {
    switch (name) {
        case 'chrome': return findChrome();
        case 'edge': return findEdge();
        case 'safari': return findSafari();
        default: return null;
    }
}

module.exports = {
    openFile,
    findChrome,
    findEdge,
    findSafari,
    findAvailableBrowsers,
    findPreferredBrowser,
    BROWSERS,
};
