/**
 * Client-side check of a face photo before upload: JPEG/PNG, up to 5 MB, at
 * least 200x200 (the terminal rejects anything smaller). Resolves to an empty
 * string when the file is fine, otherwise the translation key of the problem.
 * The backend validates again; this only gives instant feedback.
 */
export function validateFacePhoto(file: File): Promise<string> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") return Promise.resolve("facePhotoBadType");
  if (file.size > 5 * 1024 * 1024) return Promise.resolve("facePhotoTooBig");
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth < 200 || img.naturalHeight < 200 ? "facePhotoTooSmall" : "");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("facePhotoBadType");
    };
    img.src = url;
  });
}
