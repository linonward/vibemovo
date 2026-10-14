import { cn } from "cn";
import type { CSSProperties } from "react";

// CSS stand-ins for generated images, one per sample prompt. Each is a
// background plus a few clipped shapes. Replace them with real <Image>s of
// work made with the product.
type Layer = CSSProperties;

const SCENES = {
  // A paper boat on a neon canal at dusk.
  canal: {
    background: [
      "radial-gradient(55% 40% at 72% 28%, oklch(0.72 0.17 350 / 0.6), transparent 70%)",
      "radial-gradient(45% 35% at 22% 32%, oklch(0.8 0.12 200 / 0.5), transparent 70%)",
      "repeating-linear-gradient(90deg, transparent 0 14px, oklch(0.85 0.12 350 / 0.14) 14px 16px, transparent 16px 26px, oklch(0.85 0.1 200 / 0.12) 26px 28px) 0 100% / 100% 46% no-repeat",
      "linear-gradient(180deg, oklch(0.24 0.07 285), oklch(0.32 0.09 310) 53%, oklch(0.17 0.05 265) 54%, oklch(0.11 0.03 250))",
    ].join(", "),
    layers: [
      { clipPath: "polygon(0 54%, 0 20%, 9% 20%, 9% 34%, 17% 34%, 17% 12%, 26% 12%, 26% 54%)", background: "oklch(0.14 0.04 285)" },
      { clipPath: "polygon(78% 54%, 78% 16%, 86% 16%, 86% 28%, 100% 28%, 100% 54%)", background: "oklch(0.14 0.04 285)" },
      { clipPath: "polygon(40% 58%, 40% 72%, 49% 72%)", background: "oklch(0.96 0.02 90)" },
      { clipPath: "polygon(33% 72%, 53% 72%, 49% 78%, 37% 78%)", background: "oklch(0.9 0.02 90)" },
    ],
  },
  // A ceramic mug on marble under studio light.
  mug: {
    background: [
      "radial-gradient(60% 55% at 50% 30%, oklch(0.95 0.02 80), oklch(0.8 0.03 70) 75%)",
    ].join(", "),
    layers: [
      { top: "64%", background: "linear-gradient(170deg, oklch(0.9 0.01 250), oklch(0.82 0.01 250) 40%, oklch(0.88 0.01 250))" },
      { top: "68%", left: "30%", right: "30%", bottom: "26%", borderRadius: "50%", background: "oklch(0.3 0.02 70 / 0.18)", filter: "blur(6px)" },
      { top: "34%", left: "36%", right: "38%", bottom: "30%", borderRadius: "6% 6% 22% 22%", background: "linear-gradient(90deg, oklch(0.99 0 0), oklch(0.93 0.01 80) 60%, oklch(0.8 0.02 70))" },
      { top: "41%", left: "58%", right: "30%", bottom: "45%", borderRadius: "0 50% 50% 0", border: "0.45rem solid oklch(0.9 0.01 80)", borderLeft: "none" },
    ],
  },
  // A desert road at golden hour.
  desert: {
    background: [
      "radial-gradient(circle at 50% 58%, oklch(0.95 0.12 90) 0 7%, oklch(0.88 0.14 75 / 0.55) 8%, transparent 26%)",
      "linear-gradient(180deg, oklch(0.5 0.13 15), oklch(0.78 0.14 55) 58%, oklch(0.47 0.09 45) 58%, oklch(0.36 0.07 40))",
    ].join(", "),
    layers: [
      { clipPath: "polygon(0 58%, 22% 50%, 40% 58%)", background: "oklch(0.42 0.08 35)" },
      { clipPath: "polygon(62% 58%, 82% 47%, 100% 54%, 100% 58%)", background: "oklch(0.4 0.08 30)" },
      { clipPath: "polygon(48.5% 58%, 51.5% 58%, 78% 100%, 22% 100%)", background: "oklch(0.24 0.02 40)" },
      { clipPath: "polygon(49.8% 64%, 50.2% 64%, 50.6% 72%, 49.4% 72%, 49.8% 64%, 49.2% 80%, 50.8% 80%, 51.6% 96%, 48.4% 96%)", background: "oklch(0.9 0.1 90)" },
    ],
  },
  // Koi under lily pads, seen from above.
  koi: {
    background: [
      "repeating-radial-gradient(circle at 34% 44%, transparent 0 16px, oklch(0.8 0.08 190 / 0.16) 16px 18px)",
      "linear-gradient(160deg, oklch(0.4 0.07 195), oklch(0.24 0.06 225))",
    ].join(", "),
    layers: [
      { top: "52%", left: "34%", width: "34%", height: "13%", borderRadius: "50% 40% 40% 50%", rotate: "-24deg", background: "linear-gradient(90deg, oklch(0.78 0.17 50), oklch(0.95 0.02 90) 55%, oklch(0.72 0.18 35))" },
      { top: "26%", left: "56%", width: "26%", height: "10%", borderRadius: "50% 40% 40% 50%", rotate: "18deg", background: "linear-gradient(90deg, oklch(0.95 0.02 90), oklch(0.75 0.17 45))" },
      { top: "6%", left: "8%", width: "30%", aspectRatio: "1", borderRadius: "50%", background: "conic-gradient(from 20deg, transparent 0 8%, oklch(0.55 0.12 150) 8%)" },
      { top: "64%", left: "70%", width: "26%", aspectRatio: "1", borderRadius: "50%", background: "conic-gradient(from 200deg, transparent 0 8%, oklch(0.5 0.11 155) 8%)" },
    ],
  },
  // Two friends on a rooftop at dusk.
  rooftop: {
    background: [
      "radial-gradient(40% 30% at 70% 62%, oklch(0.85 0.13 60 / 0.7), transparent 70%)",
      "linear-gradient(180deg, oklch(0.3 0.1 295), oklch(0.55 0.15 340) 55%, oklch(0.72 0.14 40))",
    ].join(", "),
    layers: [
      { clipPath: "polygon(0 100%, 0 58%, 10% 58%, 10% 44%, 18% 44%, 18% 62%, 30% 62%, 30% 36%, 36% 36%, 36% 66%, 52% 66%, 52% 50%, 64% 50%, 64% 60%, 76% 60%, 76% 40%, 84% 40%, 84% 64%, 100% 64%, 100% 100%)", background: "oklch(0.2 0.05 300)" },
      { top: "78%", background: "oklch(0.14 0.03 300)" },
      { top: "52%", left: "34%", width: "9%", height: "28%", borderRadius: "40% 40% 8% 8%", background: "oklch(0.1 0.02 300)" },
      { top: "56%", left: "54%", width: "9%", height: "24%", borderRadius: "40% 40% 8% 8%", background: "oklch(0.1 0.02 300)" },
    ],
  },
  // A pine forest in fog at blue hour.
  forest: {
    background: [
      "radial-gradient(70% 30% at 50% 62%, oklch(0.92 0.02 240 / 0.6), transparent 70%)",
      "linear-gradient(180deg, oklch(0.36 0.06 260), oklch(0.66 0.05 240) 70%, oklch(0.78 0.03 230))",
    ].join(", "),
    layers: [
      { clipPath: "polygon(0 100%, 0 52%, 6% 34%, 12% 52%, 18% 30%, 25% 52%, 32% 38%, 40% 52%, 47% 26%, 55% 52%, 62% 36%, 70% 52%, 77% 28%, 85% 52%, 92% 40%, 100% 52%, 100% 100%)", background: "oklch(0.42 0.05 230)" },
      { clipPath: "polygon(0 100%, 0 74%, 8% 48%, 16% 74%, 24% 56%, 33% 74%, 42% 44%, 52% 74%, 61% 58%, 70% 74%, 80% 46%, 90% 74%, 100% 60%, 100% 100%)", background: "oklch(0.24 0.04 215)" },
    ],
  },
} satisfies Record<string, { background: string; layers: Layer[] }>;

export type SceneName = keyof typeof SCENES;

export function Scene({ name, className }: { name: SceneName; className?: string }) {
  const scene = SCENES[name];
  return (
    <div aria-hidden className={cn("absolute inset-0", className)} style={{ background: scene.background }}>
      {scene.layers.map((layer, i) => (
        <div key={i} className="absolute inset-0" style={layer} />
      ))}
    </div>
  );
}
