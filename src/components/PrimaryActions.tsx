import { Plus, ScanLine } from "lucide-react";

export function PrimaryActions({
  onAddBalance,
  onPay,
}: {
  onAddBalance: () => void;
  onPay: () => void;
}) {
  return (
    <div className="flex gap-3 px-5 py-5">
      <button
        type="button"
        onClick={onAddBalance}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" />
        Add Balance
      </button>
      <button
        type="button"
        onClick={onPay}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-900 bg-white text-sm font-semibold text-neutral-900 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        <ScanLine className="h-4 w-4" />
        Pay
      </button>
    </div>
  );
}
