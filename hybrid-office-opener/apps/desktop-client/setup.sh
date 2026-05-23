#!/bin/bash
echo ""
echo "🚀 OfficeX — Đang cài đặt..."
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ Không tìm thấy Node.js!"
    echo "   Vui lòng cài đặt Node.js từ https://nodejs.org"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACTION="${1:- --setup}"

if [ "$ACTION" = " --setup" ]; then
    # Generate extension key if not exists
    if [ ! -f "$SCRIPT_DIR/extension-key.pem" ]; then
        echo "[Setup] 🔑 Đang tạo khóa cho extension..."
        mkdir -p "$SCRIPT_DIR/scripts"
        node -e "
const crypto = require('crypto');
const fs = require('fs');
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const hash = crypto.createHash('sha256').update(publicKey).digest();
const chars = 'abcdefghijklmnop';
let id = '';
for (let i = 0; i < 16; i++) {
    id += chars[(hash[i] >> 4) & 0x0f];
    id += chars[hash[i] & 0x0f];
}
fs.writeFileSync('$SCRIPT_DIR/extension-key.pem', privateKey);
const cfg = JSON.parse(fs.readFileSync('$SCRIPT_DIR/config.json', 'utf8'));
cfg.extensionId = id;
fs.writeFileSync('$SCRIPT_DIR/config.json', JSON.stringify(cfg, null, 4) + '\n');
console.log('[Setup] ✅ Extension ID:', id);
"
    fi
    node "$SCRIPT_DIR/src/index.js" --setup
else
    node "$SCRIPT_DIR/src/index.js" "$@"
fi
