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
- DynamoDB (single table, `sendrpay_ledger`) as the ledger — idempotent writes via conditional `PutItem`
- EventBridge scheduled rule (every 1 minute) polling Stellar Horizon testnet for new deposits
- `@stellar/stellar-sdk` for Horizon queries and asset/transaction validation

## What's real vs. simulated

| Flow | Status | Detail |
|---|---|---|
| **USDC deposit (Stellar)** | **Real, on-chain** | You send actual testnet USDC to the wallet's Stellar address. The backend polls Horizon, verifies transaction success, asset code **and issuer**, and credits the ledger — never trusting client input. Idempotent: the same transaction hash can never be credited twice. |
| **Fiat funding** (bank transfer, card, etc.) | Simulated | Clearly labeled "Demo — Fiat funding" in the UI. Instantly credits the mock ledger with no real money movement. |
| **Local/UPI/Interac/SEPA payment (Pay flow)** | Simulated | Clearly labeled "Simulated" in the UI, with an illustrative fee/conversion-rate breakdown. Debits the ledger balance (server-side, with an insufficient-balance check) but does not move real funds. |
| **Wallet balance** | Real (server-computed) | Always computed server-side by summing confirmed ledger entries — the frontend never sets or trusts a client-provided balance. |

The app displays a persistent banner reiterating this distinction at all times.

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
| `POST` | `/payments/simulate` | Creates a simulated payment ledger entry (rejects with `400 insufficient_balance` if the balance is too low) |

### Deposit verification logic (`backend/src/depositValidation.mjs`)

A payment operation from Horizon is only credited if **all** of the following hold:
1. It is a `payment` operation to the wallet's deposit address.
2. The source transaction succeeded (`transaction_successful === true`).
3. The asset is non-native (not raw XLM).
4. The asset code matches `USDC` **and** the asset issuer matches Circle's official testnet USDC issuer (`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) — matching on asset code alone would accept any lookalike token.
5. The amount is a positive, finite number.

Each accepted deposit is written to DynamoDB with the transaction hash as (part of) its primary key and a conditional `attribute_not_exists` write, so re-polling the same transaction can never double-credit it.

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
npm test        # node --test test/*.test.mjs — validation unit tests
```

The backend is deployed as a Lambda (see [Deploying the backend](#deploying-the-backend)) — there is no local server to run it against live AWS resources, since it depends on DynamoDB and EventBridge. Unit tests cover the pure validation/credit logic without needing live AWS access.

### Required environment variables (backend, set on the Lambda)

| Variable | Purpose |
|---|---|
| `STELLAR_DEPOSIT_ADDRESS` | The wallet's Stellar testnet public key that deposits are verified against |
| `LEDGER_TABLE` | DynamoDB table name (defaults to `sendrpay_ledger` if unset) |

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

1. Open [sendrpay.sendr.cash](https://sendrpay.sendr.cash) — note the persistent banner explaining real vs. simulated flows.
2. Tap **Add Balance → USDC on Stellar**. A real Stellar testnet deposit address and QR code are shown, along with the exact asset code and issuer the backend will verify against.
3. From a Stellar testnet wallet (e.g. a browser extension wallet or the Stellar Laboratory) holding testnet USDC, send a small amount to the displayed address.
4. Watch the modal — it polls automatically every few seconds and, once the backend's deposit check picks up the transaction, flips to a **"Deposit confirmed"** view showing the credited amount and a link to the transaction on [Stellar Expert](https://stellar.expert/explorer/testnet).
5. Return to Home — the wallet balance has updated, computed entirely server-side from the ledger (not from anything the browser sent).
6. Tap **Add Balance → a fiat option** (e.g. a card or bank rail) to see the clearly-labeled **"Demo — Fiat funding"** flow credit the balance instantly, with no pretense of a real transfer.
7. Tap **Pay**, pick a currency/country/local payment method (e.g. UPI, Interac), and complete a payment. The flow is labeled **"Simulated"** throughout, shows an illustrative fee/rate breakdown, and is rejected with an insufficient-balance error if attempted beyond the current balance.
8. Open any transaction's detail view — on-chain deposits show a **"Verified on-chain"** badge with a working link to the real Stellar testnet explorer; simulated entries show a **"Simulated"** badge and explicitly say so in the footer copy.

## Known limitations

- **One shared deposit address for the whole demo wallet**, not a unique address per user — fine for a hackathon demo, not how a production custodial or non-custodial wallet would work.
- **No authentication** — the wallet is a single shared instance with no per-user accounts, matching the "lighter version" scope of this prototype.
- **Deposit detection latency**: up to ~1 minute (the EventBridge polling interval), plus the manual poll triggered by the UI every few seconds while the deposit modal is open.
- **Fiat and local-payout rails are entirely simulated** — no KYC, no licensed payment partner, no real money movement. This must not be presented as a working payment product.
- **No reversal/dispute flow implemented** — the ledger schema supports a `reversed` status but nothing currently transitions an entry into it.
