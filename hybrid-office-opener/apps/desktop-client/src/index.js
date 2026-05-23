// index.js — Entry point Desktop Client.
// Sử dụng:
//   node index.js --setup              → Chạy cài đặt lần đầu (extensions + file associations)
//   node index.js "C:\path\to\file"    → Mở file trong Chrome
const { loadConfig } = require('./config');
const { openFile, findAvailableBrowsers, BROWSERS } = require('./browser');
const { runFullSetup, runFullUninstall } = require('./installer');

async function main() {
    const args = process.argv.slice(2);

    // Chế độ cài đặt
    if (args.includes('--setup')) {
        runFullSetup();
        return;
    }

    // Chế độ gỡ cài đặt
    if (args.includes('--uninstall')) {
        runFullUninstall();
        return;
    }

    // Chế độ mở file
    const filePath = args[0];

    if (!filePath) {
        const exeName = process.pkg
            ? (process.platform === 'win32' ? 'OfficeX.exe' : 'OfficeX')
            : 'node index.js';
        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║        🚀 OfficeX — Mở file Office               ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log('║  Cách sử dụng:                                  ║');
        console.log(`║    ${exeName.padEnd(42)}║`);
        console.log(`║    ${(exeName + ' --setup').padEnd(42)}║`);
        console.log(`║    ${(exeName + ' --uninstall').padEnd(42)}║`);
        console.log(`║    ${(exeName + ' \"file.docx\"').padEnd(42)}║`);
        console.log('╚══════════════════════════════════════════════════╝');
        process.exit(1);
    }

    const { extensionId } = loadConfig();
    console.log(`[Main] Đang mở file: ${filePath}`);

    // Kiểm tra browser có sẵn
    const available = findAvailableBrowsers();
    if (available.length > 0) {
        const names = available.map(b => BROWSERS[b.browser]?.name || b.browser).join(', ');
        console.log(`[Main] Trình duyệt phát hiện: ${names}`);
    } else {
        console.warn('[Main] Không phát hiện trình duyệt nào hỗ trợ.');
    }

    try {
        await openFile(extensionId, filePath);
    } catch (e) {
        console.error("[Main] Lỗi:", e.message);
        process.exit(1);
    }
}

main();
