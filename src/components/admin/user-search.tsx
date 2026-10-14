import { Search } from "lucide-react";
import Form from "next/form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// A GET form: the query lands in the URL as ?q=, so results can be linked
// and work without JavaScript. Submitting starts again on page 1.
export function UserSearch({ action, query }: { action: string; query: string }) {
  const t = useTranslations("Admin");

  return (
    <Form action={action} role="search" className="flex gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={query}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </div>
      <Button type="submit" variant="outline" className="h-10">
        {t("search")}
      </Button>
    </Form>
  );
}
