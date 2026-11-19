/**
 * Client-side image compression utility using HTML5 Canvas.
 * If the file is a PDF, returns it untouched.
 * If the file is an image (JPG/PNG/WebP), resizes it to maxDimension (default 1400px)
 * and compresses it to JPEG (or preserves PNG if transparent is requested).
 */
export async function compressAttachmentFile(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    preservePngTransparency?: boolean;
  } = {}
): Promise<File> {
  const {
    maxDimension = 1400,
    quality = 0.8,
    preservePngTransparency = false,
  } = options;

  // Do not compress PDFs
  if (file.type === "application/pdf") {
    return file;
  }

  // Only process images
  if (!file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      const outputMime =
        preservePngTransparency && file.type === "image/png"
          ? "image/png"
          : "image/jpeg";

      if (outputMime === "image/jpeg") {
        // Fill white background for JPEG conversion
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const ext = outputMime === "image/png" ? "png" : "jpg";
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const compressedFile = new File([blob], `${baseName}.${ext}`, {
            type: outputMime,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        outputMime,
        outputMime === "image/png" ? undefined : quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}
