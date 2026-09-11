/** Minimal server-side MIME sniff: never trust multipart `mimetype` from the client. */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const GIF_MAGIC_87 = Buffer.from("GIF87a");
const GIF_MAGIC_89 = Buffer.from("GIF89a");
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");

function headText(buffer: Buffer): string {
  return buffer.subarray(0, 512).toString("utf8").replace(/^\uFEFF/, "").trimStart().slice(0, 256).toLowerCase();
}

/**
 * Returns an executable type when content looks like markup/script regardless
 * of what the client claimed (forces `Content-Disposition: attachment` on serve).
 * Otherwise returns a sanitized version of the client claim, or octet-stream.
 */
export function resolveContentType(buffer: Buffer, clientMime: string | undefined): string {
  const text = headText(buffer);
  if (
    text.startsWith("<!doctype html") || text.startsWith("<html") || text.startsWith("<head") ||
    text.startsWith("<body") || text.startsWith("<script") || text.startsWith("<svg") ||
    text.startsWith("<?xml")
  ) {
    return text.startsWith("<svg") ? "image/svg+xml" : "text/html";
  }

  if (buffer.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
  if (buffer.subarray(0, 3).equals(JPEG_MAGIC)) return "image/jpeg";
  if (buffer.subarray(0, 6).equals(GIF_MAGIC_87) || buffer.subarray(0, 6).equals(GIF_MAGIC_89)) {
    return "image/gif";
  }
  if (buffer.subarray(0, 4).equals(WEBP_RIFF) && buffer.subarray(8, 12).equals(WEBP_WEBP)) {
    return "image/webp";
  }
  if (text.startsWith("%pdf-")) return "application/pdf";

  const claim = (clientMime ?? "").split(";", 1)[0].trim().toLowerCase();
  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(claim) && claim.length <= 128) return claim;
  return "application/octet-stream";
}
