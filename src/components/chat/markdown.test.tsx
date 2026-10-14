import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Markdown } from "./markdown";

afterEach(cleanup);

const REPLY = [
  "Some **bold** text and `inline` code.",
  "",
  "- one",
  "- two",
  "",
  "```python",
  "print('hi')",
  "```",
  "",
  "| a | b |",
  "| - | - |",
  "| 1 | 2 |",
  "",
  "[docs](https://example.com) <script>alert(1)</script>",
].join("\n");

test("renders GitHub Markdown and leaves out raw HTML", () => {
  const { container } = render(<Markdown>{REPLY}</Markdown>);

  expect(container.querySelector("strong")?.textContent).toBe("bold");
  expect(container.querySelectorAll("li")).toHaveLength(2);
  const block = container.querySelector("pre code");
  expect(block?.textContent).toBe("print('hi')\n");
  expect(block?.className).toContain("language-python");
  expect(container.querySelector("table")).toBeTruthy();
  const link = screen.getByRole("link", { name: "docs" });
  expect(link.getAttribute("href")).toBe("https://example.com");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(container.querySelector("script")).toBeNull();
});
