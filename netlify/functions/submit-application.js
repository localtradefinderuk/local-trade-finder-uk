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

    const data = JSON.parse(event.body || "{}");

// Required fields
const required = ["name", "email", "trade", "offering", "base_town", "base_postcode"];

for (const k of required) {
  if (!data[k] || String(data[k]).trim() === "") {
    return { statusCode: 400, body: `Missing: ${k}` };
  }
}

// areas_covered must be an array with at least 1 selected
if (!Array.isArray(data.areas_covered) || data.areas_covered.length === 0) {
  return { statusCode: 400, body: "Missing: areas_covered" };
}

if (!data.password || String(data.password).length < 8) {
  return { statusCode: 400, body: "Password must be at least 8 characters." };
}

    // Build row to insert
    const row = {
      name: String(data.name).trim(),
      email: String(data.email).trim().toLowerCase(),
      phone: data.phone ? String(data.phone).trim() : null,
      trade: String(data.trade).trim(),
      offering: String(data.offering).trim(),
      about: data.about ? String(data.about).trim() : null,
      photo_url: data.photo_url ? String(data.photo_url).trim() : null,
      
      base_town: String(data.base_town).trim(),
      base_postcode: String(data.base_postcode).trim().toUpperCase().replace(/\s+/g, " "),
      areas_covered: data.areas_covered,

      status: "pending"
    };
// Create Supabase Auth user (email + password)
const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`
  },
  body: JSON.stringify({
    email: row.email,
    password: String(data.password),
    email_confirm: true
  })
});

const createUserText = await createUserRes.text();
if (!createUserRes.ok) {
  return { statusCode: 400, body: `Auth user create failed: ${createUserText}` };
}

const createdUser = JSON.parse(createUserText);
row.auth_user_id = createdUser.id;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/trader_applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(row)
    });

    const text = await res.text();

    if (!res.ok) {
      return { statusCode: 500, body: `Supabase insert failed: ${text}` };
    }

    // Supabase returns JSON array by default for inserts
    const inserted = JSON.parse(text);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, application: inserted?.[0] || null })
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};



