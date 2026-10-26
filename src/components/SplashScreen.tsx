export function SplashScreen({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="px-6 text-center">
        <p className="animate-fade-in mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-neutral-400">
          Introducing
        </p>
        <h1
          className="animate-fade-up text-[3.25rem] font-extrabold leading-[1.05] tracking-tight text-neutral-900"
          style={{ animationDelay: "150ms" }}
        >
          Sendr <span className="text-neutral-400">Pay</span>
        </h1>
      </div>
    </div>
  );
}
