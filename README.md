# GhostPay

Mobile-first GhostPay frontend built with React, Vite, TypeScript, and Supabase Auth.

## Start locally

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon key.
2. Install dependencies with `pnpm install`.
3. Run `pnpm dev` and open the local URL printed by Vite.

The client stores `alias_handle` without the `@` prefix; the UI adds `@` when it displays or shares the link. The anon key is safe to expose in the browser only because database access is controlled by the Phase 1 grants and RLS policies. Never add a Supabase service-role key to a `VITE_` environment variable.

## Payment functions

The public payment page currently uses a Supabase-backed frontend simulation. After amount validation, clicking Pay inserts a constrained `simulated` record into `demo_transactions`, waits two seconds, and routes to `/payment/success`. It does not create or update a real `transactions` row and does not call an Edge Function or payment gateway. The dashboard reads both tables from Supabase and keeps demo totals separate from actual payouts. The success screen identifies the result as simulated; no money moves. Apply `supabase/migrations/20261012000001_demo_transactions.sql` in the Supabase SQL Editor before using this flow. The migration exposes only the public user ID and alias needed for checkout; private banking columns remain unavailable to anonymous roles.

The dashboard profile editor and live theme preference require `supabase/migrations/20261012000002_profile_editor.sql`. It adds an avatar field and allows authenticated users to read and update only their own private profile row; anonymous visitors can still read public aliases only. The dashboard includes a short rocket animation and synthesized Web Audio chime for demo checkout completion. Theme choice is saved in browser local storage.

The Vercel deployment applies a restrictive Content Security Policy and standard browser security headers. The simulated success page offers a printable receipt through the browser's native print-to-PDF flow; it is clearly marked as a demo and does not represent a collected payment.

The `create-payment` Edge Function remains as the separate Cashfree integration source for a future production checkout. It creates a `pending_collection` transaction, requires creator KYC, creates a Cashfree Payment Gateway order, and returns its payment session ID. The current frontend does not call it.

The `payment-success` function verifies Cashfree's webhook signature against the unmodified request body, validates the order ID, amount, currency, and current transaction status, changes the transaction to `escrowed`, reads the payout destination with the service role, and submits an idempotent UPI transfer to Cashfree Payouts. It only changes the status to `payout_successful` when Cashfree reports `SUCCESS`; `RECEIVED`/pending transfers stay `escrowed` and receive a non-2xx response so Cashfree can retry and the handler can reconcile status. Do not treat API acceptance as final settlement.

Copy `supabase/functions/.env.example` to `supabase/functions/.env` for local Edge Function development. For a hosted project, set the same values as Supabase Function secrets. Keep these credentials server-side. Set `PUBLIC_APP_URL` to the exact frontend origin, `CASHFREE_ENV=sandbox` while using test keys, and switch the API keys and environment together for production. Cashfree Payouts may also require merchant-side API/IP allowlisting to permit calls from the deployed function.

Deploy with the Supabase CLI after linking your project:

```sh
supabase functions deploy create-payment
supabase functions deploy payment-success
```

Configure Cashfree Payment Gateway's `PAYMENT_SUCCESS_WEBHOOK` to `https://<project-ref>.supabase.co/functions/v1/payment-success`. Guest checkout also requires an active, KYC-verified creator profile.

## Routes

- `/login` — existing account sign in.
- `/signup` — Supabase account creation.
- `/onboarding` — public alias and private payout identity setup.
- `/dashboard` — shielded link, payout total, and recent transactions.
- `/:handle` — public guest payment page, including aliases such as `/@god`.
- `/payment/success` — simulated checkout success page.

The guest payment page reads the public alias and user ID needed to render checkout. The demo insert works without an Edge Function deployment after the demo-table migration has been applied.
