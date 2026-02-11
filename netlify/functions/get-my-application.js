exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, body: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { statusCode: 401, body: "Missing Authorization header" };
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // 1) Who is the logged-in user?
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${accessToken}`
      }
    });

    if (!userRes.ok) {
      const t = await userRes.text();
      return { statusCode: 401, body: `Invalid session: ${t}` };
    }

    const user = await userRes.json();

    // 2) Fetch their application by auth_user_id
    const appRes = await fetch(
      `${SUPABASE_URL}/rest/v1/trader_applications?auth_user_id=eq.${user.id}&order=created_at.desc&limit=1`,
      {
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Accept": "application/json"
        }
      }
    );

    const appsText = await appRes.text();
    if (!appRes.ok) return { statusCode: 500, body: appsText };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: appsText
    };

  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
