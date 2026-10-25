export function ScreenHeader({ title }: { title: string }) {
  return (
    <header className="px-5 pt-5 pb-1">
      <h1 className="text-lg font-bold tracking-tight text-neutral-900">{title}</h1>
    </header>
  );
}
