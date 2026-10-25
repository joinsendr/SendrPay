import { ChevronLeft } from "lucide-react";

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header className="flex items-center gap-1.5 px-5 pt-5 pb-1">
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
      <h1 className="text-lg font-bold tracking-tight text-neutral-900">{title}</h1>
    </header>
  );
}
