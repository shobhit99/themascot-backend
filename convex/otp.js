import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";
import { generateOtp, renderOtpEmail } from "./authEmail.js";

export const ResendOtp = Email({
  id: "resend-otp",
  name: "Email code",
  maxAge: 10 * 60,
  from: process.env.AUTH_EMAIL_FROM || "The Mascot <onboarding@resend.dev>",
  generateVerificationToken: async () => generateOtp(),
  sendVerificationRequest: async ({ identifier, provider, token }) => {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      throw new Error("AUTH_RESEND_KEY is not configured.");
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: provider.from,
      to: identifier,
      subject: `${token} is your The Mascot sign-in code`,
      html: renderOtpEmail({ code: token, host: "The Mascot" }),
    });

    if (error) {
      throw new Error(`Unable to send sign-in code: ${error.message}`);
    }
  },
});
