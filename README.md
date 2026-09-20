# TWS · The Work Suites

A full MERN coworking booking and operations platform. The application combines a premium customer journey with secure email-and-password accounts, database-enforced availability, ten-minute holds, Cashfree verification/webhooks/refunds, QR check-in, PDF invoices, live maps, reporting, and dedicated customer/admin portals.

## Architecture

- `client/` — React 19, Vite, React Router, Framer Motion, Socket.IO client
- `server/` — Express, Mongoose, JWT, email notifications, QR generation, Socket.IO
- MongoDB is the source of truth for inventory, holds, locks, bookings, payments, maintenance, users and invoices.

Availability is protected by a unique MongoDB index on `(resourceKey, slotStart)`. A hold atomically claims every 15-minute slot in its requested period. Duplicate inserts fail with HTTP 409, preventing overlapping holds/bookings even under concurrent requests. Hold locks have server timestamps and TTL expiry; confirmed bookings remove that expiry and retain the locks.

## Local setup

1. Copy the root environment template: `cp .env.example server/.env`
   Copy the client template too: `cp client/.env.example client/.env` and replace `VITE_WHATSAPP_NUMBER` with the business WhatsApp number.
2. Set a strong `JWT_SECRET`, the admin password, and confirm `MONGODB_URI`.
3. Install packages with `npm install`, `npm install --prefix server`, and `npm install --prefix client`.
4. Seed the physical inventory with `npm run seed`.
5. Start both applications with `npm run dev`.
6. Open `http://localhost:5173`.

The seeded admin email defaults to `admin@tws.com`; credentials are controlled by `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Registration creates customer accounts, while the seeded admin account unlocks the protected dashboard.

## Production configuration

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, production `MONGODB_URI`, and the deployed `CLIENT_URL`.
- Configure SMTP variables for verification, password-reset and booking mail delivery.
- Set `PAYMENT_PROVIDER=cashfree` and add the Cashfree App ID and secret. The mock adapter refuses to confirm payments in production.
- Serve the built client from a CDN/static host and the API behind TLS.
- Run MongoDB as a replica set for operational resilience and backups.
- Change the seeded admin credentials before deployment and restrict access to the admin portal.

## Main routes

Customer: `/`, `/workspaces`, `/book`, `/checkout`, `/login`, `/register`, `/customer/bookings`, `/customer/profile`, `/customer/invoices`.

Admin: `/admin/login`, `/admin`, `/admin/map`, `/admin/bookings`, `/admin/maintenance`, `/admin/workspaces`, `/admin/seats`, `/admin/users`. Customer and admin portals enforce separate roles.

## API groups

- `/api/auth` — password registration/login, session identity and profile
- `/api/workspaces` — configurable inventory and period availability
- `/api/bookings` — quotes, holds, checkout, payment verification, history, invoices, cancellation and check-in
- `/api/admin` — dashboard, seats, customer accounts, bookings, reports and maintenance
- `/api/chat` — rate-limited, server-side Gemini workspace assistant
- `/api/payments/cashfree/webhook` — raw-body signature verification and idempotent payment processing

## Account security

Customer accounts support email verification, time-limited password reset links and authenticated password changes. Five failed logins lock an account for fifteen minutes, password changes invalidate older JWTs, and sensitive admin actions are recorded in the audit log. Sign-in uses email and password only.

## Operations and reporting

The dashboard supports admin-created bookings, status changes, reason-required unbooking, rescheduling, Cashfree/offline refunds, maintenance scheduling, workspace and seat editing, customer activation, live availability, date-range reports and authenticated CSV export. Customer pages include booking details, reusable QR check-in passes, refund status and PDF invoice downloads.

## Gemini assistant

Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in `server/.env`. The API key is never shipped to the React application. The assistant receives a restricted business context, keeps only the last eight UI messages, and is instructed not to invent live availability, discounts or payment outcomes.

## Cashfree payments

For the current development phase, keep `PAYMENT_PROVIDER=mock`. The checkout button uses the protected direct-purchase endpoint: it skips external money transfer but creates the real booking, paid-status record, inventory locks, invoice, QR pass, notifications and admin activity. This endpoint is rejected automatically in production.

Cashfree hosted checkout is implemented using its browser SDK and server-side order APIs. Configure these values in `server/.env`:

```env
PAYMENT_PROVIDER=cashfree
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_API_VERSION=2025-01-01
```

Whitelist the deployed client domain in the Cashfree merchant dashboard. After hosted checkout closes, the API fetches the Cashfree order and confirms the booking only when `order_status` is `PAID`. Use `CASHFREE_ENV=production` only with live credentials.

Configure the Cashfree webhook URL as `https://your-api-domain/api/payments/cashfree/webhook`. The server verifies `x-webhook-timestamp` and `x-webhook-signature` against the untouched raw body, deduplicates events and independently fetches the order before confirmation.

## Production checklist

- Configure HTTPS `CLIENT_URL`, MongoDB backups, SMTP, Cashfree, Gemini, the business WhatsApp number and the business contact variables.
- Review Privacy, Terms, cancellation/refund language, GST identity and jurisdiction with the business/legal team.
- Configure centralized logs and error monitoring on the deployment platform. API responses include request IDs, production startup rejects unsafe missing configuration, and scheduled jobs send reminders and complete elapsed bookings.

## Verification

Run `npm test` for booking-engine unit tests and `npm run build` for the production client build. The development payment adapter accepts only the explicit `development-approved` verification signature and is blocked in production.
