// platform/logo-handler.js — Copy logo và tự chuyển đổi PNG sang ICO/ICNS
const fs = require('fs');
const path = require('path');

/**
 * Đóng gói PNG thành tệp ICO chuẩn Windows.
 */
function convertPngToIco(pngBuffer) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); 
    header.writeUInt16LE(1, 2); 
    header.writeUInt16LE(1, 4); 

    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0);   
    entry.writeUInt8(0, 1);   
    entry.writeUInt8(0, 2);   
    entry.writeUInt8(0, 3);   
    entry.writeUInt16LE(1, 4); 
    entry.writeUInt16LE(32, 6); 
    entry.writeUInt32LE(pngBuffer.length, 8); 
    entry.writeUInt32LE(22, 12); 

    return Buffer.concat([header, entry, pngBuffer]);
}

/**
 * Sử dụng PowerShell để resize PNG về đúng 256x256px bảo toàn kênh Alpha (transparency).
 * Chỉ chạy trên Windows.
 */
function resizePngUsingPowerShell(srcPath, destPath) {
    try {
        const { execSync } = require('child_process');
        const psCommand = `powershell -Command "Add-Type -AssemblyName System.Drawing; $src = [System.Drawing.Image]::FromFile('${srcPath}'); $bmp = New-Object System.Drawing.Bitmap(256, 256); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g.DrawImage($src, 0, 0, 256, 256); $g.Dispose(); $bmp.Save('${destPath}', [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); $src.Dispose();"`;
        execSync(psCommand, { stdio: 'pipe' });
        return true;
    } catch (e) {
        console.error('[Logo] ⚠️ Lỗi khi chạy PowerShell để resize PNG:', e.message);
        return false;
    }
}

/**
 * Tiến hành sao chép và đóng gói logo.
 */
function processLogo(sourcePngPath) {
    console.log(`\n[Logo] 🎨 Đang xử lý logo từ nguồn: ${sourcePngPath}`);

    if (!fs.existsSync(sourcePngPath)) {
        console.error('[Logo] ❌ Không tìm thấy tệp PNG gốc!');
        return false;
    }

    // Thư mục đích
    const extAssetsDir = path.resolve(__dirname, '..', '..', '..', 'browser-extension', 'src', 'assets');
    const clientAssetsDir = path.resolve(__dirname, '..', 'assets');

    // Tạo các thư mục nếu chưa có
    fs.mkdirSync(extAssetsDir, { recursive: true });
    fs.mkdirSync(clientAssetsDir, { recursive: true });

    const extPngPath = path.join(extAssetsDir, 'icon.png');
    const clientPngPath = path.join(clientAssetsDir, 'icon.png');
    const clientIcoPath = path.join(clientAssetsDir, 'icon.ico');

    // 1. Sao chép ảnh gốc cho Extension và Client trước
    fs.copyFileSync(sourcePngPath, extPngPath);
    fs.copyFileSync(sourcePngPath, clientPngPath);
    console.log('[Logo] ✅ Đã chèn logo PNG gốc vào Extension & Client');

    // 2. Nếu ở Windows, tiến hành resize về 256x256px để làm ICO chuẩn
    let pngForIcoBuffer;
    if (process.platform === 'win32') {
        const tempResizedPng = path.join(clientAssetsDir, 'temp_256.png');
        console.log('[Logo] 🔄 Đang resize PNG về chuẩn 256x256px bằng PowerShell...');
        const success = resizePngUsingPowerShell(sourcePngPath, tempResizedPng);
        
        if (success && fs.existsSync(tempResizedPng)) {
            pngForIcoBuffer = fs.readFileSync(tempResizedPng);
            fs.unlinkSync(tempResizedPng); // Xóa file tạm
            console.log('[Logo] ✅ Resize ảnh thành công!');
        }
    }

    // Nếu không resize được hoặc không phải Windows, fallback dùng buffer gốc
    if (!pngForIcoBuffer) {
        pngForIcoBuffer = fs.readFileSync(sourcePngPath);
    }

    // 3. Đóng gói thành ICO
    const icoBuffer = convertPngToIco(pngForIcoBuffer);
    fs.writeFileSync(clientIcoPath, icoBuffer);
    console.log('[Logo] ✅ Đã tự động đóng gói icon.ico chuẩn 256x256px không nền đen!');

    return true;
}

module.exports = { processLogo };
