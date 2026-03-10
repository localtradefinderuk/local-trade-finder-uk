const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return {
        statusCode: 500,
        body: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { statusCode: 401, body: "Missing Authorization header" };
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // 1) Get logged in user
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userRes.ok) {
      const t = await userRes.text();
      return { statusCode: 401, body: `Invalid session: ${t}` };
    }

    const user = await userRes.json();

    // 2) Get trader application
    const appRes = await fetch(
      `${SUPABASE_URL}/rest/v1/trader_applications?auth_user_id=eq.${user.id}&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Accept: "application/json",
        },
      }
    );

    const apps = await appRes.json();

    if (!Array.isArray(apps) || apps.length === 0) {
      return { statusCode: 404, body: "No trader application found" };
    }

    const app = apps[0];

    if (!app.stripe_subscription_id) {
      return { statusCode: 400, body: "No Stripe subscription found for this trader" };
    }

    // 3) Tell Stripe to cancel at period end
    const updatedSubscription = await stripe.subscriptions.update(
      app.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        current_period_end: updatedSubscription.current_period_end,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: err.message || "Server error",
    };
  }
};
