// imageCompression.js
// Utility for compressing images using Canvas API (no external libs)
// Supports: max 1024x1024, max 500KB, WebP (fallback JPEG), quality 0.8
// Usage: import compressImage from './imageCompression.js';

/**
 * Compress an image file to max 1024x1024px, max 500KB, WebP (fallback JPEG)
 * @param {File|Blob} file - The image file to compress
 * @param {Object} [options]
 * @param {number} [options.maxSize=500*1024] - Max file size in bytes
 * @param {number} [options.maxDim=1024] - Max width/height
 * @param {number} [options.quality=0.8] - Compression quality (0-1)
 * @returns {Promise<Blob>} - Compressed image blob
 */
export default async function compressImage(file, options = {}) {
    const maxSize = options.maxSize || 500 * 1024;
    const maxDim = options.maxDim || 1024;
    const quality = options.quality || 0.8;
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = async function() {
            let [w, h] = [img.width, img.height];
            if (w > h && w > maxDim) { h *= maxDim / w;
                w = maxDim; } else if (h > w && h > maxDim) { w *= maxDim / h;
                h = maxDim; } else if (w > maxDim) { h *= maxDim / w;
                w = maxDim; }
            w = Math.round(w);
            h = Math.round(h);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            // Try WebP first
            let blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
            if (!blob || blob.size > maxSize) {
                // Fallback to JPEG
                blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
            }
            // If still too big, reduce quality and retry (max 3 tries)
            let tries = 0;
            let q = quality;
            while (blob.size > maxSize && tries < 3) {
                q -= 0.2;
                blob = await new Promise(res => canvas.toBlob(res, blob.type, q));
                tries++;
            }
            resolve(blob);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}