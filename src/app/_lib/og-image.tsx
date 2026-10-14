import { ImageResponse } from "next/og";
import { projectConfig } from "project.config";

// The size social sites expect. Each opengraph-image route exports these.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// The preview image a shared link shows: the project name, a title and a
// line of text, on the dark canvas with the pine glow (docs/DESIGN.md).
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
          justifyContent: "space-between",
          padding: 80,
          backgroundColor: "#0d0d0d",
          backgroundImage: "radial-gradient(ellipse 70% 90% at 100% 0%, rgba(98, 185, 149, 0.22), rgba(98, 185, 149, 0))",
          color: "#f3f4eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "#1f634a" }} />
          {projectConfig.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, lineHeight: 1.1, lineClamp: 2 }}>{title}</div>
          <div style={{ fontSize: 32, color: "#a4a69b", lineHeight: 1.4, lineClamp: 2 }}>{description}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
