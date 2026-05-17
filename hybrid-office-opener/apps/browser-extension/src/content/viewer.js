// viewer.js — Content Script chạy trực tiếp trên trang xem file local (file:///)
// Chức năng: Tạo nút nổi "Tải lên Drive" cực đẹp ở góc dưới màn hình.

(function () {
  const url = window.location.href.toLowerCase();
  const supportedExts = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv'];
  
  // Chỉ kích hoạt trên các file Office được hỗ trợ
  const isSupported = supportedExts.some(ext => url.endsWith(ext) || url.includes(ext + '?') || url.includes(ext + '#'));
  if (!isSupported) return;

  console.log('[OfficeX] Đã phát hiện tài liệu Office cục bộ. Đang chèn nút nổi...');

  // 1. Tạo container chứa style để tránh xung đột CSS
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'officex-floating-container';
  buttonContainer.style.position = 'fixed';
  buttonContainer.style.bottom = '24px';
  buttonContainer.style.right = '24px';
  buttonContainer.style.zIndex = '9999999';
  buttonContainer.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  // 2. CSS Style cho nút nổi (Kính mờ - Glassmorphism cao cấp)
  const style = document.createElement('style');
  style.textContent = `
    #officex-upload-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 22px;
      background: rgba(66, 133, 244, 0.9);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.25);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      user-select: none;
    }
    #officex-upload-btn:hover {
      background: #357ae8;
      transform: translateY(-3px);
      box-shadow: 0 12px 24px rgba(66, 133, 244, 0.4);
    }
    #officex-upload-btn:active {
      transform: translateY(-1px);
    }
    .officex-spinner {
      display: none;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .officex-loading #officex-icon {
      display: none;
    }
    .officex-loading .officex-spinner {
      display: inline-block;
    }
    .officex-loading {
      background: rgba(100, 100, 100, 0.8) !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);

  // 3. Tạo cấu trúc nút nổi
  const button = document.createElement('button');
  button.id = 'officex-upload-btn';
  button.innerHTML = `
    <span id="officex-icon">☁️</span>
    <div class="officex-spinner"></div>
    <span id="officex-text">Tải lên Google Drive</span>
  `;

  // 4. Xử lý click
  button.addEventListener('click', async () => {
    if (button.classList.contains('officex-loading')) return;

    button.classList.add('officex-loading');
    document.getElementById('officex-text').textContent = 'Đang tải lên...';

    // Gửi yêu cầu upload lên Background
    chrome.runtime.sendMessage({
      action: 'UPLOAD_FILE_DIRECT',
      fileUrl: window.location.href
    }, (response) => {
      // Đặt lại trạng thái sau khi xử lý xong
      setTimeout(() => {
        button.classList.remove('officex-loading');
        document.getElementById('officex-text').textContent = 'Tải lên Google Drive';
      }, 3000);
    });
  });

  buttonContainer.appendChild(button);

  // Chèn vào DOM sau khi toàn bộ trang load xong
  if (document.body) {
    document.body.appendChild(buttonContainer);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(buttonContainer);
    });
  }
})();
