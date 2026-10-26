# Sendr Pay

A cross-border payment wallet prototype built for HackMeridian 2026 — pay local merchants abroad using a USDC-denominated wallet, funded with **real Stellar testnet USDC deposits**, verified on-chain by a backend ledger.

Live at [sendrpay.sendr.cash](https://sendrpay.sendr.cash).

> **This is a testnet demo, not a product.** USDC deposits are real Stellar *testnet* transactions with zero monetary value. Fiat funding and local payouts (UPI, Interac, SEPA, etc.) are simulated — no money moves and no licensed payment partner is connected. See [What's real vs. simulated](#whats-real-vs-simulated) below.

## Stack

**Frontend**
- React 19 + TypeScript + Vite
- Tailwind CSS v4
- lucide-react icons, qrcode.react

**Backend** (`backend/`)
- AWS Lambda (Node.js 22.x, ESM), behind an API Gateway HTTP API
- DynamoDB: `sendrpay_ledger` (the transaction ledger) and `sendrpay_payments` (the UPI payment orchestrator's state machine) — idempotent writes via conditional `PutItem`/`UpdateItem`
- EventBridge scheduled rule (every 1 minute) polling Stellar Horizon testnet for new deposits
- `@stellar/stellar-sdk` for Horizon queries and asset/transaction validation

## What's real vs. simulated

| Flow | Status | Detail |
|---|---|---|
| **USDC deposit (Stellar)** | **Real, on-chain** | You send actual testnet USDC to the wallet's Stellar address. The backend polls Horizon, verifies transaction success, asset code **and issuer**, and credits the ledger — never trusting client input. Idempotent: the same transaction hash can never be credited twice. |
| **Fiat funding** (bank transfer, card, etc.) | Simulated | Instantly credits the ledger with no real money movement. |
| **UPI QR payment** (Pay → scan a UPI QR code) | **Real orchestration, simulated payout leg** | Real camera/upload QR scanning and UPI URI parsing, a real backend payment-lifecycle state machine, and a real ledger deduction — but the actual India-side payout is handled by a simulated adapter (`backend/src/indiaPayoutAdapter.mjs`), since no licensed UPI payout provider is connected. No real INR moves and no real UPI payment is executed. |
| **Other local payment methods** (Interac, SEPA, Zelle, etc. in the generic Pay flow) | Simulated | Illustrative fee/conversion-rate breakdown. Debits the ledger balance (server-side, with an insufficient-balance check) but does not move real funds. |
| **Wallet balance** | Real (server-computed) | Always computed server-side by summing confirmed ledger entries — the frontend never sets or trusts a client-provided balance. |

The UI does not visually distinguish real vs. simulated transactions (by request) — this table is the authoritative reference for what each transaction type actually does under the hood. The ledger itself still tags every entry with its real `type` (`stellar_deposit`, `upi_payment`, `simulated_fiat`, `simulated_payment`, `upi_payment_reversal`), visible via the `/wallet` API response.

## Pricing

| Flow | Fee | Why |
|---|---|---|
| USDC deposit on Stellar (direct) | **None** | No conversion needed — it's already USDC. |
| Fiat funding (card/bank rail) | **0.5%** flat, deducted from the converted USDC before crediting | Deliberate incentive to fund with USDC directly instead of through a fiat rail — see `FIAT_CONVERSION_FEE_RATE` in `backend/src/config.mjs`. Shown as a full Converted/Fee/You'll-receive breakdown before the user commits. |
| UPI payment (Pay → scan or enter a UPI ID) | **1%** flat on the USDC side | See `UPI_FEE_RATE` in `backend/src/config.mjs`. Shown on the review screen before confirming. |
| Other local payment methods (Interac, SEPA, etc.) | None currently modeled | Not part of this pricing pass. |

Both rates are illustrative/configurable constants for this hackathon prototype, unrelated to and not sourced from the actual pricing used by the live [sendr.cash](https://sendr.cash) product.

### Funding from your own wallet

Inside **Add Balance → USDC on Stellar**, beyond scanning the QR code, there's a **"Connect your wallet to pay directly"** option backed by [Stellar Wallets Kit](https://stellarwalletskit.dev) (`src/lib/walletKit.ts`). It supports Freighter, xBull, Albedo, Rabet, Lobstr, and other Stellar wallets — the connected wallet signs a real USDC payment to the deposit address, which the app submits to Horizon and your backend verifies exactly like any other deposit. The app only ever asks the wallet to sign a transaction it never receives or stores the user's secret key.

## Architecture

```
┌─────────────────┐      HTTPS       ┌──────────────────────┐
│  React frontend  │ ───────────────▶│  API Gateway (HTTP)  │
│ sendrpay.sendr.  │                  └──────────┬───────────┘
│     cash         │                             │
└─────────────────┘                   ┌──────────▼───────────┐
                                       │   Lambda: sendrpay-api│
                                       │  (handler.mjs)        │
                                       └──────────┬───────────┘
                                                   │
                         ┌─────────────────────────┼─────────────────────┐
                         ▼                         ▼                     ▼
                ┌────────────────┐      ┌────────────────────┐  ┌─────────────────┐
                │ DynamoDB        │      │ Stellar Horizon     │  │ EventBridge rule │
                │ sendrpay_ledger │      │ (testnet, read-only)│  │ rate(1 minute)   │
                └────────────────┘      └────────────────────┘  │ → triggers Lambda │
                                                                  │   deposit polling │
                                                                  └─────────────────┘
```

### API routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/wallet` | Server-computed balance + full transaction/ledger history |
| `GET` | `/wallet/address` | The wallet's Stellar deposit address + expected asset/issuer |
| `POST` | `/deposits/check` | Forces an immediate poll of Horizon for new deposits (also run automatically every minute by EventBridge) |
| `POST` | `/funding/simulate` | Creates a simulated fiat funding ledger entry |
| `POST` | `/payments/simulate` | Legacy simulated payment entry used by the generic (non-UPI) Pay flow (rejects with `400 insufficient_balance` if the balance is too low) |
| `POST` | `/payments` | **UPI payment orchestrator** — creates, validates, and quotes a payment (`qrData` raw UPI URI, or manual `vpa`/`amountInr`). `paymentId` is a caller-supplied idempotency key. Returns `201` + `status: "awaiting_confirmation"` on success, `400` + `status: "failed"` + `failureReason` on rejection (invalid QR, missing amount, insufficient balance). |
| `GET` | `/payments/{paymentId}` | Fetch a payment's current state |
| `POST` | `/payments/{paymentId}/confirm` | Moves `awaiting_confirmation` → `processing` → (simulated India payout) → `succeeded`/`failed`. Only a payout success writes a ledger deduction. Idempotent — re-confirming a terminal payment just returns it unchanged. |
| `POST` | `/payments/{paymentId}/cancel` | Cancels a payment still in `awaiting_confirmation`; no-op otherwise |
| `POST` | `/payments/{paymentId}/reverse` | Reverses a `succeeded` payment, crediting back the full deducted amount as a new `upi_payment_reversal` ledger entry (the original debit entry is never deleted or edited — full audit trail) |

### Deposit verification logic (`backend/src/depositValidation.mjs`)

A payment operation from Horizon is only credited if **all** of the following hold:
1. It is a `payment` operation to the wallet's deposit address.
2. The source transaction succeeded (`transaction_successful === true`).
3. The asset is non-native (not raw XLM).
4. The asset code matches `USDC` **and** the asset issuer matches Circle's official testnet USDC issuer (`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) — matching on asset code alone would accept any lookalike token.
5. The amount is a positive, finite number.

Each accepted deposit is written to DynamoDB with the transaction hash as (part of) its primary key and a conditional `attribute_not_exists` write, so re-polling the same transaction can never double-credit it.

### UPI payment orchestrator (`backend/src/payments.mjs`)

Handles the full lifecycle of a UPI QR payment:

```
created → validated → awaiting_confirmation → processing → succeeded | failed
          (any of the first three) → cancelled        succeeded → reversed
```

- `created`/`validated` happen synchronously inside the single `createPayment()` call (their timestamps — `createdAt`/`validatedAt` — are recorded even though the client only ever observes the resulting `awaiting_confirmation` or `failed` state).
- **QR parsing** (`backend/src/upi.mjs`) extracts the payee VPA, name, amount (if the QR encodes one), and currency from a `upi://pay?...` URI, rejecting malformed URIs, non-`pay` UPI actions, invalid VPAs, and non-INR currencies. The frontend does its own lightweight parse too (`src/lib/upiParser.ts`), but only to decide what to show the user before the network round-trip — the backend's parse of the raw QR string is what's actually authoritative and billed against.
- **Idempotency**: `paymentId` is a client-generated UUID that doubles as the idempotency key for creation (a conditional `PutItem` — a retried create with the same ID returns the original record rather than creating a duplicate or re-quoting against a possibly-changed balance). Every status transition (`confirm`, `cancel`, `reverse`) is a conditional `UpdateItem` keyed on the current status, so the same payment can never be processed twice even under a retried or doubled request.
- **Balance enforcement**: checked once at quote time and again immediately before the ledger deduction is written at confirm time. This narrows, but does not fully eliminate, a race between two concurrent payments from the same wallet reading a stale balance — see [Known limitations](#known-limitations).
- **India payout** (`backend/src/indiaPayoutAdapter.mjs`) is a simulated provider behind a clean interface (`{vpa, amountInr, paymentId} → {success, payoutReference, timestamp}`) — swapping in a real licensed payout provider later means implementing this same shape, nothing upstream changes.
- Only a successful simulated payout ever writes a ledger entry (`type: "upi_payment"`, keyed `upi:<paymentId>` for the same conditional-put idempotency guarantee used by deposits). A failed payout leaves the payment `failed` with **no** ledger entry and **no** deduction.

## Local development

### Frontend

```bash
npm install
npm run dev
```

Runs against the live backend at `https://govki2oce0.execute-api.us-east-1.amazonaws.com` (see `src/lib/api.ts`). No env vars are required to run the frontend — the API base URL is currently hard-coded there.

### Backend

```bash
cd backend
npm install
npm test        # node --test test/*.test.mjs
```

The backend is deployed as a Lambda (see [Deploying the backend](#deploying-the-backend)) — there is no local server to run it against live AWS resources, since it depends on DynamoDB and EventBridge.

Tests are a mix of:
- **Pure unit tests** (`depositValidation.test.mjs`, `upi.test.mjs`, `indiaPayoutAdapter.test.mjs`) — no AWS access needed.
- **Integration tests** (`payments.test.mjs`) — exercise the real DynamoDB-backed orchestrator end to end (create → confirm → reverse, duplicate requests, insufficient balance, payout failure, cancellation). These run against **dedicated test tables** (`sendrpay_ledger_test` / `sendrpay_payments_test`), provisioned alongside the production tables, so `npm test` never writes into the live demo wallet at sendrpay.sendr.cash. Requires AWS credentials with access to those two tables.

### Required environment variables (backend, set on the Lambda)

| Variable | Purpose |
|---|---|
| `STELLAR_DEPOSIT_ADDRESS` | The wallet's Stellar testnet public key that deposits are verified against |
| `LEDGER_TABLE` | DynamoDB table name for the ledger (defaults to `sendrpay_ledger` if unset) |
| `PAYMENTS_TABLE` | DynamoDB table name for the payment orchestrator (defaults to `sendrpay_payments` if unset) |

No Stellar *secret* key is used by the backend — deposit verification is read-only against Horizon, so no signing key is needed or stored anywhere (not in Lambda env vars, not in the frontend, not in git).

## Setting up your own Stellar testnet wallet

1. Generate a keypair (e.g. with `@stellar/stellar-sdk`'s `Keypair.random()`).
2. Fund it on testnet via [Friendbot](https://friendbot.stellar.org) (`GET https://friendbot.stellar.org?addr=<PUBLIC_KEY>`) — this creates the account and gives it testnet XLM for fees.
3. Establish a trustline to Circle's testnet USDC asset (code `USDC`, issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) via a `ChangeTrust` operation — an account cannot hold a non-native asset without one.
4. Set `STELLAR_DEPOSIT_ADDRESS` (backend) to the new public key.

### Getting testnet USDC to deposit

Circle does not run a public testnet USDC faucet for Stellar; testnet USDC is typically obtained by swapping testnet XLM for it on a testnet DEX, or from another testnet account that already holds some. See [Circle's Stellar testnet docs](https://developers.circle.com/stablecoins/quickstart-transfer-usdc-stellar) for current guidance.

## Deploying the backend

```bash
cd backend
npm install --omit=dev
# zip src/ + node_modules/ + package.json into a deployment package, then:
aws lambda update-function-code --function-name sendrpay-api --zip-file fileb://sendrpay-lambda.zip
```

The Lambda is already wired to API Gateway (HTTP API, Lambda proxy integration) and an EventBridge rule (`sendrpay-check-deposits`, `rate(1 minute)`) that invokes it with `{"source": "aws.events"}` to trigger deposit polling. Both are provisioned in AWS already; redeploying only updates the function code.

## Build & deploy (frontend)

```bash
npm run build   # tsc -b && vite build
npm run deploy  # build + sync to S3 + CloudFront invalidation
```

Hosted on AWS S3 (`sendrpay.sendr.cash` bucket) + CloudFront, same pattern as [sendr.cash](https://sendr.cash).

## Judge demo flow

1. Open [sendrpay.sendr.cash](https://sendrpay.sendr.cash).
2. Tap **Add Balance → USDC on Stellar**. A real Stellar testnet deposit address and QR code are shown, along with the exact asset code and issuer the backend will verify against.
3. From a Stellar testnet wallet (e.g. a browser extension wallet or the Stellar Laboratory) holding testnet USDC, send a small amount to the displayed address.
4. Watch the modal — it polls automatically every few seconds and, once the backend's deposit check picks up the transaction, flips to a **"Deposit confirmed"** view showing the credited amount and a link to the transaction on [Stellar Expert](https://stellar.expert/explorer/testnet).
5. Return to Home — the wallet balance has updated, computed entirely server-side from the ledger (not from anything the browser sent).
6. Tap **Add Balance → a fiat option** (e.g. a card or bank rail) to see the fiat funding flow credit the balance instantly.
7. Tap **Pay → INR → UPI**. Scan (or upload an image of) a UPI QR code — a generator like `https://www.the-qrcode-generator.com` with a `upi://pay?pa=someone@okaxis&pn=Name&am=25&cu=INR` payload works well for a demo QR — or tap **"Don't have a QR code? Enter UPI ID manually"** to type a UPI ID, payee name, and amount directly. The review screen shows the payee, amount, illustrative conversion rate, the 1% fee, and total deduction before anything is committed.
8. Confirm the payment — it's processed through the real backend orchestrator (create → confirm → simulated payout → ledger deduction) and shows a payment ID and payout reference on success.
9. Open the new transaction's detail view, or hit `GET /payments/{paymentId}` directly, to see the full lifecycle record.
10. Try scanning a non-UPI QR code (any ordinary URL) to show the reject path, and try a payment larger than the current balance to show the insufficient-balance rejection.

## Known limitations

- **One shared deposit address for the whole demo wallet**, not a unique address per user — fine for a hackathon demo, not how a production custodial or non-custodial wallet would work.
- **No authentication** — the wallet is a single shared instance with no per-user accounts (every payment is attributed to a constant `userId: "demo-wallet"`), matching the "lighter version" scope of this prototype. A real deployment needs this before anything else.
- **Deposit detection latency**: up to ~1 minute (the EventBridge polling interval), plus the manual poll triggered by the UI every few seconds while the deposit modal is open.
- **Fiat funding and non-UPI local payout rails are entirely simulated** — no KYC, no licensed payment partner, no real money movement.
- **UPI payments have a real orchestrator and a real ledger deduction, but a simulated payout leg** — no licensed UPI/India payout provider is connected (`backend/src/indiaPayoutAdapter.mjs`), so no real INR is ever sent and no real UPI payment is ever executed, regardless of what the simulated adapter reports.
- **Balance-reservation race window**: balance is checked at quote time and again at confirm time, but at this prototype's scan-based-balance scale there's no atomic cross-request reservation — two concurrent payments from the same wallet could theoretically both pass their balance checks before either's deduction lands. Not a concern at single-demo-wallet, sequential-usage scale; would need an atomic conditional counter (or a real ledger/accounting system) before handling genuine concurrent load.
- **No real UPI provider integration exists yet** — before real UPI/INR payments could be enabled: a licensed payment aggregator/PSP for India (e.g. a regulated UPI payment gateway) must be onboarded and KYC'd, `indiaPayoutAdapter.mjs`'s interface implemented against their real API, the USDC→INR conversion rate replaced with a live FX feed, real compliance/AML checks added, and the no-auth single-wallet model replaced with real per-user accounts and authentication.
