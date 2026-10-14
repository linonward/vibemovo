import { cn } from "cn";

// The viewfinder corners in film amber around the pine brand dot, which
// leaves a short trail as it moves (docs/DESIGN.md, Logo). src/app/icon.svg
// draws the same shapes on a dark tile.
export const VIEWFINDER =
  "M4 11V7.5A3.5 3.5 0 0 1 7.5 4H11M21 4h3.5A3.5 3.5 0 0 1 28 7.5V11M28 21v3.5a3.5 3.5 0 0 1-3.5 3.5H21M11 28H7.5A3.5 3.5 0 0 1 4 24.5V21";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)}>
      <path d={VIEWFINDER} fill="none" strokeWidth={3} strokeLinecap="round" className="stroke-film" />
      <rect x={9} y={13.5} width={9} height={5} rx={2.5} className="fill-primary-text/35" />
      <circle cx={18} cy={16} r={5} className="fill-primary-text" />
    </svg>
  );
}
