import { storage } from '../firebase/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

export const getFileDownloadUrl = async (filePath) => {
  try {
    const fileRef = ref(storage, filePath);
    const url = await getDownloadURL(fileRef);
    return url;
  } catch (error) {
    console.error('Error getting download URL:', error);
    return null;
  }
};

export const openFileInNewTab = async (filePath, fileName) => {
  try {
    const url = await getFileDownloadUrl(filePath);
    if (url) {
      // For PDFs, we can open directly
      if (filePath.endsWith('.pdf')) {
        window.open(url, '_blank');
      } 
      // For Word docs, use Google Docs viewer
      else if (filePath.endsWith('.doc') || filePath.endsWith('.docx')) {
        window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}`, '_blank');
      }
      // For other file types, trigger download
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  } catch (error) {
    console.error('Error opening file:', error);
  }
};
