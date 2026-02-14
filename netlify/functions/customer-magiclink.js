const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY; // <-- add this env var in Netlify

    if (!SUPABASE_URL || !ANON_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" };
    }

    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim();
    const redirectTo = String(body.redirectTo || "").trim();

    if (!email) return { statusCode: 400, headers: corsHeaders, body: "Missing: email" };
    if (!redirectTo) return { statusCode: 400, headers: corsHeaders, body: "Missing: redirectTo" };

    // Send magic link
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        email,
        create_user: true,
        options: { emailRedirectTo: redirectTo }
      })
    });

    const text = await res.text();
    if (!res.ok) return { statusCode: res.status, headers: corsHeaders, body: text };

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: err?.message || "Server error" };
  }
};
