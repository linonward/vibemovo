import { cn } from "cn";

// Eyebrow + mono title (docs/DESIGN.md, Typography).
export function SectionHeading({
  eyebrow,
  id,
  center = false,
  children,
}: {
  eyebrow: string;
  id: string;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3", center && "items-center text-center")}>
      <p className="eyebrow">{eyebrow}</p>
      <h2
        id={id}
        className="display-tight font-display text-3xl leading-tight font-bold text-balance sm:text-4xl"
      >
        {children}
      </h2>
    </div>
  );
}

// Soft radial glow behind a heading. The parent needs `relative isolate`.
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-1/2 -z-10 h-72 w-[min(44rem,100%)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--primary-text),transparent)] opacity-15 blur-2xl",
        className,
      )}
    />
  );
}
