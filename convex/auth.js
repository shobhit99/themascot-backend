import { convexAuth } from "@convex-dev/auth/server";
import { ResendOtp } from "./otp.js";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOtp],
});
