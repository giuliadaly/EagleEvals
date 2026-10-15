import assert from 'node:assert/strict';
import { createOwnerAuth } from '../../src/data/owner-auth-config.ts';

// Mint a real stateless session through Better Auth's GitHub OAuth callback.
// This helper runs in the fixture controller, before Next starts. All provider
// requests are mocked and the original fetch is restored even on failure.
export async function createFixtureOwnerSession(config) {
  const base = new URL(config.baseURL);
  assert.ok(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname), 'Owner fixture sessions require a local HTTP origin');
  const originalFetch = globalThis.fetch;
  const calls = [];
  const jar = new Map();
  function applyCookies(response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      if (/(?:^|;\s*)Max-Age=0(?:;|$)/i.test(header)) jar.delete(name);
      else jar.set(name, pair.slice(separator + 1));
    }
  }
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  try {
    globalThis.fetch = async (input, options = {}) => {
      const request = input instanceof Request ? input : new Request(input, options);
      calls.push(request.url);
      if (request.url === 'https://github.com/login/oauth/access_token') {
        assert.equal(request.method, 'POST');
        return Response.json({ access_token: 'fixture-owner-access-token', token_type: 'bearer', scope: 'read:user,user:email' });
      }
      if (request.url === 'https://api.github.com/user') {
        assert.equal(request.headers.get('authorization'), 'Bearer fixture-owner-access-token');
        return Response.json({ id: Number(config.githubId), login: 'fixture-owner', name: 'Fixture Owner', email: null, avatar_url: null });
      }
      if (request.url === 'https://api.github.com/user/emails') return Response.json([]);
      throw new Error(`Real network access is forbidden when minting a fixture session: ${request.url}`);
    };
    const auth = createOwnerAuth(config);
    const signIn = await auth.handler(new Request(`${config.baseURL}/api/owner/auth/sign-in/social`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: config.baseURL },
      body: JSON.stringify({ provider: 'github', callbackURL: `${config.baseURL}/owner`, disableRedirect: true }),
    }));
    assert.equal(signIn.status, 200);
    applyCookies(signIn);
    const state = new URL((await signIn.json()).url).searchParams.get('state');
    assert.ok(state);
    const callback = await auth.handler(new Request(`${config.baseURL}/api/owner/auth/callback/github?code=fixture-owner-code&state=${encodeURIComponent(state)}`, { headers: { Cookie: cookie() } }));
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), `${config.baseURL}/owner`);
    applyCookies(callback);
    const session = await createOwnerAuth(config).api.getSession({ headers: new Headers({ Cookie: cookie() }) });
    assert.equal(session?.user.githubId, config.githubId);
    assert.equal(calls.length, 3);
    assert.equal(jar.has('eagleevals-owner.session_token'), true);
    assert.equal(jar.has('eagleevals-owner.session_data'), true);
    return { cookie: cookie(), expiresAt: session.session.expiresAt, name: session.user.name };
  } finally {
    globalThis.fetch = originalFetch;
  }
}
