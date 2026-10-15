import "server-only";
import { nextCookies } from "better-auth/next-js";
import { createOwnerAuth, isOwnerIdentity, ownerAuthConfiguration } from "@/data/owner-auth-config";

let instance: ReturnType<typeof createOwnerAuth> | undefined;
export function ownerAuth() {
  const config = ownerAuthConfiguration(process.env);
  if (!config) return null;
  instance ??= createOwnerAuth(config, [nextCookies()]);
  return instance;
}

export async function ownerSession(headers: Headers) {
  const auth = ownerAuth();
  if (!auth) return null;
  const session = await auth.api.getSession({ headers });
  if (!session || !isOwnerIdentity(session.user, process.env.OWNER_GITHUB_ID ?? "")) return null;
  return { githubId: session.user.githubId, name: session.user.name };
}

export const ownerResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
