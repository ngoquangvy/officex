// background/index.js — Service Worker chính.
// Xử lý: nhận message từ trigger → điều hướng tab sang file → hiện notification.
import { uploadToDrive } from './drive.js';

// ========== Xử lý thông điệp từ trigger.js và content script ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_FILE') {
    handleOpenFile(message.filePath, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Giữ kênh sendResponse mở cho async
  }

  if (message.action === 'UPLOAD_FILE_DIRECT') {
    try {
      const fileUrl = message.fileUrl;
      // Convert fileUrl "file:///D:/officex/test.docx" -> "D:\officex\test.docx"
      const decodedPath = decodeURIComponent(fileUrl.replace(/^file:\/\/\//i, ''));
      const filePath = decodedPath.replace(/\//g, '\\');
      
      console.log('[Background] Nút nổi yêu cầu upload file:', filePath);
      
      uploadToDrive(filePath)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true; // Giữ kênh sendResponse mở cho async
  }
});

async function handleOpenFile(filePath, triggerTabId) {
  // 1. Chuyển đổi đường dẫn Windows sang file:/// URL
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileUrl = 'file:///' + normalizedPath;

  console.log('[Background] Đang mở file:', fileUrl);
  console.log('[Background] Trigger tab ID:', triggerTabId);

  // 2. ĐIỀU HƯỚNG trigger tab hiện tại sang file URL (thay vì mở tab mới)
  //    → Nếu Extension "Office Editing" đã cài: tab sẽ hiển thị trình xem tài liệu
  //    → Nếu chưa cài: Chrome sẽ download file nhưng tab vẫn mở → Chrome KHÔNG bị đóng
  if (triggerTabId) {
    await chrome.tabs.update(triggerTabId, { url: fileUrl });
  } else {
    // Fallback nếu không lấy được tab ID
    await chrome.tabs.create({ url: fileUrl });
  }

  // 3. Hiển thị Notification hỏi người dùng có muốn upload lên Drive không
  const notificationId = 'upload_prompt_' + Date.now();

  // Lưu filePath vào storage để truy xuất khi user click notification
  await chrome.storage.local.set({ [notificationId]: filePath });

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/assets/icon.png'),
    title: '📄 Đã mở tài liệu',
    message: `Bạn có muốn tải "${getFileName(filePath)}" lên Google Drive để chỉnh sửa Online không?`,
    buttons: [
      { title: '☁️ Tải lên Drive' },
      { title: '✕ Bỏ qua' }
    ],
    priority: 2,
    requireInteraction: true
  });
}

// ========== Xử lý sự kiện click nút trên Notification ==========
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('upload_prompt_')) return;

  if (buttonIndex === 0) {
    // Người dùng chọn "Tải lên Drive"
    const data = await chrome.storage.local.get(notificationId);
    const filePath = data[notificationId];
    if (filePath) {
      uploadToDrive(filePath);
    }
  }
  chrome.notifications.clear(notificationId);
  await chrome.storage.local.remove(notificationId);
});

// Dọn dẹp storage nếu notification bị đóng mà không click
chrome.notifications.onClosed.addListener(async (notificationId) => {
  if (notificationId.startsWith('upload_prompt_')) {
    await chrome.storage.local.remove(notificationId);
  }
});

// ========== Helper ==========
function getFileName(filePath) {
  return filePath.replace(/\\/g, '/').split('/').pop();
}
