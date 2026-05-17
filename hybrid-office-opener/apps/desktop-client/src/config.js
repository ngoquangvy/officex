const fs = require('fs');
const path = require('path');

function getConfigPath() {
    // Khi chạy từ pkg, config.json nằm cạnh file exe
    if (process.pkg) {
        const exeDir = path.dirname(process.execPath);
        return path.join(exeDir, 'config.json');
    }
    return path.join(__dirname, '..', 'config.json');
}

const CONFIG_PATH = getConfigPath();

function loadConfig() {
    let extensionId = 'REPLACE_WITH_YOUR_EXTENSION_ID';
    let publishedOnWebStore = false;

    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            if (config.extensionId) {
                extensionId = config.extensionId.trim();
            }
            if (config.publishedOnWebStore !== undefined) {
                publishedOnWebStore = config.publishedOnWebStore;
            }
        } catch (e) {
            console.error("[Config] Lỗi đọc config.json:", e.message);
        }
    } else {
        console.warn(`[Config] Không tìm thấy file cấu hình tại ${CONFIG_PATH}.`);
    }
    return { extensionId, publishedOnWebStore };
}

module.exports = {
    loadConfig
};
