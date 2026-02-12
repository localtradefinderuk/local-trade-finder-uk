exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

    if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_TOKEN) {
      return { statusCode: 500, body: "Server misconfigured." };
    }

    const token = event.headers["x-admin-token"];
    if (!token || token !== ADMIN_TOKEN) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const body = JSON.parse(event.body || "{}");
    const id = String(body.id || "").trim();
    const admin_notes = String(body.admin_notes || "").trim();

    if (!id) return { statusCode: 400, body: "Missing: id" };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/trader_applications?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        status: "banned",
        admin_notes: admin_notes || "Banned by admin"
      })
    });

    const text = await res.text();
    if (!res.ok) return { statusCode: 500, body: text };

    return { statusCode: 200, body: text };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
