import { useTranslations } from "next-intl";
import { Pagination } from "@/components/dashboard/pagination";
import { Link } from "@/i18n/navigation";
import type { GeneratedImage } from "@/lib/api";
import { ImageList } from "./image-list";

// One page of every image the user generated.
export function ImageLibrary({
  images,
  page,
  pageCount,
}: {
  images: GeneratedImage[];
  page: number;
  pageCount: number;
}) {
  const t = useTranslations("Images");

  if (images.length === 0) {
    return (
      <p className="text-muted-foreground">
        {t("empty")}{" "}
        <Link href="/images" className="text-foreground underline underline-offset-4">
          {t("generateLink")}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ImageList images={images} aria-label={t("libraryTitle")} />
      <Pagination pathname="/images/library" page={page} pageCount={pageCount} />
    </div>
  );
}
