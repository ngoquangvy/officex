# OfficeX — Mở & Chỉnh sửa File Office bằng Chrome

Ứng dụng cho phép bạn **double-click** vào file Word, Excel, PowerPoint trên máy tính → tự động mở bằng **Google Chrome** để xem và chỉnh sửa trực tuyến, không cần cài Microsoft Office.

**Hỗ trợ:** Windows · macOS · Linux

---

## 📂 Cấu trúc Dự án

```text
apps/
├── desktop-client/             🖥️ Ứng dụng Desktop (Node.js)
│   ├── src/
│   │   ├── index.js            Entry point
│   │   ├── config.js           Đọc cấu hình
│   │   ├── browser.js          Tìm & khởi chạy Chrome (đa nền tảng)
│   │   ├── installer.js        Platform Dispatcher
│   │   ├── registry.js         Windows Registry (chỉ dùng trên Windows)
│   │   └── platform/
│   │       ├── windows.js      🖥️ Registry + OfficeX.exe + GUI MessageBox
│   │       ├── macos.js        🍏 App Bundle (.app) + Launch Services
│   │       └── linux.js        🐧 .desktop file + xdg-mime
│   ├── setup.bat               Script cài đặt (Windows)
│   ├── setup.sh                Script cài đặt (macOS/Linux)
│   └── config.json
│
├── browser-extension/          🧩 Chrome Extension
│   ├── src/
│   │   ├── background/
│   │   │   ├── index.js        Service Worker chính
│   │   │   └── drive.js        Google Drive API v3
│   │   ├── content/
│   │   │   └── viewer.js       Nút nổi "Tải lên Drive"
│   │   ├── pages/
│   │   │   ├── trigger.html    Trang trung gian
│   │   │   └── trigger.js      Gửi message sang background
│   │   └── assets/
│   │       └── icon.png
│   └── manifest.json
│
└── api-server/                 ☁️ Backend (tương lai)
```

---

## 🚀 Cài đặt lần đầu

### Bước 1: Chạy Setup Script

**Windows:**
```bash
# PowerShell hoặc CMD
node D:\officex\hybrid-office-opener\apps\desktop-client\src\index.js --setup

# Hoặc double-click file setup.bat
```

**macOS / Linux:**
```bash
cd /path/to/hybrid-office-opener/apps/desktop-client
bash setup.sh
```

Script sẽ tự động:
- Mở Chrome Web Store để cài Google Office Editing Extension
- Đăng ký File Associations cho `.doc .docx .xls .xlsx .ppt .pptx .csv`
- **Windows:** Tạo OfficeX.exe + đăng ký Registry + mở Default Apps settings
- **macOS:** Tạo `~/Applications/OfficeX.app` + đăng ký Launch Services
- **Linux:** Tạo `~/.local/share/applications/officex.desktop` + đăng ký xdg-mime

### Bước 2: Load Extension vào Chrome
1. Mở `chrome://extensions/`
2. Bật **Developer mode**
3. Bấm **Load unpacked** → chọn thư mục `apps/browser-extension`
4. **QUAN TRỌNG:** Bấm **Details** trên CẢ HAI extension:
   - **OfficeX**
   - **Office Editing for Docs, Sheets & Slides**
5. BẬT **"Allow access to file URLs"** cho cả hai

### Bước 3: Đặt OfficeX làm ứng dụng mặc định

**Windows:**
- Click chuột phải file `.docx` → **Open with** → **Choose another app**
- Chọn **OfficeX** → tích **"Always use this app"** → OK

**macOS:**
- Click chuột phải file `.docx` → **Open With** → **Other...**
- Tìm `~/Applications/OfficeX` → tích **"Always Open With"**

**Linux:**
- Setup script đã tự động đăng ký mặc định
- Nếu cần: `xdg-mime default officex.desktop application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### Bước 4: Thiết lập Google Drive API (Tùy chọn — Để upload lên Drive)

> ⚠️ Bước này chỉ cần làm 1 lần. Nếu bạn chưa cần tính năng upload, có thể bỏ qua.

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo **Project mới** (hoặc chọn project có sẵn)
3. Bật **Google Drive API** (APIs & Services → Library → tìm "Google Drive API" → Enable)
4. Tạo **OAuth consent screen**:
   - User type: **External**
   - App name: **OfficeX**
   - Thêm scope: `https://www.googleapis.com/auth/drive.file`
   - Thêm email của bạn vào **Test users**
5. Tạo **OAuth Client ID**:
   - Application type: **Chrome Extension**
   - Extension ID: (Lấy từ `chrome://extensions/`)
6. Copy Client ID và dán vào file `apps/browser-extension/manifest.json` → trường `oauth2.client_id`

---

## 🎯 Cách sử dụng

```bash
# Mở file trực tiếp qua lệnh
node apps/desktop-client/src/index.js "path/to/document.docx"

# Hoặc sau khi đặt mặc định, chỉ cần double-click file!
```

Khi file mở trên Chrome:
- **Xem offline:** File tự động render bởi Google Office Editing Extension
- **Tải lên Drive:** Bấm nút nổi ☁️ "Tải lên Google Drive" ở góc dưới phải màn hình

---

---

## 🔧 Build standalone executable (pkg)

```bash
# Cài pkg toàn cục
npm install -g pkg

# Windows (trên Windows)
pkg apps/desktop-client/src/index.js --targets node18-win-x64 --output apps/desktop-client/dist/OfficeX.exe --public --compress GZip

# macOS (trên Mac)
pkg apps/desktop-client/src/index.js --targets node18-macos-x64 --output apps/desktop-client/dist/OfficeX --public --compress GZip

# Sau build, copy thêm:
#   - config.json
#   - src/assets/icon.ico (Win) / icon.png (Mac)
#   - setup.bat + setup-gui.ps1 (Win) / setup.sh (Mac/Linux)
```

> **Lưu ý:** pkg cần chạy trên chính OS đó (không cross-compile được). Muốn build cho macOS → cần Mac thật.

## 🍏 Build cho macOS (chi tiết)

### Yêu cầu
- macOS (Catalina 10.15+)
- Node.js 18+
- Xcode CLI tools: `xcode-select --install`

### Các bước
```bash
# 1. Clone code
git clone https://github.com/ngoquangvy/officex.git
cd officex

# 2. Build standalone binary
npm install -g pkg
pkg apps/desktop-client/src/index.js --targets node18-macos-x64 --output apps/desktop-client/dist/OfficeX --public --compress GZip

# 3. Tạo .app bundle (macos.js đã có sẵn code)
node apps/desktop-client/src/index.js --setup

# 4. (Tùy chọn) Ký số để tránh Gatekeeper
#   Cần Apple Developer account:
#   codesign --force --deep --sign "Developer ID Application: Your Name" ~/Applications/OfficeX.app
```

Các bước (3) sẽ tự động:
- Tạo `~/Applications/OfficeX.app`
- Copy icon vào Resources
- Đăng ký Launch Services

**Safari extension:** Muốn hỗ trợ Safari, chạy:
```bash
xcrun safari-web-extension-converter apps/browser-extension
```
→ Mở Xcode → build → cài lên Safari (Settings → Extensions).

## 💡 Định dạng được hỗ trợ

| Đuôi file | Loại tài liệu |
|-----------|---------------|
| `.doc` `.docx` | Microsoft Word |
| `.xls` `.xlsx` | Microsoft Excel |
| `.ppt` `.pptx` | Microsoft PowerPoint |
| `.csv` | Comma-Separated Values |
