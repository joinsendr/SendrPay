import { User } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-2">
      <span className="text-lg font-extrabold tracking-tight text-neutral-900">
        Sendr<span className="text-neutral-400">Pay</span>
      </span>
      <button
        type="button"
        aria-label="Account"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        <User className="h-4 w-4" />
      </button>
    </header>
  );
}
