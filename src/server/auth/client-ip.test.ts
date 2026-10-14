// @vitest-environment node
import { expect, test } from "vitest";
import { ipAddressHeaders } from "./client-ip";

test("reads the client IP from x-forwarded-for by default", () => {
  expect(ipAddressHeaders({})).toEqual(["x-forwarded-for"]);
});

test("reads it from CLIENT_IP_HEADER alone when set", () => {
  expect(ipAddressHeaders({ CLIENT_IP_HEADER: "cf-connecting-ip" })).toEqual(["cf-connecting-ip"]);
  expect(ipAddressHeaders({ CLIENT_IP_HEADER: " CF-Connecting-IP " })).toEqual(["cf-connecting-ip"]);
});
