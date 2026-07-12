function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function generateOtp(randomValues = crypto.getRandomValues.bind(crypto)) {
  const values = randomValues(new Uint32Array(1));
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export function renderOtpEmail({ code, host = "The Mascot" }) {
  const safeCode = escapeHtml(code);
  const safeHost = escapeHtml(host);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f0e8;color:#1d1d1b;font-family:Arial,sans-serif;padding:32px">
    <main style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #ded8cc;border-radius:20px;padding:32px">
      <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#716a60">${safeHost}</p>
      <h1 style="font-size:28px;margin:16px 0">Your sign-in code</h1>
      <p style="font-size:16px;line-height:1.6">Enter this one-time code to continue:</p>
      <p style="font-size:36px;font-weight:700;letter-spacing:.18em;margin:28px 0">${safeCode}</p>
      <p style="font-size:14px;color:#716a60">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    </main>
  </body>
</html>`;
}
