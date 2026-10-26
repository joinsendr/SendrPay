import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft } from "lucide-react";

export function Modal({
  open,
  onClose,
  onBack,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Rendered via a portal straight to <body> — not just a stylistic choice.
  // Any ancestor with a non-"none" transform (e.g. our own screen-entrance
  // `.animate-fade-up`, whose *finished* state is `transform: translateY(0)`,
  // not `none`) becomes a CSS containing block for `position: fixed`
  // descendants. Without the portal, this modal would be positioned relative
  // to that small animated wrapper instead of the real viewport, pushing
  // tall content off-screen above y=0 with no way to scroll back up to it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 animate-fade-in"
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-sm animate-fade-up flex-col rounded-t-3xl border border-neutral-200 bg-white shadow-xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-1.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="flex h-8 w-8 -ml-1.5 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
