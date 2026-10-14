import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { userBalance } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCards, StatCardsSkeleton } from "@/components/dashboard/stat-cards";
import { countChats } from "@/server/ai/chats";
import { countImages } from "@/server/images";
import { countVideos } from "@/server/videos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: t("title") };
}

// The title is static; the email and the numbers read the session, each
// behind its own Suspense.
export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={
          <Suspense>
            <SignedInAs />
          </Suspense>
        }
      />
      <Suspense fallback={<StatCardsSkeleton label={t("stats.loading")} />}>
        <Stats />
      </Suspense>
      <DashboardHome />
    </>
  );
}

async function SignedInAs() {
  const session = await currentSession();
  const t = await getTranslations("Dashboard");
  return t("signedInAs", { email: session?.user.email ?? "" });
}

async function Stats() {
  const session = await currentSession();
  if (!session) return null;
  const id = session.user.id;
  const [credits, chats, images, videos] = await Promise.all([
    userBalance(id),
    countChats(id),
    countImages(id),
    countVideos(id),
  ]);
  return <StatCards credits={credits} chats={chats} images={images} videos={videos} />;
}
