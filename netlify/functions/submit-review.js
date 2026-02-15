const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isUuid(v){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: "Missing Supabase env vars" };
    }

    const auth = event.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return { statusCode: 401, headers: corsHeaders, body: "Missing Authorization Bearer token" };

    // Validate token + get user
    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
    });
    const uText = await uRes.text();
    if (!uRes.ok) return { statusCode: 401, headers: corsHeaders, body: "Invalid or expired login" };
    const user = JSON.parse(uText);

    const body = JSON.parse(event.body || "{}");
    const trader_id = String(body.trader_id || "").trim();
    const rating = Number(body.rating || 0);
    const title = body.title ? String(body.title).trim().slice(0, 120) : null;
    const reviewBody = String(body.body || "").trim().slice(0, 1000);

    if (!trader_id) return { statusCode: 400, headers: corsHeaders, body: "Missing: trader_id" };
    if (!isUuid(trader_id)) return { statusCode: 400, headers: corsHeaders, body: "Invalid trader_id" };
    if (!(rating >= 1 && rating <= 5)) return { statusCode: 400, headers: corsHeaders, body: "Rating must be 1–5" };
    if (!reviewBody) return { statusCode: 400, headers: corsHeaders, body: "Review text is required" };

    const payload = {
  trader_id,
  customer_id: user.id,         // ✅ new: used for one-per-customer-per-trader
  reviewer_user_id: user.id,    // (optional) keep if your table already has it
  rating,
  title,
  body: reviewBody,
  status: "published"
};


    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    const insText = await insRes.text();
    if (!insRes.ok) return { statusCode: insRes.status, headers: corsHeaders, body: insText };

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: insText
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: err?.message || "Server error" };
  }
};
