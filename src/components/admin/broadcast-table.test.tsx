import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { BroadcastTable } from "./broadcast-table";

afterEach(cleanup);

test("lists each broadcast with its audience and recipients", () => {
  renderWithIntl(
    <BroadcastTable
      broadcasts={[
        {
          id: "b1",
          title: "Maintenance",
          body: "We restart at 02:00 UTC.",
          email: null,
          sentBy: "admin@example.com",
          recipients: 1200,
          createdAt: new Date("2026-10-12T02:00:00Z"),
        },
        {
          id: "b2",
          title: "Hello",
          body: "Hi Ada",
          email: "ada@example.com",
          sentBy: "admin@example.com",
          recipients: 1,
          createdAt: new Date("2026-10-11T02:00:00Z"),
        },
      ]}
    />,
  );

  const rows = within(screen.getByRole("table", { name: "Sent notifications" })).getAllByRole("row").slice(1);
  expect(rows[0].textContent).toContain("Maintenance");
  expect(rows[0].textContent).toContain("All users");
  expect(rows[0].textContent).toContain("1,200");
  expect(rows[1].textContent).toContain("ada@example.com");
});

test("says so before anything was sent", () => {
  renderWithIntl(<BroadcastTable broadcasts={[]} />);

  expect(screen.getByText("No notifications sent yet.")).toBeTruthy();
});
