import { connection } from "next/server";
import { checkHealth } from "@/server/health";

export async function GET() {
  await connection();

  const health = await checkHealth();
  return Response.json(health, { status: health.status === "ok" ? 200 : 503 });
}
