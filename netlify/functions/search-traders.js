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
    const type = String(body.type || "").trim();         // Domestic / Commercial
    const trade = String(body.trade || "").trim();       // Electrician etc
    const region = String(body.region || "").trim();     // one of 5 regions
    const postcode = String(body.postcode || "").trim(); // optional for display, not filtering (yet)

    if (!type || !trade || !region) {
      return { statusCode: 400, body: "Missing: type, trade, region" };
    }

    // offering filter (based on your existing offering strings)
    // Domestic should match "Domestic" OR "Both"
    // Commercial should match "Commercial" OR "Both"
    const offerA = type === "Domestic" ? "Domestic" : "Commercial";
    const offerB = "Both";

    // Build PostgREST query
    // - approved only
    // - trade exact match
    // - areas_covered contains region
    // - offering matches relevant plan (Domestic/Commercial/Both)
    const params = new URLSearchParams();
    params.set("select", "id,name,email,phone,trade,offering,about,photo_url,base_town,base_postcode,areas_covered");
    params.set("status", "eq.approved");
    params.set("trade", `eq.${trade}`);
    params.set("areas_covered", `cs.{${region}}`);
    params.set("or", `(offering.ilike.*${offerA}*,offering.ilike.*${offerB}*)`);
    params.set("order", "created_at.desc");
    params.set("limit", "30");

    const url = `${SUPABASE_URL}/rest/v1/trader_applications?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`
      }
    });

    const text = await res.text();
    if (!res.ok) {
      return { statusCode: 500, body: `Supabase search failed: ${text}` };
    }

    const rows = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        query: { type, trade, region, postcode },
        results: rows
      })
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
