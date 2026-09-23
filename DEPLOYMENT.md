# Deploy The Work Suites

Repository: https://github.com/twstheworksuites-byte/The-Work-Suites

The React frontend runs on Vercel, the Express/Socket.IO backend runs on Render, and MongoDB runs on Atlas. You need an account on each service. Store database passwords and API secrets only in the hosting environment settings, never in GitHub or `VITE_` variables.

## 1. Create MongoDB Atlas

1. Create an Atlas project and database at https://cloud.mongodb.com/.
2. Create a database user with read/write access to `tws_workspace` and a unique password.
3. Under **Connect → Drivers**, copy the MongoDB connection string. Replace the password placeholder (URL-encode special characters), and include the database name before the query string:

   ```text
   mongodb+srv://USER:PASSWORD@YOUR-CLUSTER.mongodb.net/tws_workspace?retryWrites=true&w=majority
   ```

4. Add your computer's IP to Atlas Network Access for the initial seed. After creating Render, add the service's outbound IP ranges from its dashboard so the hosted API can reach Atlas.

## 2. Create the Vercel frontend

1. At https://vercel.com/new, import **twstheworksuites-byte/The-Work-Suites**.
2. Set **Root Directory** to `client`, **Framework Preset** to `Vite`, and Node.js to `24.x`.
3. The committed `client/vercel.json` sets install command `npm ci`, build command `npm run build`, output directory `dist`, and the React Router fallback.
4. Deploy and copy the production address, for example `https://YOUR-PROJECT.vercel.app`. The frontend can build before Render exists, but API-backed features will work only after step 4 below.

## 3. Create the Render backend

1. At https://dashboard.render.com/, choose **New → Blueprint** and connect this GitHub repository. Render reads the root `render.yaml`.
2. Fill in the prompted values:

   | Variable | Value |
   | --- | --- |
   | `MONGODB_URI` | Your Atlas connection string from step 1 |
   | `CLIENT_URL` | The Vercel production origin, e.g. `https://YOUR-PROJECT.vercel.app`, without a trailing slash |

3. Render generates `JWT_SECRET` and sets `NODE_ENV=production` and `PAYMENT_PROVIDER=disabled` automatically. Leave `PORT` unset; Render supplies it.
4. Add Render's outbound IP ranges to Atlas Network Access. If the initial deployment failed to connect, redeploy after updating Atlas.
5. Copy the actual Render address from the dashboard, for example `https://YOUR-API.onrender.com`. Open `https://YOUR-API.onrender.com/api/health`; it should return JSON with `status: "ok"` and `environment: "production"`.

If using **New → Web Service** instead of Blueprint, enter these settings manually:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Instance Type | Free for initial evaluation |

Set `NODE_VERSION=24.x`, `NODE_ENV=production`, `MONGODB_URI`, `CLIENT_URL`, `PAYMENT_PROVIDER=disabled`, and `JWT_SECRET` (at least 32 random characters). Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste it directly into Render.

## 4. Connect Vercel to Render

In Vercel **Project → Settings → Environment Variables**, add these for **Production**, using the actual Render address:

```text
VITE_API_URL=https://YOUR-API.onrender.com/api
VITE_SOCKET_URL=https://YOUR-API.onrender.com
```

The API URL includes `/api`; the Socket.IO URL does not. Neither should end with `/`. Redeploy Vercel after saving: Vite embeds these values at build time.

Add business details from `client/.env.example` as needed: `VITE_WHATSAPP_NUMBER` (country code and digits only), `VITE_BUSINESS_ADDRESS`, `VITE_BUSINESS_HOURS`, `VITE_BUSINESS_EMAIL`, and `VITE_BUSINESS_PHONE`.

When adding a custom frontend domain, update Render's `CLIENT_URL` too. Multiple allowed origins can be comma-separated without spaces or trailing slashes, with the canonical frontend origin first. Preview deployments need their exact origin added explicitly if they will use this API.

## 5. Seed inventory and the admin account once

The API does not automatically create the inventory or admin user. From this local checkout, copy `.env.example` to `server/.env` only if that file does not already exist. Edit `server/.env` locally to set the production Atlas `MONGODB_URI`, your `SEED_ADMIN_EMAIL`, and a strong unique `SEED_ADMIN_PASSWORD`.

After allowing your computer's IP in Atlas, run from the repository root:

```powershell
npm ci --prefix server
npm run seed
```

This populates the Atlas database used by Render. Use the seeded credentials at `/admin/login` on Vercel. Do not put `npm run seed` in Render's build or start command: rerunning the script resets seeded inventory and the admin password and normalizes user roles. Use it for initial setup of a new database only.

## 6. Enable production services

- **Email:** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` on Render for verification, password reset, and booking mail. Render free services block outbound SMTP ports 25, 465, and 587; use a provider-supported alternative such as 2525, or select a paid Render instance for standard SMTP ports.
- **Payments:** The initial configuration disables payment confirmation. To enable Cashfree, set `PAYMENT_PROVIDER=cashfree`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, and `CASHFREE_ENV` on Render. Use sandbox credentials first; use `CASHFREE_ENV=production` with live credentials when ready. Whitelist the frontend domain in Cashfree and configure `https://YOUR-API.onrender.com/api/payments/cashfree/webhook`. The development mock payment flow is blocked in production.
- **Assistant:** Add `GEMINI_API_KEY` and, if needed, `GEMINI_MODEL` on Render.
- **Business contact:** Add `BUSINESS_EMAIL` and `BUSINESS_PHONE` on Render for server-generated documents.

### Render free-service limitations

The Blueprint explicitly selects the free plan for initial evaluation. Free services sleep after inactivity, so the first request can be slow and the in-process booking reminder job does not run while the service sleeps. Use an always-on paid instance for live booking operations.

Admin workspace images are written to `server/uploads`. Render's ephemeral filesystem loses these files on restart or redeploy; images committed under `client/public/images` are unaffected. For durable admin uploads, select a paid Render instance and mount a persistent disk at `/opt/render/project/src/server/uploads`, or implement external object storage before relying on this feature. The Blueprint does not provision a paid instance or disk.

## 7. Check the deployment

1. Confirm the API health URL returns `status: "ok"`.
2. Open `/workspaces` and verify the seeded inventory loads.
3. Refresh `/admin/login` directly to verify Vercel routing.
4. Log in with the seeded admin account and confirm API requests go to Render, not localhost.
5. Confirm Socket.IO connects to Render and live availability updates arrive.
6. Test verification/password-reset email after SMTP is configured; test Cashfree sandbox checkout before accepting live payments.

For CORS errors, compare the browser's exact origin with Render's `CLIENT_URL`. For MongoDB startup timeouts, check Atlas credentials and network access. For a blank inventory, confirm the seed and Render use the same database name.

## Hosting documentation

- [Vercel: Vite deployment and SPA routing](https://vercel.com/docs/frameworks/frontend/vite)
- [Render: Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render: free-service limitations](https://render.com/docs/free)
- [Render: persistent disks](https://render.com/docs/disks)
