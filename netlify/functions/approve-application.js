const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

    if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_TOKEN) {
      return { statusCode: 500, headers: corsHeaders, body: "Missing environment variables" };
    }

    const token =
      event.headers["x-admin-token"] ||
      event.headers["X-Admin-Token"] ||
      (event.headers.authorization?.startsWith("Bearer ") ? event.headers.authorization.slice(7) : null);

    if (!token || token !== ADMIN_TOKEN) {
      return { statusCode: 401, headers: corsHeaders, body: "Unauthorized" };
    }

    const data = JSON.parse(event.body || "{}");
    const id = data.id;
    const admin_notes = data.admin_notes ? String(data.admin_notes).trim().slice(0, 1000) : null;

    if (!id) return { statusCode: 400, headers: corsHeaders, body: "Missing: id" };
    if (!isUuid(id)) return { statusCode: 400, headers: corsHeaders, body: "Invalid id (not a UUID)" };

    const patch = { status: "approved" };
    if (admin_notes) patch.admin_notes = admin_notes;

    const url = `${SUPABASE_URL}/rest/v1/trader_applications?id=eq.${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: err?.message || "Server error" };
  }
};
