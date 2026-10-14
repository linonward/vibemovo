import { getFormatter } from "next-intl/server";

// A post's YYYY-MM-DD date in the reader's locale. UTC, so the day never shifts.
export async function PostDate({ date }: { date: string }) {
  const format = await getFormatter();
  return (
    <time dateTime={date} className="text-sm text-muted-foreground tabular-nums">
      {format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" })}
    </time>
  );
}
