import { useState } from "react";
import { ScanLine, Loader2 } from "lucide-react";
import { ScreenHeader } from "../components/ScreenHeader";

export function PayScreen() {
  const [scanning, setScanning] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  const handleScan = () => {
    setScanning(true);
    setShowNotice(false);
    window.setTimeout(() => {
      setScanning(false);
      setShowNotice(true);
    }, 1400);
  };

  return (
    <div className="animate-fade-up flex min-h-[calc(100%-4rem)] flex-col">
      <ScreenHeader title="Pay" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <div
          className={`relative mb-6 flex h-56 w-56 items-center justify-center rounded-3xl border-2 border-dashed transition-colors ${
            scanning ? "border-neutral-900" : "border-neutral-200"
          }`}
        >
          {scanning ? (
            <Loader2 className="h-10 w-10 animate-spin text-neutral-900" />
          ) : (
            <ScanLine className="h-12 w-12 text-neutral-300" />
          )}
          <span className="absolute left-4 top-4 h-6 w-6 rounded-tl-2xl border-l-2 border-t-2 border-neutral-900" />
          <span className="absolute right-4 top-4 h-6 w-6 rounded-tr-2xl border-r-2 border-t-2 border-neutral-900" />
          <span className="absolute bottom-4 left-4 h-6 w-6 rounded-bl-2xl border-b-2 border-l-2 border-neutral-900" />
          <span className="absolute bottom-4 right-4 h-6 w-6 rounded-br-2xl border-b-2 border-r-2 border-neutral-900" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-neutral-900">Pay like a local.</h1>
        <p className="mt-2 max-w-xs text-sm text-neutral-500">
          Scan a supported local payment QR code to get started.
        </p>

        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="mt-6 flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <ScanLine className="h-4 w-4" />
              Scan QR Code
            </>
          )}
        </button>

        <div className="mt-4 h-5">
          {showNotice && (
            <p className="animate-fade-in text-xs font-medium text-neutral-400">
              Payment functionality is coming soon.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
