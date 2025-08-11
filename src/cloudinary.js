// Cloudinary upload
export const CLOUDINARY_UPLOAD_PRESET = "qstorer_unsigned_preset";
export const CLOUDINARY_CLOUD_NAME = "dup2jhmpu";

export async function uploadToCloudinary(file, publicId = "") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (publicId) formData.append("public_id", publicId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
  const data = await res.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary upload failed");
  }
  return data.secure_url; // returns the image URL
}
