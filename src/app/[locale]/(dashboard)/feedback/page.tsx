import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { MAX_FEEDBACK_LENGTH, MAX_FEEDBACK_IMAGES, MAX_FEEDBACK_IMAGE_BYTES } from "@/server/feedback/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Feedback");
  return { title: t("title") };
}

export default async function FeedbackPage() {
  const t = await getTranslations("Feedback");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <FeedbackForm maxLength={MAX_FEEDBACK_LENGTH} maxImages={MAX_FEEDBACK_IMAGES} maxImageBytes={MAX_FEEDBACK_IMAGE_BYTES} />
    </>
  );
}
