import { uploadToDrive } from './drive.js';

const SUPPORTED_EXTS = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv'];
const GOOGLE_OFFICE_EXT_ID = 'gbkeegbaiigmenfmjfclcdgdpimamgkj';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_FILE') {
    handleOpenFile(message.filePath, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'UPLOAD_FILE_DIRECT') {
    try {
      const fileUrl = message.fileUrl;
      const decodedPath = decodeURIComponent(fileUrl.replace(/^file:\/\/\//i, ''));
      const filePath = decodedPath.replace(/\//g, '\\');
      console.log('[Background] Nút nổi yêu cầu upload file:', filePath);
      uploadToDrive(filePath)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
});

async function getFileNameFromUrl(url) {
  const decoded = decodeURIComponent(url);
  const parts = decoded.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const url = tab.url.toLowerCase();
  const isSupported = SUPPORTED_EXTS.some(ext => url.endsWith(ext) || url.includes(ext + '?') || url.includes(ext + '#'));
  if (!isSupported) return;
  if (!url.startsWith('file:///')) return;

  const fileName = await getFileNameFromUrl(tab.url);
  console.log('[Background] Phát hiện file Office:', fileName, tab.url);

  const notificationId = 'upload_prompt_' + Date.now();
  await chrome.storage.local.set({ [notificationId]: tab.url });

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/assets/icon.png'),
    title: '📄 Đã mở tài liệu',
    message: `Bạn có muốn tải "${fileName}" lên Google Drive để chỉnh sửa Online không?`,
    buttons: [
      { title: '☁️ Tải lên Drive' },
      { title: '✕ Bỏ qua' }
    ],
    priority: 2,
    requireInteraction: true
  });
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('upload_prompt_')) return;

  if (buttonIndex === 0) {
    const data = await chrome.storage.local.get(notificationId);
    const tabUrl = data[notificationId];
    if (tabUrl) {
      const decodedPath = decodeURIComponent(tabUrl.replace(/^file:\/\/\//i, ''));
      uploadToDrive(decodedPath);
    }
  }
  chrome.notifications.clear(notificationId);
  await chrome.storage.local.remove(notificationId);
});

chrome.notifications.onClosed.addListener(async (notificationId) => {
  if (notificationId.startsWith('upload_prompt_')) {
    await chrome.storage.local.remove(notificationId);
  }
});

async function handleOpenFile(filePath, triggerTabId) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileUrl = 'file:///' + normalizedPath;
  console.log('[Background] Đang mở file:', fileUrl);
  console.log('[Background] Trigger tab ID:', triggerTabId);

  if (triggerTabId) {
    await chrome.tabs.update(triggerTabId, { url: fileUrl });
  } else {
    await chrome.tabs.create({ url: fileUrl });
  }

  const notificationId = 'upload_prompt_' + Date.now();
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

function getFileName(filePath) {
  return filePath.replace(/\\/g, '/').split('/').pop();
}
