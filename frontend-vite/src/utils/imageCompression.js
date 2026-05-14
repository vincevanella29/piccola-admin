/**
 * Compresses an image file in the browser using canvas and converts it to WebP.
 * @param {File} file - The original image file
 * @param {number} maxWidth - Maximum width (default: 1080)
 * @param {number} quality - Quality of the WebP (0 to 1, default: 0.8)
 * @returns {Promise<File>} A promise that resolves to the compressed File object
 */
export const compressImage = (file, maxWidth = 1080, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('File is not an image'));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas is empty'));
            }
            // Generate a unique filename for the webp image
            const baseName = file.name.split('.')[0] || 'image';
            const newFile = new File([blob], `${baseName}_compressed.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(newFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
