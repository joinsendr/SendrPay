// Stellar network configuration — kept isolated from any future mainnet
// config so the two are never accidentally mixed (per project requirements).
export const STELLAR_NETWORK = "TESTNET";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Circle's official Stellar testnet USDC asset — verified against Circle's
// own developer docs (developers.circle.com/stablecoins/quickstart-transfer-usdc-stellar).
// A deposit is only ever credited if BOTH the asset code and this exact
// issuer match — matching on asset code alone would accept any token someone
// chooses to also name "USDC".
export const USDC_ASSET_CODE = "USDC";
export const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

// The demo wallet's single shared Stellar deposit address (public key only —
// the secret key lives only in the Lambda's environment, never here, never
// in the frontend, never in git). This is a known limitation documented in
// the README: one shared address for the whole demo, not per-user.
export const DEPOSIT_ADDRESS = process.env.STELLAR_DEPOSIT_ADDRESS || "";

export const LEDGER_TABLE = process.env.LEDGER_TABLE || "sendrpay_ledger";

// Illustrative only, not a live FX feed — mirrors the rate used by the
// existing frontend mock funding/payment flows, kept here so the backend's
// simulated entries use the exact same numbers the UI already shows.
export const MOCK_USDC_RATE = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  CHF: 1.12,
  INR: 1 / 85,
};
