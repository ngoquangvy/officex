// viewer.js — Content Script chạy trực tiếp trên trang xem file local (file:///)
// Chức năng: Tạo nút nổi "Tải lên Drive" cực đẹp ở góc dưới màn hình.
// Sử dụng MutationObserver để đảm bảo nút luôn hiển thị kể cả khi
// Google Office Editing extension thay thế DOM.

(function () {
  const url = window.location.href.toLowerCase();
  const supportedExts = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv'];
  
  // Chỉ kích hoạt trên các file Office được hỗ trợ
  const isSupported = supportedExts.some(ext => url.endsWith(ext) || url.includes(ext + '?') || url.includes(ext + '#'));
  if (!isSupported) return;

  console.log('[OfficeX] Đã phát hiện tài liệu Office cục bộ. Đang chèn nút nổi...');

  // CSS Style cho nút nổi (Kính mờ - Glassmorphism cao cấp)
  const CSS_TEXT = `
    #officex-floating-container {
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      pointer-events: auto !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    #officex-upload-btn {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      padding: 12px 22px !important;
      background: rgba(66, 133, 244, 0.9) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 50px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.25) !important;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
      user-select: none !important;
    }
    #officex-upload-btn:hover {
      background: #357ae8 !important;
      transform: translateY(-3px) !important;
      box-shadow: 0 12px 24px rgba(66, 133, 244, 0.4) !important;
    }
    #officex-upload-btn:active {
      transform: translateY(-1px) !important;
    }
    .officex-spinner {
      display: none;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: officex-spin 0.8s linear infinite;
    }
    @keyframes officex-spin {
      to { transform: rotate(360deg); }
    }
    .officex-loading #officex-icon {
      display: none !important;
    }
    .officex-loading .officex-spinner {
      display: inline-block !important;
    }
    .officex-loading {
      background: rgba(100, 100, 100, 0.8) !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
    }
  `;

  /**
   * Chèn style vào <head> hoặc <html> nếu chưa có.
   */
  function ensureStyle() {
    if (document.getElementById('officex-style')) return;
    const style = document.createElement('style');
    style.id = 'officex-style';
    style.textContent = CSS_TEXT;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Tạo và chèn nút nổi vào DOM nếu chưa tồn tại.
   */
  function ensureButton() {
    if (document.getElementById('officex-floating-container')) return;

    ensureStyle();

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'officex-floating-container';

    const button = document.createElement('button');
    button.id = 'officex-upload-btn';
    button.innerHTML = `
      <span id="officex-icon">☁️</span>
      <div class="officex-spinner"></div>
      <span id="officex-text">Tải lên Google Drive</span>
    `;

    button.addEventListener('click', async () => {
      if (button.classList.contains('officex-loading')) return;

      button.classList.add('officex-loading');
      const textEl = button.querySelector('#officex-text');
      if (textEl) textEl.textContent = 'Đang tải lên...';

      chrome.runtime.sendMessage({
        action: 'UPLOAD_FILE_DIRECT',
        fileUrl: window.location.href
      }, (response) => {
        setTimeout(() => {
          button.classList.remove('officex-loading');
          if (textEl) textEl.textContent = 'Tải lên Google Drive';
        }, 3000);
      });
    });

    buttonContainer.appendChild(button);

    const target = document.body || document.documentElement;
    target.appendChild(buttonContainer);
    console.log('[OfficeX] ✅ Nút nổi "Tải lên Drive" đã được chèn.');
  }

  // === Chèn lần đầu ===
  ensureButton();

  // === MutationObserver: Tự động chèn lại nếu bị xoá bởi Google Office Editing ===
  const observer = new MutationObserver(() => {
    if (!document.getElementById('officex-floating-container')) {
      console.log('[OfficeX] Nút nổi đã bị xoá (có thể do Google Office Editing). Đang chèn lại...');
      ensureButton();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // === Retry: Đợi Google Office Editing render xong rồi chèn lại ===
  // Extension thường mất 1-3s để render file, sau đó thay thế DOM
  const retryIntervals = [500, 1000, 2000, 3000, 5000];
  retryIntervals.forEach(delay => {
    setTimeout(() => {
      ensureButton();
    }, delay);
  });
})();

