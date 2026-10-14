import type { MetadataRoute } from "next";
import { connection } from "next/server";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Read BETTER_AUTH_URL per request, as the sitemap does.
  await connection();
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: new URL("/sitemap.xml", process.env.BETTER_AUTH_URL).href,
  };
}
