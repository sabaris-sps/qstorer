import sha1 from "js-sha1";

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

export async function deleteFromCloudinary(publicId = "") {
  const apiKey = "417273247896122";
  const apiSecret = "qhtLvD1VgNSJRqJZV1gF90YTEFo";

  const timestamp = Math.floor(new Date().getTime() / 1000);
  const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;

  const signature = sha1(stringToSign); // You would need a JS SHA1 function

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);

  fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    {
      method: "POST",
      body: formData,
    }
  )
    .then((res) => res.json())
    .catch((err) => console.error(err));
}
