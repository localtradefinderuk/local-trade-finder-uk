exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

    if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_TOKEN) {
      return { statusCode: 500, body: "Missing environment variables" };
    }

    const token = event.headers["x-admin-token"];
    if (!token || token !== ADMIN_TOKEN) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const data = JSON.parse(event.body || "{}");
    const id = data.id;
    const admin_notes = data.admin_notes ? String(data.admin_notes).trim() : null;

    if (!id) {
      return { statusCode: 400, body: "Missing: id" };
    }

    const patch = { status: "approved" };
    if (admin_notes) patch.admin_notes = admin_notes;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/trader_applications?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(patch)
    });

    const text = await res.text();
    if (!res.ok) return { statusCode: 500, body: text };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: text
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
