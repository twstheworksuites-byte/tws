# Cashfree setup for the current TWS deployment

Frontend: https://tws-xi.vercel.app

Backend: https://tws-api-jy6w.onrender.com

Both services shown in the current dashboards use `twstheworksuites-byte/tws`, not `The-Work-Suites`. Deploy the Cashfree integration commit to both services before changing the provider.

## Render environment

Set the following in the **tws-api** service's Environment settings:

```env
NODE_ENV=production
CLIENT_URL=https://tws-xi.vercel.app
PAYMENT_PROVIDER=cashfree
CASHFREE_ENV=production
CASHFREE_APP_ID=YOUR_LIVE_PAYMENT_GATEWAY_APP_ID
CASHFREE_SECRET_KEY=YOUR_LIVE_PAYMENT_GATEWAY_SECRET
CASHFREE_API_VERSION=2025-01-01
DEV_EMAIL_CAPTURE=false
```

Keep the existing MongoDB connection string and strong JWT secret. Use Payment Gateway keys from Cashfree's production dashboard. Never put the secret in Vercel, a `VITE_` variable, GitHub, or chat. The old Razorpay variables are unused and can be removed from Render. Saving this configuration and redeploying enables real payments.

For a test deployment, use `CASHFREE_ENV=sandbox` with sandbox App ID and secret instead. Do not mix sandbox and live credentials.

## Cashfree dashboard

1. Whitelist the website domain `https://tws-xi.vercel.app` in Payment Gateway settings. Complete Cashfree's website review, including contact details, pricing, terms, privacy, and cancellation/refund policy.
2. Add this public webhook endpoint in the production Payment Gateway webhook settings:

   ```text
   https://tws-api-jy6w.onrender.com/api/payments/cashfree/webhook
   ```

3. Select payment success and payment failed events; enable refund status events if using the admin refund flow. The endpoint verifies Cashfree's signature over the untouched request body using `CASHFREE_SECRET_KEY`.
4. Check webhook delivery logs after testing. Configure this in Cashfree, not in GitHub's repository Webhooks settings.

## Vercel environment

Use Config visibility and Production scope:

```env
VITE_API_URL=https://tws-api-jy6w.onrender.com/api
VITE_SOCKET_URL=https://tws-api-jy6w.onrender.com
```

Redeploy after changing these values. No Cashfree keys are needed in the browser: Render returns only the checkout session, environment, and public provider configuration.

## Verify before accepting customer payments

1. `/api/health` should report `environment: "production"`.
2. `/api/payments/config` should report `provider: "cashfree"`, `enabled: true`, and the intended mode.
3. Test sandbox checkout success, closing the popup, retrying the same booking, and receiving the same webhook twice. Confirm that only a server-verified PAID order with the correct amount and currency confirms the booking.
4. Confirm the invoice and reservation appear once, and that returning from checkout or selecting **Check payment status** recovers a payment confirmed by a webhook.
5. After switching to live keys, complete a small real payment yourself and verify it in Cashfree and the TWS booking dashboard. This charges real money; local automated tests do not perform a live transaction.

Cashfree booking confirmation uses MongoDB transactions; Atlas supports these. A local database used for Cashfree testing must be a replica set. The mock development flow still supports a standalone local MongoDB.

Run `npm test` for unit tests and `npm run test:payments --prefix server` for isolated replica-set tests. The latter downloads a MongoDB test binary on first use and mocks Cashfree HTTP; it never uses the Atlas connection string or charges money.

The reservation hold lasts ten minutes. If payment settles after the hold expires, the app refuses to book unavailable inventory and directs the customer to support. Reconcile that payment in Cashfree and arrange a refund if the reservation cannot be fulfilled; automatic late-payment refunds are not implemented.

For real customer payments, use an always-on Render instance so checkout and webhook processing are not delayed by free-instance sleep. Ensure production SMTP is configured for booking emails.

References: [Cashfree web checkout](https://www.cashfree.com/docs/payments/online/web/redirect), [webhook idempotency](https://www.cashfree.com/docs/payments/online/webhooks/webhook-indempotency).
