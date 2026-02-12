exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
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

    const q = (event.queryStringParameters?.q || "").trim().toLowerCase();

    // Base: approved traders only
    let url = `${SUPABASE_URL}/rest/v1/trader_applications?status=eq.approved&order=created_at.desc&limit=50`;

    // Optional search by name OR email OR trade
    if (q) {
      // PostgREST OR filter
      url += `&or=(name.ilike.*${encodeURIComponent(q)}*,email.ilike.*${encodeURIComponent(q)}*,trade.ilike.*${encodeURIComponent(q)}*)`;
    }

    const res = await fetch(url, {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`
      }
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
