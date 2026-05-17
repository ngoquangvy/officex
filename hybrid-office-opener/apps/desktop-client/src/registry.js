// registry.js — Module thao tác Windows Registry.
// Sử dụng lệnh REG ADD/QUERY native của Windows (không cần thư viện bên ngoài).
const { execSync } = require('child_process');

/**
 * Ghi một giá trị vào Registry.
 * @param {string} keyPath - Đường dẫn Registry (vd: HKCU\Software\...)
 * @param {string} valueName - Tên giá trị
 * @param {string} valueData - Dữ liệu
 * @param {string} valueType - Loại giá trị (REG_SZ, REG_DWORD, etc.)
 */
function setRegistryValue(keyPath, valueName, valueData, valueType = 'REG_SZ') {
    try {
        // Escape dấu ngoặc kép bên trong valueData cho CMD
        const escapedData = valueData.replace(/"/g, '\\"');
        const cmd = `reg add "${keyPath}" /v "${valueName}" /t ${valueType} /d "${escapedData}" /f`;
        execSync(cmd, { stdio: 'pipe' });
        console.log(`[Registry] ✅ Đã ghi: ${keyPath}\\${valueName}`);
        return true;
    } catch (e) {
        console.error(`[Registry] ❌ Lỗi ghi Registry: ${e.message}`);
        return false;
    }
}

/**
 * Ghi giá trị mặc định (Default) cho một key.
 */
function setRegistryDefault(keyPath, valueData) {
    try {
        const escapedData = valueData.replace(/"/g, '\\"');
        const cmd = `reg add "${keyPath}" /ve /d "${escapedData}" /f`;
        execSync(cmd, { stdio: 'pipe' });
        console.log(`[Registry] ✅ Đã ghi default: ${keyPath}`);
        return true;
    } catch (e) {
        console.error(`[Registry] ❌ Lỗi ghi Registry default: ${e.message}`);
        return false;
    }
}

/**
 * Kiểm tra xem một key Registry có tồn tại không.
 */
function registryKeyExists(keyPath) {
    try {
        execSync(`reg query "${keyPath}"`, { stdio: 'pipe' });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Đọc một giá trị từ Registry.
 */
function getRegistryValue(keyPath, valueName) {
    try {
        const result = execSync(`reg query "${keyPath}" /v "${valueName}"`, { encoding: 'utf8', stdio: 'pipe' });
        const match = result.match(/REG_\w+\s+(.+)/);
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
}

function deleteRegistryKey(keyPath) {
    try {
        execSync(`reg delete "${keyPath}" /f`, { stdio: 'pipe' });
        console.log(`[Registry] 🗑️ Đã xóa key: ${keyPath}`);
        return true;
    } catch (e) {
        return false;
    }
}

function deleteRegistryValue(keyPath, valueName) {
    try {
        execSync(`reg delete "${keyPath}" /v "${valueName}" /f`, { stdio: 'pipe' });
        console.log(`[Registry] 🗑️ Đã xóa giá trị: ${keyPath}\\${valueName}`);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    setRegistryValue,
    setRegistryDefault,
    registryKeyExists,
    getRegistryValue,
    deleteRegistryKey,
    deleteRegistryValue
};
