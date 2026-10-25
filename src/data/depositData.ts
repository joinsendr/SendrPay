export const DEPOSIT_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "CHF", "INR"] as const;
export type DepositCurrency = (typeof DEPOSIT_CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<DepositCurrency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "$",
  CHF: "CHF",
  INR: "₹",
};

// Illustrative only, not a live exchange rate — same approach as the INR
// balance equivalent shown on the wallet screen. Used to convert a deposit
// in the funding currency into the USDC amount credited to the wallet.
export const MOCK_USDC_RATE: Record<DepositCurrency, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  CHF: 1.12,
  INR: 1 / 85,
};

export type FundingIcon = "bank" | "instant" | "wise" | "plaid";

export interface FundingOption {
  id: string;
  label: string;
  timing: string;
  icon: FundingIcon;
}

// Each currency only shows the rails/providers that actually exist for it —
// e.g. Interac is Canada-only, UPI is India-only, Plaid mainly covers US
// bank linking.
export const FUNDING_OPTIONS: Record<DepositCurrency, FundingOption[]> = {
  USD: [
    { id: "ach", label: "ACH Transfer", timing: "1–3 business days · no fee", icon: "bank" },
    { id: "wire", label: "Wire Transfer", timing: "Same day · bank fees may apply", icon: "bank" },
    { id: "plaid", label: "Connect a bank via Plaid", timing: "Instant link · secure", icon: "plaid" },
  ],
  CAD: [
    { id: "eft", label: "EFT", timing: "1–2 business days · no fee", icon: "bank" },
    { id: "interac", label: "Interac e-Transfer", timing: "Within minutes · small fee", icon: "instant" },
    { id: "wise", label: "Connect via Wise", timing: "Transfer from your Wise balance", icon: "wise" },
  ],
  EUR: [
    { id: "sepa", label: "SEPA", timing: "1 business day · no fee", icon: "bank" },
    { id: "sepa_instant", label: "SEPA Instant", timing: "Within minutes · small fee", icon: "instant" },
    { id: "wise", label: "Connect via Wise", timing: "Transfer from your Wise balance", icon: "wise" },
  ],
  GBP: [
    { id: "faster_payments", label: "Faster Payments", timing: "Within minutes · no fee", icon: "instant" },
    { id: "wire", label: "Wire Transfer", timing: "Same day · bank fees may apply", icon: "bank" },
    { id: "wise", label: "Connect via Wise", timing: "Transfer from your Wise balance", icon: "wise" },
  ],
  CHF: [
    { id: "wire", label: "Wire Transfer (SWIFT)", timing: "1–2 business days · bank fees may apply", icon: "bank" },
    { id: "wise", label: "Connect via Wise", timing: "Transfer from your Wise balance", icon: "wise" },
  ],
  INR: [
    { id: "upi", label: "UPI", timing: "Instant · no fee", icon: "instant" },
    { id: "bank_transfer", label: "Bank Transfer (NEFT/RTGS)", timing: "Within hours · no fee", icon: "bank" },
  ],
};
