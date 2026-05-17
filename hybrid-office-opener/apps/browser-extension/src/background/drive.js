// drive.js — Module xử lý Google Drive API v3.
// Chức năng:
//   1. Xác thực người dùng qua chrome.identity (OAuth2)
//   2. Tạo thư mục "Hybrid Office Opener" trên Drive nếu chưa có
//   3. Upload file vào thư mục đó
//   4. Mở file trên Google Docs/Sheets/Slides Online

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER_NAME = 'Hybrid Office Opener';

// Map đuôi file sang MIME type tương ứng
const MIME_TYPES = {
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv':  'text/csv',
};

// Map MIME type Office sang Google Docs MIME type (để convert khi mở online)
const GOOGLE_MIME_TYPES = {
  'application/msword': 'application/vnd.google-apps.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.google-apps.document',
  'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.google-apps.spreadsheet',
  'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.google-apps.presentation',
  'text/csv': 'application/vnd.google-apps.spreadsheet',
};

// Google Docs/Sheets/Slides editor URLs
const EDITOR_URLS = {
  'application/vnd.google-apps.document': 'https://docs.google.com/document/d/',
  'application/vnd.google-apps.spreadsheet': 'https://docs.google.com/spreadsheets/d/',
  'application/vnd.google-apps.presentation': 'https://docs.google.com/presentation/d/',
};

// ========== AUTHENTICATION ==========

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

// ========== DRIVE API HELPERS ==========

async function driveRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Drive API Error (${response.status}): ${errBody}`);
  }

  return response.json();
}

/**
 * Tìm hoặc tạo thư mục "Hybrid Office Opener" trên Google Drive.
 */
async function getOrCreateAppFolder(token) {
  // 1. Tìm thư mục đã tồn tại
  const query = `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const result = await driveRequest(token, searchUrl);

  if (result.files && result.files.length > 0) {
    console.log(`[Drive] 📁 Tìm thấy thư mục "${APP_FOLDER_NAME}": ${result.files[0].id}`);
    return result.files[0].id;
  }

  // 2. Chưa có → Tạo mới
  console.log(`[Drive] 📁 Tạo thư mục mới "${APP_FOLDER_NAME}" trên Drive...`);
  const createResult = await driveRequest(token, `${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  console.log(`[Drive] ✅ Đã tạo thư mục: ${createResult.id}`);
  return createResult.id;
}

/**
 * Upload file lên Google Drive và convert sang Google Docs format.
 */
async function uploadFileToDrive(token, folderId, fileName, fileBlob, mimeType) {
  // Sử dụng multipart upload để gửi cả metadata + nội dung file
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: GOOGLE_MIME_TYPES[mimeType] || mimeType, // Convert sang Google format
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileBlob);

  const uploadUrl = `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,mimeType`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Upload Error (${response.status}): ${errBody}`);
  }

  return response.json();
}

// ========== MAIN UPLOAD FUNCTION ==========

export async function uploadToDrive(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileUrl = 'file:///' + normalizedPath;
  const fileName = normalizedPath.split('/').pop();
  const fileExt = '.' + fileName.split('.').pop().toLowerCase();
  const mimeType = MIME_TYPES[fileExt] || 'application/octet-stream';

  console.log(`[Drive] 🚀 Bắt đầu upload: ${fileName} (${mimeType})`);

  // Thông báo đang xử lý
  chrome.notifications.create('upload_status', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/assets/icon.png'),
    title: '⏳ Đang tải lên Google Drive...',
    message: `Đang tải "${fileName}"...`
  });

  try {
    // 1. Lấy token xác thực
    console.log('[Drive] 🔐 Đang xác thực...');
    const token = await getAuthToken();
    console.log('[Drive] ✅ Xác thực thành công');

    // 2. Tìm/tạo thư mục app trên Drive
    const folderId = await getOrCreateAppFolder(token);

    // 3. Đọc file từ máy tính
    console.log('[Drive] 📖 Đang đọc file...');
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Không đọc được file. Hãy bật "Allow access to file URLs" cho Extension.');
    }
    const blob = await response.blob();
    console.log(`[Drive] ✅ Đã đọc file: ${blob.size} bytes`);

    // 4. Upload lên Drive
    console.log('[Drive] ☁️ Đang upload...');
    const uploadedFile = await uploadFileToDrive(token, folderId, fileName, blob, mimeType);
    console.log(`[Drive] ✅ Upload thành công! File ID: ${uploadedFile.id}`);

    // 5. Thông báo thành công
    chrome.notifications.create('upload_success', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/assets/icon.png'),
      title: '✅ Tải lên thành công!',
      message: `"${fileName}" đã được tải lên Drive. Đang mở trình chỉnh sửa...`
    });

    // 6. Mở file trên Google Docs/Sheets/Slides Online
    const googleMimeType = GOOGLE_MIME_TYPES[mimeType];
    const editorBaseUrl = EDITOR_URLS[googleMimeType];

    if (editorBaseUrl && uploadedFile.id) {
      const editorUrl = `${editorBaseUrl}${uploadedFile.id}/edit`;
      chrome.tabs.create({ url: editorUrl });
    } else if (uploadedFile.webViewLink) {
      chrome.tabs.create({ url: uploadedFile.webViewLink });
    } else {
      chrome.tabs.create({ url: `https://drive.google.com/file/d/${uploadedFile.id}/view` });
    }

  } catch (error) {
    console.error('[Drive] ❌ Lỗi:', error.message);
    chrome.notifications.create('upload_error', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/assets/icon.png'),
      title: '❌ Lỗi tải lên',
      message: error.message.substring(0, 200) // Giới hạn độ dài message
    });
  }
}
