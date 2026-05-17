// trigger.js — Gửi message sang Background rồi chờ.
// Tab này sẽ được Background điều hướng sang file URL (không cần tự đóng).
(async function () {
  const statusEl = document.getElementById('status');
  const spinnerEl = document.getElementById('spinner');

  function showStatus(msg, isError = false) {
    if (statusEl) {
      statusEl.textContent = msg;
      if (isError) statusEl.classList.add('error');
    }
  }

  // 1. Lấy đường dẫn file từ tham số URL
  const urlParams = new URLSearchParams(window.location.search);
  const filePath = urlParams.get('file');

  if (!filePath) {
    showStatus('Lỗi: Không tìm thấy đường dẫn file.', true);
    if (spinnerEl) spinnerEl.style.display = 'none';
    return;
  }

  showStatus(`Đang mở: ${filePath}`);

  // 2. Gửi thông điệp sang Background Service Worker
  //    Background sẽ điều hướng tab này sang file:/// URL
  //    → Tab này sẽ trở thành trình xem tài liệu
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'OPEN_FILE',
      filePath: filePath
    });

    if (response && !response.success) {
      showStatus(`Lỗi: ${response.error}`, true);
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
    // Nếu thành công: tab này sẽ tự động chuyển sang hiển thị file
    // (do Background gọi chrome.tabs.update)
  } catch (err) {
    showStatus(`Lỗi kết nối: ${err.message}`, true);
    if (spinnerEl) spinnerEl.style.display = 'none';
  }
})();
