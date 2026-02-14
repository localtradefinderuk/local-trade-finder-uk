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
    const trader_id = String(body.trader_id || "").trim();

    if (!trader_id) {
      return { statusCode: 400, body: "Missing: trader_id" };
    }

    const params = new URLSearchParams();
    params.set("select", "rating,title,body,created_at");
    params.set("trader_id", `eq.${trader_id}`);
    params.set("status", "eq.published");
    params.set("order", "created_at.desc");
    params.set("limit", "50");

    const url = `${SUPABASE_URL}/rest/v1/reviews?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    });

    const text = await res.text();
    if (!res.ok) return { statusCode: 500, body: text };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, reviews: JSON.parse(text) })
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
