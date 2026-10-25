import { useState } from "react";
import {
  User, ShieldCheck, Globe, LifeBuoy, FileText, ChevronRight, Check, LogOut,
} from "lucide-react";
import { ScreenHeader } from "../components/ScreenHeader";
import { Modal } from "../components/Modal";

const CURRENCIES = ["USD", "INR", "CAD", "EUR", "GBP", "CHF"] as const;

function InfoRow({
  Icon,
  label,
  value,
  onClick,
}: {
  Icon: React.ElementType;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-1 py-3.5 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-inset rounded-xl"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium text-neutral-900">{label}</span>
      {value && <span className="text-sm text-neutral-400">{value}</span>}
      <ChevronRight className="h-4 w-4 text-neutral-300" />
    </button>
  );
}

export function SettingsScreen() {
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("USD");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; body: string } | null>(null);

  return (
    <div className="animate-fade-up">
      <ScreenHeader title="Settings" />

      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white">
          <User className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Sendr Pay User</p>
          <p className="text-xs text-neutral-400">demo@sendr.cash</p>
        </div>
      </div>

      <div className="px-4">
        <div className="divide-y divide-neutral-100 border-t border-neutral-100">
          <InfoRow
            Icon={User}
            label="Account details"
            onClick={() => setInfoModal({ title: "Account details", body: "Profile editing isn't available in this prototype yet." })}
          />
          <InfoRow
            Icon={ShieldCheck}
            label="Security & verification"
            value="Not started"
            onClick={() => setInfoModal({ title: "Security & verification", body: "Identity verification will be required before real payments go live." })}
          />
          <InfoRow Icon={Globe} label="Display currency" value={currency} onClick={() => setCurrencyOpen(true)} />
          <InfoRow
            Icon={LifeBuoy}
            label="Help & support"
            onClick={() => setInfoModal({ title: "Help & support", body: "Contact hello@sendr.cash for anything related to Sendr Pay." })}
          />
          <InfoRow
            Icon={FileText}
            label="Terms & Privacy"
            onClick={() => setInfoModal({ title: "Terms & Privacy", body: "Sendr Pay follows Sendr's existing Terms of Service and Privacy Policy, available at sendr.cash." })}
          />
        </div>
      </div>

      <div className="px-5 pt-2 pb-6">
        <button
          type="button"
          onClick={() => setInfoModal({ title: "Sign out", body: "Sign-out will be available once accounts are connected." })}
          className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-700"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      <Modal open={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Display currency">
        <div className="space-y-1.5">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCurrency(c);
                setCurrencyOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              {c}
              {currency === c && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={!!infoModal} onClose={() => setInfoModal(null)} title={infoModal?.title ?? ""}>
        <p className="text-sm text-neutral-500">{infoModal?.body}</p>
        <button
          type="button"
          onClick={() => setInfoModal(null)}
          className="mt-5 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        >
          Got it
        </button>
      </Modal>
    </div>
  );
}
