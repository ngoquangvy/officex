// platform/linux.js — Logic cài đặt dành riêng cho Linux.
// Tạo .desktop file và đăng ký xdg-mime.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const APP_NAME = 'OfficeX';
const DESKTOP_FILE_NAME = 'officex.desktop';

// Danh sách MIME types chính xác cho từng định dạng Office
const MIME_TYPES = [
    { ext: '.doc',  mime: 'application/msword',                                                              desc: 'Word Document' },
    { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',          desc: 'Word Document' },
    { ext: '.xls',  mime: 'application/vnd.ms-excel',                                                        desc: 'Excel Spreadsheet' },
    { ext: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',                desc: 'Excel Spreadsheet' },
    { ext: '.ppt',  mime: 'application/vnd.ms-powerpoint',                                                   desc: 'PowerPoint' },
    { ext: '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',       desc: 'PowerPoint' },
    { ext: '.csv',  mime: 'text/csv',                                                                        desc: 'CSV File' },
];

/**
 * Tạo nội dung file .desktop theo chuẩn XDG Freedesktop.
 */
function generateDesktopEntry(launcherPath) {
    // Tìm đường dẫn tuyệt đối của node
    let nodePath = 'node';
    try {
        nodePath = execSync('which node', { encoding: 'utf8' }).trim();
    } catch (_) {
        // Fallback dùng 'node' trên PATH
    }

    const mimeTypeList = MIME_TYPES.map(m => m.mime).join(';') + ';';
    const iconPath = path.resolve(__dirname, '..', 'assets', 'icon.png');

    return `[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=Open and edit Office files with Chrome via OfficeX
Exec=${nodePath} ${launcherPath} %f
MimeType=${mimeTypeList}
Terminal=false
NoDisplay=false
Icon=${iconPath}
Categories=Office;Utility;
StartupNotify=true
`;
}

/**
 * Setup chính cho Linux:
 * 1. Tạo file .desktop
 * 2. Cập nhật desktop database
 * 3. Đăng ký mặc định qua xdg-mime
 */
function setupLinux(launcherPath) {
    console.log('\n[Linux] 🐧 Bắt đầu cài đặt OfficeX cho Linux...');

    // Thư mục cài đặt applications (user-level, không cần sudo)
    const appsDir = path.join(os.homedir(), '.local', 'share', 'applications');
    fs.mkdirSync(appsDir, { recursive: true });

    const desktopFilePath = path.join(appsDir, DESKTOP_FILE_NAME);

    // 1. Ghi file .desktop
    console.log('[Linux] 📁 Đang tạo file .desktop...');
    const content = generateDesktopEntry(launcherPath);
    fs.writeFileSync(desktopFilePath, content, { encoding: 'utf8', mode: 0o755 });
    console.log(`[Linux] ✅ Đã tạo: ${desktopFilePath}`);

    // 2. Cập nhật desktop database
    console.log('[Linux] 🔄 Cập nhật Desktop Database...');
    try {
        execSync(`update-desktop-database "${appsDir}"`, { stdio: 'pipe' });
        console.log('[Linux] ✅ Desktop Database đã cập nhật!');
    } catch (e) {
        console.warn('[Linux] ⚠️ update-desktop-database không khả dụng (có thể bỏ qua):', e.message);
    }

    // 3. Đăng ký mặc định cho từng MIME type
    console.log('[Linux] 📝 Đăng ký OfficeX làm ứng dụng mặc định...');
    let successCount = 0;
    for (const { ext, mime, desc } of MIME_TYPES) {
        try {
            execSync(`xdg-mime default ${DESKTOP_FILE_NAME} "${mime}"`, { stdio: 'pipe' });
            console.log(`[Linux]    ✅ ${ext} (${mime}) → ${desc}`);
            successCount++;
        } catch (e) {
            console.warn(`[Linux]    ⚠️ Lỗi đăng ký ${ext}: ${e.message}`);
        }
    }

    // 4. Xác minh
    console.log('[Linux] 🔍 Xác minh đăng ký...');
    try {
        const result = execSync(
            'xdg-mime query default application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            { encoding: 'utf8' }
        ).trim();
        if (result === DESKTOP_FILE_NAME) {
            console.log(`[Linux] ✅ Xác minh thành công! .docx → ${result}`);
        } else {
            console.warn(`[Linux] ⚠️ .docx hiện được gán cho: ${result} (mong đợi: ${DESKTOP_FILE_NAME})`);
        }
    } catch (_) {
        console.warn('[Linux] ⚠️ Không xác minh được (xdg-mime query thất bại)');
    }

    // 5. Hướng dẫn
    console.log('');
    console.log(`[Linux] ✅ Đã đăng ký ${successCount}/${MIME_TYPES.length} định dạng thành công!`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  📌 HƯỚNG DẪN (Làm 1 lần duy nhất):             ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  1. Mở Chrome → chrome://extensions/            ║');
    console.log('║  2. BẬT "Allow access to file URLs" cho:       ║');
    console.log('║     • Office Editing for Docs, Sheets...        ║');
    console.log('║     • OfficeX                                   ║');
    console.log('║  3. Khởi động lại Chrome                        ║');
    console.log('║                                                  ║');
    console.log('║  Double-click file .docx/.xlsx sẽ tự mở Chrome!║');
    console.log('╚══════════════════════════════════════════════════╝');
}

function uninstallLinux(launcherPath) {
    console.log('\n[Linux] 🐧 Bắt đầu gỡ cài đặt OfficeX cho Linux...');

    const appsDir = path.join(os.homedir(), '.local', 'share', 'applications');
    const desktopFilePath = path.join(appsDir, DESKTOP_FILE_NAME);

    // 1. Xoá file .desktop
    try {
        if (fs.existsSync(desktopFilePath)) {
            fs.unlinkSync(desktopFilePath);
            console.log(`[Linux] 🗑️ Đã xoá file .desktop: ${desktopFilePath}`);
        }
    } catch (e) {
        console.error('[Linux] ❌ Không thể xoá file .desktop:', e.message);
    }

    // 2. Cập nhật desktop database
    try {
        execSync(`update-desktop-database "${appsDir}"`, { stdio: 'pipe' });
        console.log('[Linux] ✅ Desktop Database đã làm mới!');
    } catch (_) {}

    // 3. Xoá các JSON file tự cài Extension trong Chrome, Edge, Brave (nếu có quyền ghi)
    const GOOGLE_OFFICE_EXT_ID = 'gbkeegbaiigmenfmjfclcdgdpimamgkj';
    const linuxBrowserDirs = [
        '/opt/google/chrome/extensions',
        '/opt/microsoft/msedge/extensions',
        '/opt/brave.com/brave/extensions'
    ];

    let extId = '';
    try {
        extId = require('../config').loadConfig().extensionId;
    } catch (_) {}

    for (const bDir of linuxBrowserDirs) {
        // Xoá Google Office Editing json
        try {
            const googleJson = path.join(bDir, `${GOOGLE_OFFICE_EXT_ID}.json`);
            if (fs.existsSync(googleJson)) {
                fs.unlinkSync(googleJson);
            }
        } catch (_) {}

        // Xoá OfficeX extension json
        if (extId) {
            try {
                const officexJson = path.join(bDir, `${extId}.json`);
                if (fs.existsSync(officexJson)) {
                    fs.unlinkSync(officexJson);
                }
            } catch (_) {}
        }
    }

    console.log('[Linux] 🎉 Đã gỡ bỏ hoàn toàn OfficeX khỏi Linux!');
}

module.exports = { setupLinux, uninstallLinux };
