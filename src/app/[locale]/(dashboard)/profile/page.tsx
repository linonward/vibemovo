import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Profile } from "@/components/account/profile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile");
  return { title: t("title") };
}

// Profile reads the session in the browser and shows a skeleton until then.
export default async function ProfilePage() {
  const t = await getTranslations("Profile");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Profile />
    </>
  );
}
