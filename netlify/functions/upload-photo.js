const crypto = require("crypto");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, body: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
    }

    const body = JSON.parse(event.body || "{}");

    // Expect: { mime: "image/jpeg", base64: "...." }
    const mime = String(body.mime || "").trim();
    const base64 = String(body.base64 || "").trim();

    if (!mime.startsWith("image/") || !base64) {
      return { statusCode: 400, body: "Missing or invalid image (mime/base64)" };
    }

    // Limit size (approx) to keep Netlify happy: ~2MB decoded
    // base64 is ~33% bigger than binary; rough check:
    if (base64.length > 3_000_000) {
      return { statusCode: 400, body: "Image too large. Please use a smaller photo." };
    }

    const buffer = Buffer.from(base64, "base64");

    // Determine extension
    let ext = "jpg";
    if (mime === "image/png") ext = "png";
    if (mime === "image/webp") ext = "webp";
    if (mime === "image/jpeg") ext = "jpg";

    const bucket = "profile-photos";
    const id = crypto.randomUUID();
    const objectPath = `profiles/${id}.${ext}`;

    // Upload to Supabase Storage
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`;

    const uploadRes = await fetch(uploadUrl, {
      method: "POST", // Supabase supports POST for object upload
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": mime,
        "x-upsert": "true"
      },
      body: buffer
    });

    const uploadText = await uploadRes.text();
    if (!uploadRes.ok) {
      return { statusCode: 500, body: `Upload failed: ${uploadText}` };
    }

    // Public URL (bucket must be public)
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, photo_url: publicUrl })
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
