import { ImageResponse } from "next/og";
import { projectConfig } from "project.config";
import { VIEWFINDER } from "@/components/layout/logo-mark";

// The size social sites expect. Each opengraph-image route exports these.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Dark-theme values of --film and --primary-text (docs/DESIGN.md).
const FILM = "#f0b04a";
const PINE = "#62b995";
const HOLES = Array.from({ length: 22 }, (_, i) => i);

// A strip of film perforations, lit from behind by the projector.
function Perforations() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: 56,
        padding: "0 22px",
        backgroundColor: "#141414",
      }}
    >
      {HOLES.map((i) => (
        <div key={i} style={{ width: 26, height: 18, borderRadius: 4, backgroundColor: "rgba(240, 176, 74, 0.2)" }} />
      ))}
    </div>
  );
}

// The preview image a shared link shows: a frame of film with the logo,
// the project name, a title and a line of text (docs/DESIGN.md, Logo).
// The default font is Geist; next/og fetches Noto Sans from Google Fonts
// for characters Geist lacks, such as Chinese.
export function ogImage({ title, description, locale }: { title: string; description: string; locale: string }) {
  return new ImageResponse(
    (
      <div
        lang={locale === "zh" ? "zh-CN" : locale}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0d0d0d",
          color: "#f3f4eb",
        }}
      >
        <Perforations />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 80px",
            backgroundImage: [
              "radial-gradient(ellipse 60% 80% at 100% 0%, rgba(240, 176, 74, 0.16), rgba(240, 176, 74, 0))",
              "radial-gradient(ellipse 50% 70% at 0% 100%, rgba(98, 185, 149, 0.1), rgba(98, 185, 149, 0))",
            ].join(", "),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34 }}>
            <svg width={48} height={48} viewBox="0 0 32 32">
              <path d={VIEWFINDER} fill="none" stroke={FILM} strokeWidth={3} strokeLinecap="round" />
              <rect x={9} y={13.5} width={9} height={5} rx={2.5} fill={PINE} fillOpacity={0.35} />
              <circle cx={18} cy={16} r={5} fill={PINE} />
            </svg>
            {projectConfig.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "block", fontSize: 68, lineHeight: 1.1, letterSpacing: -1.5, lineClamp: 2 }}>
              {title}
            </div>
            <div style={{ display: "block", fontSize: 30, color: "#a4a69b", lineHeight: 1.4, lineClamp: 3 }}>{description}</div>
          </div>
        </div>
        <Perforations />
      </div>
    ),
    OG_SIZE,
  );
}
