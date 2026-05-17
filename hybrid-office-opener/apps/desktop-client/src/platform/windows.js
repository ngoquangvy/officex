// platform/windows.js — Logic cài đặt dành riêng cho Windows.
// Trích xuất từ installer.js gốc để tách biệt theo OS.
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const { setRegistryValue, setRegistryDefault } = require('../registry');

const APP_NAME = 'OfficeX';

const SUPPORTED_EXTENSIONS = [
    { ext: '.doc',  desc: 'Word Document' },
    { ext: '.docx', desc: 'Word Document' },
    { ext: '.xls',  desc: 'Excel Spreadsheet' },
    { ext: '.xlsx', desc: 'Excel Spreadsheet' },
    { ext: '.ppt',  desc: 'PowerPoint' },
    { ext: '.pptx', desc: 'PowerPoint' },
    { ext: '.csv',  desc: 'CSV File' },
];

// ========== FILE ASSOCIATIONS (Windows Registry) ==========

function registerFileAssociations(launcherPath) {
    console.log('\n[Windows] 📁 Đăng ký File Associations...');

    // Khi chạy từ pkg: exe là app, không cần copy node
    const isPkg = !!process.pkg;
    const appDir = isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..', '..');
    const officeXExePath = isPkg ? process.execPath : path.join(appDir, 'OfficeX.exe');

    // Nếu chạy từ source, tạo OfficeX.exe từ node.exe + gắn icon
    if (!isPkg) {
        const nodePath = process.execPath;
        const rceditPath = path.join(appDir, 'rcedit.exe');
        const iconPathLocal = path.resolve(__dirname, '..', 'assets', 'icon.ico');

        try {
            if (!fs.existsSync(officeXExePath)) {
                console.log('[Windows] 🔨 Đang tạo file thực thi OfficeX.exe...');
                fs.copyFileSync(nodePath, officeXExePath);
            }

            if (!fs.existsSync(rceditPath)) {
                console.log('[Windows] 📥 Đang tải rcedit.exe (công cụ gắn icon)...');
                const url = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe';
                try {
                    execSync(`powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${rceditPath}' -UseBasicParsing"`, { stdio: 'pipe', timeout: 30000 });
                    console.log('[Windows] ✅ Đã tải rcedit.exe');
                } catch (e) {
                    console.warn('[Windows] ⚠️ Không tải được rcedit.exe:', e.message);
                }
            }

            if (fs.existsSync(rceditPath) && fs.existsSync(iconPathLocal)) {
                try {
                    execSync(`"${rceditPath}" "${officeXExePath}" --set-icon "${iconPathLocal}"`, { stdio: 'pipe' });
                    console.log('[Windows] ✅ Đã gắn icon OfficeX vào OfficeX.exe');
                } catch (e) {
                    console.warn('[Windows] ⚠️ Không gắn được icon:', e.message);
                }
            }
        } catch (e) {
            console.error('[Windows] ❌ Lỗi tạo file thực thi:', e.message);
        }
    } else {
        console.log('[Windows] ✅ Chạy từ OfficeX.exe (pkg)');
    }

    const progId = `${APP_NAME}.Document`;
    const progIdKey = `HKCU\\Software\\Classes\\${progId}`;
    const appKey = `HKCU\\Software\\Classes\\Applications\\OfficeX.exe`;
    const iconPath = isPkg
        ? path.join(appDir, 'icon.ico')
        : path.resolve(__dirname, '..', 'assets', 'icon.ico');

    // Đặt tên hiển thị của tài liệu
    setRegistryDefault(progIdKey, 'OfficeX Document');
    setRegistryValue(progIdKey, 'FriendlyAppName', 'OfficeX', 'REG_SZ');

    // Đăng ký DefaultIcon
    if (fs.existsSync(iconPath)) {
        setRegistryDefault(`${progIdKey}\\DefaultIcon`, iconPath);
        setRegistryDefault(`${appKey}\\DefaultIcon`, iconPath);
        console.log('[Windows] ✅ Đăng ký biểu tượng DefaultIcon thành công!');
    }

    // Lệnh mở: Sử dụng OfficeX.exe
    // Khi chạy từ pkg, exe tự xử lý file; khi dev, cần truyền script path
    const openCommand = isPkg
        ? `"${officeXExePath}" "%1"`
        : `"${officeXExePath}" "${launcherPath}" "%1"`;
    setRegistryDefault(`${progIdKey}\\shell\\open\\command`, openCommand);

    // Đăng ký ứng dụng chính thức vào Applications
    setRegistryDefault(`${appKey}\\shell\\open\\command`, openCommand);
    setRegistryValue(appKey, 'FriendlyAppName', 'OfficeX', 'REG_SZ');

    for (const { ext, desc } of SUPPORTED_EXTENSIONS) {
        const openWithKey = `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`;
        setRegistryValue(openWithKey, progId, '', 'REG_SZ');
        console.log(`[Windows]    ✅ ${ext} → ${desc}`);
    }

    // Đăng ký Capabilities
    console.log('[Windows] 🛡️ Đăng ký Capabilities ứng dụng...');
    const capabilitiesKey = `HKCU\\Software\\${APP_NAME}\\Capabilities`;
    setRegistryValue(capabilitiesKey, 'ApplicationName', 'OfficeX', 'REG_SZ');
    setRegistryValue(capabilitiesKey, 'ApplicationDescription', 'Open and edit Office files with Chrome via OfficeX.', 'REG_SZ');

    const assocKey = `${capabilitiesKey}\\FileAssociations`;
    for (const { ext } of SUPPORTED_EXTENSIONS) {
        setRegistryValue(assocKey, ext, progId, 'REG_SZ');
    }

    // RegisteredApplications
    setRegistryValue('HKCU\\Software\\RegisteredApplications', 'OfficeX', `Software\\${APP_NAME}\\Capabilities`, 'REG_SZ');

    // Đăng ký chính thức vào danh sách Installed Apps (Settings / Control Panel) của Windows
    const uninstallKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OfficeX`;
    setRegistryValue(uninstallKey, 'DisplayName', 'OfficeX', 'REG_SZ');
    setRegistryValue(uninstallKey, 'DisplayVersion', '1.2', 'REG_SZ');
    setRegistryValue(uninstallKey, 'Publisher', 'OfficeX Team', 'REG_SZ');
    const uninstallBat = isPkg ? path.join(appDir, 'uninstall.bat') : path.resolve(__dirname, '..', '..', 'uninstall.bat');
    setRegistryValue(uninstallKey, 'UninstallString', `"${uninstallBat}"`, 'REG_SZ');
    if (fs.existsSync(iconPath)) {
        setRegistryValue(uninstallKey, 'DisplayIcon', iconPath, 'REG_SZ');
    }
    setRegistryValue(uninstallKey, 'NoModify', '1', 'REG_DWORD');
    setRegistryValue(uninstallKey, 'NoRepair', '1', 'REG_DWORD');
    console.log('[Windows] ✅ Đăng ký thành công OfficeX vào danh sách Installed Apps của Windows!');

    // Thông báo Windows Shell cập nhật
    console.log('[Windows] 🔄 Đang thông báo Windows Shell cập nhật...');
    try {
        execSync(`powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Shell { [DllImport(\\\"shell32.dll\\\")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2); }'; [Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)"`, { stdio: 'pipe' });
        console.log('[Windows] ✅ Windows Shell đã được cập nhật!');
    } catch (e) {
        console.warn('[Windows] ⚠️ Không gọi được SHChangeNotify:', e.message);
    }

    return true;
}

// ========== POPUP GUI (Windows MessageBox) ==========

function showSetupGuide() {
    try {
        const title = 'OfficeX - Hướng dẫn thiết lập Mặc định';
        const message = `Cài đặt OfficeX đã thành công!\\n\\nĐể mở file Office tự động bằng Chrome khi Double-Click:\\n\\n1. Click chuột phải vào bất kỳ file Word (.docx) hoặc Excel (.xlsx) nào.\\n2. Chọn 'Open with' (Mở bằng) -> 'Choose another app'.\\n3. Chọn 'OfficeX' từ danh sách.\\n4. Tích chọn 'Always use this app to open...'.\\n5. Bấm OK.`;

        const escapedMessage = message.replace(/'/g, "''");
        const escapedTitle = title.replace(/'/g, "''");
        const psCommand = `powershell -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${escapedMessage}', '${escapedTitle}', [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Information)"`;
        exec(psCommand);
    } catch (e) {
        // Bỏ qua nếu không hiện được popup
    }

    // Mở Default Apps settings
    setTimeout(() => {
        exec('start ms-settings:defaultapps');
    }, 2000);
}

// ========== SETUP TỔNG ==========

function setupWindows(launcherPath) {
    registerFileAssociations(launcherPath);

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  ⚠️  BƯỚC CUỐI (Làm 1 lần duy nhất):            ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  1. Mở Chrome → chrome://extensions/            ║');
    console.log('║  2. Với TỪNG extension, bấm Details rồi BẬT:   ║');
    console.log('║     "Allow access to file URLs"                 ║');
    console.log('║     • Office Editing for Docs, Sheets...        ║');
    console.log('║     • OfficeX                                   ║');
    console.log('║  3. Khởi động lại Chrome                        ║');
    console.log('╚══════════════════════════════════════════════════╝');

    showSetupGuide();
}

function uninstallWindows(launcherPath) {
    console.log('\n[Windows] 🗑️ Bắt đầu gỡ cài đặt OfficeX...');

    const progId = `${APP_NAME}.Document`;

    // 1. Xóa Registry File Associations & ProgIds
    const { deleteRegistryKey, deleteRegistryValue } = require('../registry');
    
    deleteRegistryKey(`HKCU\\Software\\Classes\\${progId}`);
    deleteRegistryKey(`HKCU\\Software\\Classes\\Applications\\OfficeX.exe`);

    for (const { ext } of SUPPORTED_EXTENSIONS) {
        deleteRegistryValue(`HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`, progId);
    }

    // 2. Xóa Capabilities & Đăng ký Uninstall
    deleteRegistryKey(`HKCU\\Software\\${APP_NAME}`);
    deleteRegistryValue('HKCU\\Software\\RegisteredApplications', 'OfficeX');
    deleteRegistryKey(`HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OfficeX`);

    // 3. Xóa các key tự động cài Extension cho Chrome, Edge, Brave
    const GOOGLE_OFFICE_EXT_ID = 'gbkeegbaiigmenfmjfclcdgdpimamgkj';
    deleteRegistryKey(`HKCU\\Software\\Google\\Chrome\\Extensions\\${GOOGLE_OFFICE_EXT_ID}`);
    deleteRegistryKey(`HKCU\\Software\\Microsoft\\Edge\\Extensions\\${GOOGLE_OFFICE_EXT_ID}`);
    deleteRegistryKey(`HKCU\\Software\\BraveSoftware\\Brave\\Extensions\\${GOOGLE_OFFICE_EXT_ID}`);

    // Xóa extension OfficeX nếu có
    const { extensionId } = loadConfig();
    if (extensionId) {
        deleteRegistryKey(`HKCU\\Software\\Google\\Chrome\\Extensions\\${extensionId}`);
        deleteRegistryKey(`HKCU\\Software\\Microsoft\\Edge\\Extensions\\${extensionId}`);
        deleteRegistryKey(`HKCU\\Software\\BraveSoftware\\Brave\\Extensions\\${extensionId}`);
    }

    // 4. Xóa tệp thực thi OfficeX.exe (không xóa chính nó khi chạy từ pkg)
    if (!process.pkg) {
        const officeXExePath = path.resolve(__dirname, '..', '..', 'OfficeX.exe');
        try {
            if (fs.existsSync(officeXExePath)) {
                fs.unlinkSync(officeXExePath);
                console.log('[Windows] 🗑️ Đã xóa file thực thi OfficeX.exe');
            }
        } catch (e) {
            console.error('[Windows] ⚠️ Không thể xóa OfficeX.exe (có thể đang chạy):', e.message);
        }
    }

    // 5. Cập nhật Windows Shell
    console.log('[Windows] 🔄 Đang thông báo Windows Shell cập nhật...');
    try {
        execSync(`powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Shell { [DllImport(\\\"shell32.dll\\\")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2); }'; [Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)"`, { stdio: 'pipe' });
        console.log('[Windows] ✅ Windows Shell đã được làm mới!');
    } catch (_) {}

    console.log('[Windows] 🎉 Đã gỡ bỏ hoàn toàn OfficeX khỏi Windows!');
}

function loadConfig() {
    try {
        return require('../config').loadConfig();
    } catch (_) {
        return { extensionId: '' };
    }
}

module.exports = { setupWindows, uninstallWindows };
