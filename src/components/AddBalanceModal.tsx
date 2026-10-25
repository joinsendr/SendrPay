import { Sparkles } from "lucide-react";
import { Modal } from "./Modal";

export function AddBalanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add Balance">
      <div className="flex flex-col items-center py-4 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
          <Sparkles className="h-5 w-5 text-neutral-700" />
        </span>
        <p className="text-sm font-medium text-neutral-900">Wallet funding is coming soon</p>
        <p className="mt-1.5 max-w-[22rem] text-sm text-neutral-500">
          Adding USDC to your Sendr Pay wallet from a bank account or card will be available in a future version.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        Got it
      </button>
    </Modal>
  );
}
