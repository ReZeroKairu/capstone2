import { storage } from '../firebase/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads an image to Firebase Storage and returns its download URL
 * @param {File} file - The image file to upload
 * @param {string} path - The storage path (e.g., 'announcements/images')
 * @returns {Promise<string>} The download URL of the uploaded image
 */
export const uploadImage = async (file, path = 'announcements/images') => {
  try {
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Extracts and uploads base64 images from HTML content
 * @param {string} html - The HTML content containing base64 images
 * @returns {Promise<{content: string, uploadedImages: string[]}>} The processed HTML and array of image URLs
 */
export const processHtmlImages = async (html) => {
  const base64Images = html.match(/data:image\/[^;]+;base64[^"]+/g) || [];
  if (base64Images.length === 0) return { content: html, uploadedImages: [] };

  const uploadedImages = [];
  let processedHtml = html;

  for (const base64 of base64Images) {
    try {
      // Convert base64 to blob
      const response = await fetch(base64);
      const blob = await response.blob();
      
      // Upload the blob to Firebase Storage
      const downloadURL = await uploadImage(blob);
      uploadedImages.push(downloadURL);
      
      // Replace base64 with the download URL
      processedHtml = processedHtml.replace(base64, downloadURL);
    } catch (error) {
      console.error('Error processing image:', error);
      // Remove the image if upload fails
      processedHtml = processedHtml.replace(/<img[^>]*src=["']?[^>"']+["']?[^>]*>/, '');
    }
  }

  return { content: processedHtml, uploadedImages };
};
