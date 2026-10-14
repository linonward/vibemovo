import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { StatCards } from "./stat-cards";

afterEach(cleanup);

const stats = { credits: 1234, chats: 3, images: 0, videos: 12 };

test("shows four linked cards with label, value and note", () => {
  renderWithIntl(<StatCards {...stats} />);

  const cards = within(screen.getByRole("region", { name: "Overview" })).getAllByRole("link");
  expect(cards.map((card) => card.getAttribute("href"))).toEqual([
    "/en/billing",
    "/en/chat",
    "/en/images",
    "/en/videos",
  ]);
  expect(cards[0].textContent).toBe("Credits1,234Available to spend");
  expect(cards[2].textContent).toBe("Images0Generated so far");
});

test("is translated", () => {
  renderWithIntl(<StatCards {...stats} />, "zh");

  const cards = within(screen.getByRole("region", { name: "概览" })).getAllByRole("link");
  expect(cards[1].textContent).toBe("对话3已保存的对话");
});
