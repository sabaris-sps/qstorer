export function sanitizePublicId(name) {
  if (!name) return "";

  return name
    .normalize("NFKD") // break apart combined characters
    .replace(/[^\w\-\/.]+/g, "-") // replace disallowed chars (no emojis)
    .replace(/-+/g, "-") // collapse multiple dashes
    .replace(/^-+|-+$/g, "") // trim starting/ending dashes
    .slice(-200); // limit length for safety
}
