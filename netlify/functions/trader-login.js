exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !ANON_KEY) {
      return { statusCode: 500, body: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" };
    }

    const data = JSON.parse(event.body || "{}");
    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "");

    if (!email || !password) {
      return { statusCode: 400, body: "Email and password are required." };
    }

    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": ANON_KEY
        },
        body: JSON.stringify({ email, password })
      }
    );

    const text = await res.text();

    if (!res.ok) {
      return { statusCode: 401, body: text };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: text
    };

  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
