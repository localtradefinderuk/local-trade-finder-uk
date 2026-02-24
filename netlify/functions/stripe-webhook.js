const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig =
    event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    // Netlify gives us the raw body string in event.body – perfect for Stripe verification
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    // We will handle events in Step 7B
    switch (stripeEvent.type) {
      case "checkout.session.completed":
        // handled next step
        break;

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // handled next step
        break;

      default:
        break;
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    return { statusCode: 500, body: `Server Error: ${err.message}` };
  }
};
