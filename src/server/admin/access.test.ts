import { projectConfig } from "project.config";
import { expect, test } from "vitest";
import { adminEmails, isAdmin } from "./access";

const admins = ["Admin@Example.com"];

test("matches admin emails without regard to case", () => {
  expect(isAdmin("admin@example.com", admins)).toBe(true);
  expect(isAdmin(" ADMIN@example.com ", admins)).toBe(true);
});

test("rejects other and missing emails", () => {
  expect(isAdmin("user@example.com", admins)).toBe(false);
  expect(isAdmin(undefined, admins)).toBe(false);
  expect(isAdmin("", [""])).toBe(false);
});

test("reads a comma-separated admin list from ADMIN_EMAILS", () => {
  expect(adminEmails({ ADMIN_EMAILS: " a@example.com, B@example.com ,," })).toEqual([
    "a@example.com",
    "B@example.com",
  ]);
  expect(adminEmails({ ADMIN_EMAILS: "" })).toEqual([]);
  expect(adminEmails({})).toEqual([]);
});

// project.config is bundled into client components, so admin emails there
// would be public.
test("keeps admin emails out of project.config", () => {
  expect(projectConfig).not.toHaveProperty("admins");
});
