export function SplashScreen({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="animate-fade-in text-center">
        <span className="text-4xl font-extrabold tracking-tight text-neutral-900">
          sendr<span className="text-neutral-400">pay</span>
        </span>
      </div>
    </div>
  );
}
