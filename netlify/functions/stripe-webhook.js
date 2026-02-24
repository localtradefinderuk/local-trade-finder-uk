const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ✅ CHANGE THIS to the exact table name where you added stripe_customer_id + stripe_subscription_id
const TABLE_NAME = "trader_applications"; // <-- change this if needed

async function supabasePatchByStripeEmail(stripeEmail, patch) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?stripe_email=eq.${encodeURIComponent(
    stripeEmail
  )}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase PATCH failed: ${res.status} ${text}`);
  return text;
}

exports.handler = async (event) => {
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

  try {
    // 1) A trader completes a Payment Link / Hosted Checkout subscription
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

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

      const patch = {
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_status: sub?.status || "active",
      };

      await supabasePatchByStripeEmail(stripeEmail, patch);
      return { statusCode: 200, body: "ok (checkout.session.completed handled)" };
    }

    // 2) Subscription updated (includes cancellation scheduled at period end)
    if (stripeEvent.type === "customer.subscription.updated") {
      const sub = stripeEvent.data.object;

      // Payment Link flow: we match to trader by customer email
      const customer = await stripe.customers.retrieve(sub.customer);
      const stripeEmail = customer.email;

      if (!stripeEmail) return { statusCode: 200, body: "ok (no email)" };

      const patch = {
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        stripe_status: sub.status, // active / trialing / past_due / etc.
      };

      await supabasePatchByStripeEmail(stripeEmail, patch);
      return { statusCode: 200, body: "ok (subscription.updated handled)" };
    }

    // 3) Subscription ended (after period end OR immediate cancel)
    if (stripeEvent.type === "customer.subscription.deleted") {
      const sub = stripeEvent.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      const stripeEmail = customer.email;

      if (!stripeEmail) return { statusCode: 200, body: "ok (no email)" };

      const patch = {
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        stripe_status: "canceled",
      };

      await supabasePatchByStripeEmail(stripeEmail, patch);
      return { statusCode: 200, body: "ok (subscription.deleted handled)" };
    }

    // Ignore other events for now (we can add payment_failed later)
    return { statusCode: 200, body: "ok (ignored event)" };
  } catch (err) {
    return { statusCode: 500, body: `Handler error: ${err.message}` };
  }
};
