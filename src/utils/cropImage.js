// utils/cropImage.js
export default function getCroppedImg(imageSrc, crop) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.crossOrigin = "anonymous"; // avoid CORS issues
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = crop.width;
      canvas.height = crop.height;

      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );

      // Convert canvas to Base64 instead of Blob
      const base64Image = canvas.toDataURL("image/jpeg");
      resolve(base64Image);
    };
    image.onerror = (err) => reject(err);
  });
}
