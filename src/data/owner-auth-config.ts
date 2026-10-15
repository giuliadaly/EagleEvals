import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

export type OwnerAuthConfiguration = {
  baseURL: string;
  secret: string;
  clientId: string;
  clientSecret: string;
  githubId: string;
};

export function ownerAuthConfiguration(env: Record<string, string | undefined>): OwnerAuthConfiguration | null {
  const { OWNER_AUTH_URL: baseURL, OWNER_AUTH_SECRET: secret, OWNER_GITHUB_CLIENT_ID: clientId,
    OWNER_GITHUB_CLIENT_SECRET: clientSecret, OWNER_GITHUB_ID: githubId } = env;
  if (!baseURL || !secret || secret.length < 43 || !clientId || !clientSecret || !githubId || !/^[1-9]\d*$/.test(githubId)) return null;
  try {
    const url = new URL(baseURL);
    if (url.origin !== baseURL || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
  } catch { return null; }
  return { baseURL, secret, clientId, clientSecret, githubId };
}

export function isOwnerIdentity(user: unknown, githubId: string): user is { id: string; githubId: string; name: string } {
  return !!user && typeof user === "object" && "githubId" in user && user.githubId === githubId && "id" in user && typeof user.id === "string";
}

export function createOwnerAuth(config: OwnerAuthConfiguration, plugins: BetterAuthPlugin[] = []) {
  // The only identity is the owner's existing GitHub account. Stateless encrypted
  // sessions avoid creating student accounts or adding an auth database/service.
  return betterAuth({
    appName: "EagleEvals owner",
    baseURL: config.baseURL,
    basePath: "/api/owner/auth",
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    telemetry: { enabled: false },
    logger: { disabled: true },
    emailAndPassword: { enabled: false },
    socialProviders: { github: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      mapProfileToUser(profile) {
        if (String(profile.id) !== config.githubId) throw new APIError("FORBIDDEN", { message: "This account cannot access EagleEvals owner tools." });
        return { githubId: String(profile.id), name: profile.name || profile.login,
          email: profile.email || `${profile.id}+${profile.login}@users.noreply.github.com` };
      },
    } },
    user: { additionalFields: { githubId: { type: "string", required: true } } },
    session: { expiresIn: 60 * 60, disableSessionRefresh: true,
      cookieCache: { enabled: true, strategy: "jwe", maxAge: 60 * 60, refreshCache: false } },
    account: { storeStateStrategy: "cookie", storeAccountCookie: true, accountLinking: { enabled: false } },
    advanced: { cookiePrefix: "eagleevals-owner", useSecureCookies: config.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { disableIpTracking: true } },
    hooks: { before: createAuthMiddleware(async context => {
      // No public registration, profile editing, account linking, token export,
      // or alternate sign-in method is part of this owner-only flow.
      // Better Auth exposes the callback's route template to hooks rather than
      // its concrete URL. Restrict the matching template to GitHub explicitly.
      const githubCallback = context.path === "/callback/:id" && context.params?.id === "github";
      if (!githubCallback && !["/sign-in/social", "/get-session", "/sign-out", "/ok", "/error"].includes(context.path)) {
        throw new APIError("NOT_FOUND", { message: "Not found" });
      }
      if (context.path === "/sign-in/social" && context.body?.provider !== "github") throw new APIError("BAD_REQUEST", { message: "Use GitHub to sign in." });
    }) },
    plugins,
  });
}
