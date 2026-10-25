import type { DepositCurrency } from "./depositData";

export type PayCurrency = DepositCurrency;
export const PAY_CURRENCIES: PayCurrency[] = ["INR", "EUR", "GBP", "CAD", "CHF", "USD"];

export type PayInputMode = "qr" | "phone";

export interface PayMethod {
  id: string;
  label: string;
  inputMode: PayInputMode;
}

// Non-EUR currencies map straight to one country and its local instant
// payment rail(s) — no extra country-picking step needed.
export const PAY_COUNTRY_BY_CURRENCY: Partial<Record<PayCurrency, { country: string; methods: PayMethod[] }>> = {
  INR: { country: "India", methods: [{ id: "upi", label: "UPI", inputMode: "qr" }] },
  CAD: { country: "Canada", methods: [{ id: "interac", label: "Interac", inputMode: "qr" }] },
  USD: { country: "United States", methods: [{ id: "zelle", label: "Zelle", inputMode: "phone" }] },
  GBP: { country: "United Kingdom", methods: [{ id: "faster_payments", label: "Faster Payments", inputMode: "phone" }] },
  CHF: { country: "Switzerland", methods: [{ id: "twint", label: "TWINT", inputMode: "qr" }] },
};

export interface EuCountry {
  code: string;
  name: string;
  methods: PayMethod[];
}

// EUR spans many countries, each with its own local instant payment app —
// picking EUR adds this extra step instead of assuming one country.
export const EU_COUNTRIES: EuCountry[] = [
  { code: "PT", name: "Portugal", methods: [{ id: "mbway", label: "MB WAY", inputMode: "phone" }] },
  { code: "ES", name: "Spain", methods: [{ id: "bizum", label: "Bizum", inputMode: "phone" }] },
  { code: "IT", name: "Italy", methods: [{ id: "bancomat_pay", label: "Bancomat Pay", inputMode: "qr" }] },
  { code: "DE", name: "Germany", methods: [{ id: "giropay", label: "Giropay", inputMode: "qr" }] },
  { code: "NL", name: "Netherlands", methods: [{ id: "ideal", label: "iDEAL", inputMode: "qr" }] },
  { code: "BE", name: "Belgium", methods: [{ id: "payconiq", label: "Payconiq", inputMode: "qr" }] },
  { code: "FR", name: "France", methods: [{ id: "paylib", label: "Paylib", inputMode: "phone" }] },
  { code: "PL", name: "Poland", methods: [{ id: "blik", label: "BLIK", inputMode: "qr" }] },
];
