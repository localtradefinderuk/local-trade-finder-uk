const corsHeaders = (origin = "*") => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const ALLOWED_ORIGINS = new Set([
  "https://localtradefinder-uk.com",
  "https://www.localtradefinder-uk.com",
]);

function getOrigin(event) {
  return event.headers?.origin || event.headers?.Origin || "";
}

function safeRedirectTo(rawRedirect) {
  // Default to production site
  const fallback = "https://localtradefinder-uk.com/#type=customer_review";

  if (!rawRedirect) return fallback;

  try {
    const url = new URL(rawRedirect);

    // Allow your production domains
    if (ALLOWED_ORIGINS.has(url.origin)) return rawRedirect;

    // Allow netlify.app previews (since you allowlisted it in Supabase)
    if (url.hostname.endsWith(".netlify.app")) return rawRedirect;

    // Otherwise force fallback
    return fallback;
  } catch {
    return fallback;
  }
}

exports.handler = async (event) => {
  const origin = getOrigin(event);
  const headers = corsHeaders(origin || "*");

  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !ANON_KEY) {
      return { statusCode: 500, headers, body: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" };
    }

    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim();
    const redirectTo = safeRedirectTo(String(body.redirectTo || "").trim());

    if (!email) return { statusCode: 400, headers, body: "Missing: email" };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`, // ✅ important
      },
      body: JSON.stringify({
        email,
        create_user: true,
        options: { emailRedirectTo: redirectTo },
      }),
    });

    const text = await res.text();

    // Pass through the exact Supabase error (429 rate-limit etc.)
    if (!res.ok) {
      return { statusCode: res.status, headers, body: text };
    }

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: err?.message || "Server error" };
  }
};
