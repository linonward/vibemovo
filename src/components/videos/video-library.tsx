import { useTranslations } from "next-intl";
import { Pagination } from "@/components/dashboard/pagination";
import { Link } from "@/i18n/navigation";
import type { GeneratedVideo } from "@/lib/api";
import { VideoList } from "./video-list";

// One page of every video the user generated.
export function VideoLibrary({
  videos,
  page,
  pageCount,
}: {
  videos: GeneratedVideo[];
  page: number;
  pageCount: number;
}) {
  const t = useTranslations("Videos");

  if (videos.length === 0) {
    return (
      <p className="text-muted-foreground">
        {t("empty")}{" "}
        <Link href="/videos" className="text-foreground underline underline-offset-4">
          {t("generateLink")}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <VideoList videos={videos} aria-label={t("libraryTitle")} />
      <Pagination pathname="/videos/library" page={page} pageCount={pageCount} />
    </div>
  );
}
