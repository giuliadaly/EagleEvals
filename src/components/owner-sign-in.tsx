"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";

const client = createAuthClient({ basePath: "/api/owner/auth" });

export function OwnerSignIn({ configured, signOut = false }: { configured: boolean; signOut?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (pending) return;
    setPending(true); setError("");
    try {
      if (signOut) {
        const result = await client.signOut();
        if (result.error) throw new Error();
        router.replace("/owner");
        router.refresh();
      } else {
        const result = await client.signIn.social({ provider: "github", callbackURL: "/owner", errorCallbackURL: "/owner?error=access-denied" });
        if (result.error) throw new Error();
      }
    } catch { setError(signOut ? "Could not sign out. Please try again." : "Sign-in could not start. Please try again."); setPending(false); }
  }
  return <div><button className="button-primary" type="button" disabled={!configured || pending} onClick={submit}>{pending ? "Please wait…" : signOut ? "Sign out" : "Sign in with GitHub"}</button>{error ? <p role="alert" className="mt-3 text-sm text-[var(--rose)]">{error}</p> : null}</div>;
}
