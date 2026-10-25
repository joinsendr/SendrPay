import { Home, Wallet, ScanLine, Settings } from "lucide-react";
import type { TabKey } from "../types";

const TABS: { key: TabKey; label: string; Icon: React.ElementType }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "wallet", label: "Wallet", Icon: Wallet },
  { key: "pay", label: "Pay", Icon: ScanLine },
  { key: "settings", label: "Settings", Icon: Settings },
];

export function BottomNavigation({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav
      className="sticky bottom-0 z-30 border-t border-neutral-100 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-inset"
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-neutral-900" : "text-neutral-300"}`} strokeWidth={isActive ? 2.3 : 2} />
              <span className={isActive ? "text-neutral-900" : "text-neutral-300"}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
