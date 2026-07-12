"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export default function SignOutButton() {
  const { signOut } = useAuthActions();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      window.location.assign("/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="sign-out" type="button" onClick={handleSignOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
