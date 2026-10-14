// @vitest-environment node
import { expect, test } from "vitest";
import { addMonths, monthsBegun } from "./periods";

const at = (iso: string) => new Date(iso);

test("adds calendar months in UTC, keeping the day where the month has it", () => {
  expect(addMonths(at("2026-01-15T08:00:00Z"), 1)).toEqual(at("2026-02-15T08:00:00Z"));
  expect(addMonths(at("2026-11-15T08:00:00Z"), 3)).toEqual(at("2027-02-15T08:00:00Z"));
  expect(addMonths(at("2027-03-15T08:00:00Z"), -12)).toEqual(at("2026-03-15T08:00:00Z"));
});

test("ends a month that lacks the day on its last day", () => {
  expect(addMonths(at("2026-01-31T00:00:00Z"), 1)).toEqual(at("2026-02-28T00:00:00Z"));
  expect(addMonths(at("2028-03-31T00:00:00Z"), -1)).toEqual(at("2028-02-29T00:00:00Z"));
});

// A yearly period ending 2027-03-15 began on 2026-03-15. Month 0 is paid
// with the charge; months 1-11 begin a month apart.
const periodEnd = at("2027-03-15T00:00:00Z");

test("lists the months of a yearly period that have begun after the first", () => {
  expect(monthsBegun(periodEnd, at("2026-03-20T00:00:00Z"))).toEqual([]);
  expect(monthsBegun(periodEnd, at("2026-04-15T00:00:00Z"))).toEqual([1]);
  expect(monthsBegun(periodEnd, at("2026-06-14T23:59:59Z"))).toEqual([1, 2]);
  expect(monthsBegun(periodEnd, at("2026-06-15T00:00:00Z"))).toEqual([1, 2, 3]);
});

test("stops at the twelfth month, even after the period ends", () => {
  expect(monthsBegun(periodEnd, at("2027-02-20T00:00:00Z"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  expect(monthsBegun(periodEnd, at("2028-01-01T00:00:00Z"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
