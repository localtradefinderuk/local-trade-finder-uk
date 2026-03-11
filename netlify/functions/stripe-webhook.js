const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ✅ CHANGE THIS to the exact table name where you added stripe_customer_id + stripe_subscription_id
const TABLE_NAME = "trader_applications"; // <-- change this if needed

async function supabasePatchByStripeEmail(email, patch) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const emailMatch = String(email).trim().toLowerCase();

  const url =
    `${supabaseUrl}/rest/v1/trader_applications` +
    `?email=eq.${encodeURIComponent(emailMatch)}`;

  console.log("Supabase PATCH →", url);
  console.log("Supabase PATCH body →", patch);

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await res.text();
  console.log("Supabase PATCH status:", res.status);
  console.log("Supabase PATCH response:", text);

  if (!res.ok) {
    throw new Error(`Supabase PATCH failed: ${res.status} ${text}`);
  }

  // If it matched no rows, Supabase returns []
  if (!text || text.trim() === "[]") {
    console.log("⚠️ Supabase PATCH matched 0 rows for email:", emailMatch);
    return [];
  }

  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

exports.handler = async (event) => {
  console.log("STRIPE WEBHOOK HIT", new Date().toISOString(), "method:", event.httpMethod);
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig =
    event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log("Stripe event type:", stripeEvent.type);
  try {
    // 1) A trader completes a Payment Link / Hosted Checkout subscription
   if (stripeEvent.type === "checkout.session.completed") {
  const session = stripeEvent.data.object;

  console.log("Handling checkout.session.completed");
  console.log("Customer ID:", session.customer);
  console.log("Subscription ID:", session.subscription);
  console.log("Email:", session.customer_details?.email || session.customer_email);

  const stripeCustomerId = session.customer || null;
      const stripeSubscriptionId = session.subscription || null;

      const stripeEmail =
        session.customer_details?.email || session.customer_email || null;

      if (!stripeEmail) {
        return { statusCode: 200, body: "ok (no email to match)" };
      }

      // Get subscription object for status + period end
      let sub = null;
      if (stripeSubscriptionId) {
        sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      }

            // Normalise email so it matches what's stored in Supabase
      const emailMatch = String(stripeEmail).trim().toLowerCase();

      const patch = {
        stripe_email: emailMatch,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_status: sub?.status || "active",
      };

      const updatedRows = await supabasePatchByStripeEmail(emailMatch, patch);
      console.log("Supabase updated rows:", Array.isArray(updatedRows) ? updatedRows.length : 0);

      return { statusCode: 200, body: "ok (checkout.session.completed handled)" };
    }

    // 2) Subscription updated (includes cancellation scheduled at period end)
if (stripeEvent.type === "customer.subscription.updated") {
  const sub = stripeEvent.data.object;

  const customer = await stripe.customers.retrieve(sub.customer);
  const stripeEmail = customer.email;

  if (!stripeEmail) {
    return { statusCode: 200, body: "ok (no email)" };
  }

  const emailMatch = String(stripeEmail).trim().toLowerCase();

  let stripeStatus = sub.status || "active";

  // Still active, but set to end at period end
  if (sub.status === "active" && sub.cancel_at_period_end === true) {
    stripeStatus = "canceling";
  }

const patch = {
  stripe_email: emailMatch,
  stripe_customer_id: sub.customer,
  stripe_subscription_id: sub.id,
  stripe_status: stripeStatus,
  stripe_cancel_at_period_end: sub.cancel_at_period_end || false,
  stripe_current_period_end: sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null,
};

  await supabasePatchByStripeEmail(emailMatch, patch);
  return { statusCode: 200, body: "ok (subscription.updated handled)" };
}

// 3) Subscription ended (after period end OR immediate cancel)
if (stripeEvent.type === "customer.subscription.deleted") {
  const sub = stripeEvent.data.object;
  const customer = await stripe.customers.retrieve(sub.customer);
  const stripeEmail = customer.email;

  if (!stripeEmail) {
    return { statusCode: 200, body: "ok (no email)" };
  }

  const emailMatch = String(stripeEmail).trim().toLowerCase();

 const patch = {
  stripe_email: emailMatch,
  stripe_customer_id: sub.customer,
  stripe_subscription_id: sub.id,
  stripe_status: "canceled",
  stripe_cancel_at_period_end: false,
  stripe_current_period_end: sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null,
};

  await supabasePatchByStripeEmail(emailMatch, patch);
  return { statusCode: 200, body: "ok (subscription.deleted handled)" };
}

    // Ignore other events for now (we can add payment_failed later)
    return { statusCode: 200, body: "ok (ignored event)" };
  } catch (err) {
    return { statusCode: 500, body: `Handler error: ${err.message}` };
  }
};
