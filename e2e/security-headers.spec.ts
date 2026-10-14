import { expect, test } from "@playwright/test";

// Other sites can't frame the app (clickjacking), browsers don't guess
// content types, stay on HTTPS once they've seen it, and send other sites
// only the origin as the referrer.
for (const path of ["/en", "/en/sign-in", "/api/health"]) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const response = await request.get(path);
    const headers = response.headers();

    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toBe("max-age=63072000");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
}
