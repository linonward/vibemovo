import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { useFormatter } from "next-intl";
import { renderWithIntl } from "@/test/intl";
import { LocalTimeZone } from "./local-time-zone";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Created() {
  const format = useFormatter();
  return <p>{format.dateTime(new Date("2026-10-15T14:03:00Z"), { dateStyle: "medium", timeStyle: "short" })}</p>;
}

test("dates show in the reader's time zone, not the server's UTC", () => {
  const options = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...options.call(this), timeZone: "Asia/Shanghai" };
  });

  renderWithIntl(
    <LocalTimeZone>
      <Created />
    </LocalTimeZone>,
  );

  expect(screen.getByText("Oct 15, 2026, 10:03 PM")).toBeTruthy();
});

test("the locale still reaches the components below", () => {
  renderWithIntl(
    <LocalTimeZone>
      <Created />
    </LocalTimeZone>,
    "zh",
  );

  expect(screen.getByText(/2026年10月15日/)).toBeTruthy();
});
