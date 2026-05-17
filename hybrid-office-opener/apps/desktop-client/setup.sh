#!/bin/bash
# OfficeX — Setup Script for macOS/Linux
# Sử dụng: bash setup.sh

echo ""
echo "🚀 OfficeX — Đang cài đặt..."
echo ""

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Không tìm thấy Node.js!"
    echo "   Vui lòng cài đặt Node.js từ https://nodejs.org"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACTION="${1:-" --setup"}"

if [ "$ACTION" = " --setup" ]; then
    node "$SCRIPT_DIR/src/index.js" --setup
else
    node "$SCRIPT_DIR/src/index.js" "$@"
fi
