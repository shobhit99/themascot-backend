import assert from "node:assert/strict";
import test from "node:test";

import { generateOtp, renderOtpEmail } from "../convex/authEmail.js";
import { requireAuthenticated } from "../lib/require-authenticated.js";

test("generateOtp returns a six-digit code", () => {
  const code = generateOtp(() => new Uint32Array([123456]));
  assert.equal(code, "123456");
});

test("renderOtpEmail escapes user-controlled content", () => {
  const html = renderOtpEmail({ code: "123456", host: "<script>bad()</script>" });
  assert.match(html, /123456/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("requireAuthenticated rejects unauthenticated requests", async () => {
  await assert.rejects(
    requireAuthenticated(async () => false),
    (error) => error.status === 401 && /Sign in/.test(error.message),
  );
});

test("requireAuthenticated allows authenticated requests", async () => {
  await assert.doesNotReject(requireAuthenticated(async () => true));
});
