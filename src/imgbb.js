export const IMGBB_API_KEY = "dba9ada677c24e32c45df8800c5a519b";

// name parameter will be used to hint filename on ImgBB
export async function uploadToImgBB(file, name = "") {
  const formData = new FormData();
  formData.append("image", file);
  if (name) formData.append("name", name);
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    {
      method: "POST",
      body: formData,
    }
  );
  const data = await res.json();
  if (!data || !data.data || !data.data.url)
    throw new Error("ImgBB upload failed");
  return data.data.url;
}
