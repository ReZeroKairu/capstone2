// File type to icon mapping
export const getFileTypeIcon = (fileName) => {
  if (!fileName) return '📄';
  
  const extension = fileName.split('.').pop().toLowerCase();
  
  const iconMap = {
    // Documents
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📄',
    'rtf': '📄',
    'odt': '📝',
    
    // Spreadsheets
    'xls': '📊',
    'xlsx': '📊',
    'csv': '📊',
    'ods': '📊',
    
    // Presentations
    'ppt': '📑',
    'pptx': '📑',
    'odp': '📑',
    
    // Images
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🖼️',
    'webp': '🖼️',
    
    // Archives
    'zip': '🗜️',
    'rar': '🗜️',
    '7z': '🗜️',
    'tar': '🗜️',
    'gz': '🗜️',
  };
  
  return iconMap[extension] || '📄';
};

// Format file size to human readable format
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Get file extension from filename
export const getFileExtension = (fileName) => {
  return fileName.slice((Math.max(0, fileName.lastIndexOf(".")) || Infinity) + 1);
};

// Check if file is an image
export const isImage = (fileName) => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const ext = getFileExtension(fileName).toLowerCase();
  return imageExtensions.includes(ext);
};

// Check if file is a document
export const isDocument = (fileName) => {
  const docExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
  const ext = getFileExtension(fileName).toLowerCase();
  return docExtensions.includes(ext);
};

// Check if file is a spreadsheet
export const isSpreadsheet = (fileName) => {
  const spreadsheetExtensions = ['xls', 'xlsx', 'csv', 'ods'];
  const ext = getFileExtension(fileName).toLowerCase();
  return spreadsheetExtensions.includes(ext);
};
