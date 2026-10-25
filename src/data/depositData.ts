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

export interface DepositMethod {
  id: string;
  label: string;
  timing: string;
}

// Local payment rails available per currency — not every rail exists for
// every currency/country, so the list narrows once a currency is picked.
export const DEPOSIT_METHODS: Record<DepositCurrency, DepositMethod[]> = {
  USD: [
    { id: "ach", label: "ACH Transfer", timing: "1–3 business days · no fee" },
    { id: "wire", label: "Wire Transfer", timing: "Same day · bank fees may apply" },
  ],
  EUR: [
    { id: "sepa", label: "SEPA", timing: "1 business day · no fee" },
    { id: "sepa_instant", label: "SEPA Instant", timing: "Within minutes · small fee" },
  ],
  GBP: [
    { id: "faster_payments", label: "Faster Payments", timing: "Within minutes · no fee" },
    { id: "wire", label: "Wire Transfer", timing: "Same day · bank fees may apply" },
  ],
  CAD: [
    { id: "interac", label: "Interac e-Transfer", timing: "Within minutes · small fee" },
    { id: "wire", label: "Wire Transfer", timing: "Same day · bank fees may apply" },
  ],
  CHF: [
    { id: "wire", label: "Wire Transfer (SWIFT)", timing: "1–2 business days · bank fees may apply" },
  ],
  INR: [
    { id: "upi", label: "UPI", timing: "Instant · no fee" },
    { id: "bank_transfer", label: "Bank Transfer (NEFT/RTGS)", timing: "Within hours · no fee" },
  ],
};

export interface FundingProvider {
  id: "plaid" | "revolut" | "wise";
  name: string;
  label: string;
  description: string;
}

export const FUNDING_PROVIDERS: FundingProvider[] = [
  { id: "plaid", name: "Plaid", label: "Connect a bank via Plaid", description: "Securely link your bank account" },
  { id: "revolut", name: "RevolutPay", label: "Pay with RevolutPay", description: "Fund instantly from your Revolut balance" },
  { id: "wise", name: "Wise", label: "Connect via Wise", description: "Transfer from your Wise balance" },
];
