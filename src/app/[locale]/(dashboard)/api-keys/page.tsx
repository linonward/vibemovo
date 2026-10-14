import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { ApiKeyManager } from "@/components/api-keys/api-key-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { listApiKeys, MAX_API_KEYS } from "@/server/auth/api-keys";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ApiKeys");
  return { title: t("title") };
}

// The title is static. The keys read the request, so they stream in behind
// this page's own Suspense.
export default async function ApiKeysPage() {
  const t = await getTranslations("ApiKeys");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <ApiKeysContent />
      </Suspense>
    </>
  );
}

// The layout guarantees a session.
async function ApiKeysContent() {
  const session = await currentSession();
  if (!session) return null;
  const keys = await listApiKeys(session.user.id);
  const appUrl = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;

  return <ApiKeyManager keys={keys} max={MAX_API_KEYS} appUrl={appUrl} />;
}
