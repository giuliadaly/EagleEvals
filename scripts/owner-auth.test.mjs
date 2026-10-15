import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { symmetricDecodeJWT } from 'better-auth/crypto';
import { createOwnerAuth, isOwnerIdentity, ownerAuthConfiguration } from '../src/data/owner-auth-config.ts';

// Exercise the real Better Auth router, OAuth provider, encrypted cookies and
// session verifier. No fixture starts a server or permits an unmocked fetch.
const config = {
  baseURL: 'https://owner.example.test',
  secret: randomBytes(48).toString('base64url'),
  clientId: 'fixture-client-id',
  clientSecret: 'fixture-client-secret',
  githubId: '5249812',
};
const env = {
  OWNER_AUTH_URL: config.baseURL,
  OWNER_AUTH_SECRET: config.secret,
  OWNER_GITHUB_CLIENT_ID: config.clientId,
  OWNER_GITHUB_CLIENT_SECRET: config.clientSecret,
  OWNER_GITHUB_ID: config.githubId,
};
const ownerProfile = {
  id: Number(config.githubId), login: 'owner-renamed-login', name: 'Owner Fixture',
  email: null, avatar_url: null,
};
const cookiePrefix = '__Secure-eagleevals-owner.';

function mockGithub(t, profile = ownerProfile) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = request.url;
    requests.push({ url, method: request.method, headers: request.headers, body: await request.text() });
    if (url === 'https://github.com/login/oauth/access_token') {
      assert.equal(request.method, 'POST');
      return Response.json({ access_token: 'fixture-github-access-token', token_type: 'bearer', scope: 'read:user,user:email' });
    }
    if (url === 'https://api.github.com/user') {
      assert.equal(request.headers.get('authorization'), 'Bearer fixture-github-access-token');
      return Response.json(profile);
    }
    if (url === 'https://api.github.com/user/emails') {
      return Response.json([]);
    }
    throw new Error(`Unexpected network request: ${request.method} ${url}`);
  });
  return requests;
}

function request(path, { method = 'GET', body, cookie, origin = config.baseURL } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (method === 'POST') {
    headers.set('origin', origin);
    headers.set('content-type', 'application/json');
  }
  return new Request(`${config.baseURL}/api/owner/auth${path}`, {
    method, headers, ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
  });
}

function cookies(response, previous = new Map()) {
  const jar = new Map(previous);
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(';');
    const split = pair.indexOf('=');
    const name = pair.slice(0, split);
    if (/(?:^|;\s*)Max-Age=0(?:;|$)/i.test(value)) jar.delete(name);
    else jar.set(name, pair.slice(split + 1));
  }
  return jar;
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function begin(auth, options = {}) {
  const response = await auth.handler(request('/sign-in/social', {
    method: 'POST', body: { provider: 'github', callbackURL: `${config.baseURL}/owner`, disableRedirect: true, ...options },
  }));
  assert.equal(response.status, 200);
  const { url } = await response.json();
  const authorize = new URL(url);
  assert.equal(authorize.origin, 'https://github.com');
  assert.equal(authorize.pathname, '/login/oauth/authorize');
  assert.equal(authorize.searchParams.get('redirect_uri'), `${config.baseURL}/api/owner/auth/callback/github`);
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorize.searchParams.get('code_challenge'));
  assert.ok(authorize.searchParams.get('state'));
  return { state: authorize.searchParams.get('state'), jar: cookies(response) };
}

async function callback(auth, flow, state = flow.state) {
  return auth.handler(request(`/callback/github?code=fixture-authorization-code&state=${encodeURIComponent(state)}`, { cookie: cookieHeader(flow.jar) }));
}

async function signIn(auth) {
  const flow = await begin(auth);
  const response = await callback(auth, flow);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `${config.baseURL}/owner`);
  return { response, jar: cookies(response, flow.jar) };
}

async function session(auth, jar) {
  const response = await auth.handler(request('/get-session', { cookie: cookieHeader(jar) }));
  assert.equal(response.status, 200);
  return { response, data: await response.json() };
}

test('owner configuration fails closed before starting auth', () => {
  assert.deepEqual(ownerAuthConfiguration(env), config);
  for (const key of Object.keys(env)) assert.equal(ownerAuthConfiguration({ ...env, [key]: undefined }), null, key);
  for (const value of ['0', '-1', '5249812x', 'owner-login', ' 5249812', '05']) {
    assert.equal(ownerAuthConfiguration({ ...env, OWNER_GITHUB_ID: value }), null);
  }
  for (const value of ['invalid', 'http://example.test', 'https://owner.example.test/path', 'https://owner.example.test/', 'https://user:password@owner.example.test', 'https://owner.example.test?query=x']) {
    assert.equal(ownerAuthConfiguration({ ...env, OWNER_AUTH_URL: value }), null);
  }
  assert.equal(ownerAuthConfiguration({ ...env, OWNER_AUTH_SECRET: 'too-short' }), null);
  assert.equal(ownerAuthConfiguration({ ...env, OWNER_AUTH_URL: 'http://localhost:3135' })?.baseURL, 'http://localhost:3135');
  assert.equal(ownerAuthConfiguration({ ...env, OWNER_AUTH_URL: 'http://127.0.0.1:3135' })?.baseURL, 'http://127.0.0.1:3135');
  assert.equal(isOwnerIdentity(null, config.githubId), false);
  assert.equal(isOwnerIdentity({ id: 'local', githubId: 'someone-else', name: 'Owner Fixture' }, config.githubId), false);
});

test('real GitHub callback rejects a different immutable account ID before issuing a session', async t => {
  // A matching display name, login and email cannot authorize another account.
  const requests = mockGithub(t, { ...ownerProfile, id: 9990001 });
  const auth = createOwnerAuth(config);
  const response = await callback(auth, await begin(auth));
  assert.equal(response.status, 403);
  assert.match((await response.json()).message, /cannot access/);
  const jar = cookies(response);
  assert.equal(jar.has(`${cookiePrefix}session_token`), false);
  assert.equal(jar.has(`${cookiePrefix}session_data`), false);
  assert.equal(jar.has(`${cookiePrefix}account_data`), false);
  assert.equal((await session(createOwnerAuth(config), jar)).data, null);
  assert.deepEqual(requests.map(({ url }) => url), [
    'https://github.com/login/oauth/access_token', 'https://api.github.com/user', 'https://api.github.com/user/emails',
  ]);
});

test('owner OAuth produces a one-hour encrypted session that works across stateless instances', async t => {
  const requests = mockGithub(t);
  const { response, jar } = await signIn(createOwnerAuth(config));
  for (const name of ['session_token', 'session_data', 'account_data']) {
    assert.ok(jar.get(`${cookiePrefix}${name}`));
    const setCookie = response.headers.getSetCookie().find(value => value.startsWith(`${cookiePrefix}${name}=`));
    assert.match(setCookie, /; HttpOnly/i);
    assert.match(setCookie, /; Secure/i);
    assert.match(setCookie, /; SameSite=Lax/i);
    assert.match(setCookie, /; Path=\//i);
    assert.doesNotMatch(setCookie, /Domain=/i);
  }
  const encrypted = decodeURIComponent(jar.get(`${cookiePrefix}session_data`));
  assert.equal(encrypted.split('.').length, 5, 'session cookie is an encrypted JWE, not a readable JWT');
  assert.doesNotMatch(encrypted, /Owner Fixture|owner-renamed-login|fixture-github-access-token|5249812/);
  assert.equal(await symmetricDecodeJWT(encrypted, randomBytes(48).toString('base64url'), 'better-auth-session'), null);
  const decoded = await symmetricDecodeJWT(encrypted, config.secret, 'better-auth-session');
  assert.equal(decoded.user.githubId, config.githubId);
  assert.equal(decoded.exp - decoded.iat, 3600);
  const sessionLifetime = new Date(decoded.session.expiresAt) - new Date(decoded.session.createdAt);
  assert.ok(sessionLifetime <= 3_600_000 && sessionLifetime >= 3_599_000, 'session expiry stays within one hour; creation timestamps can be captured a few milliseconds apart');
  const { data, response: sessionResponse } = await session(createOwnerAuth(config), jar);
  assert.equal(data.user.githubId, config.githubId);
  assert.equal(data.user.name, 'Owner Fixture');
  assert.equal(data.user.email, '5249812+owner-renamed-login@users.noreply.github.com');
  assert.equal(isOwnerIdentity(data.user, config.githubId), true);
  assert.equal(sessionResponse.headers.getSetCookie().length, 0, 'reading the cache does not refresh its lifetime');
  assert.equal(requests.length, 3, 'session reads never refetch GitHub or contact a database');
  const tokenRequest = requests[0];
  assert.equal(new URLSearchParams(tokenRequest.body).get('code'), 'fixture-authorization-code');
  assert.equal(new URLSearchParams(tokenRequest.body).get('redirect_uri'), `${config.baseURL}/api/owner/auth/callback/github`);
  assert.ok(new URLSearchParams(tokenRequest.body).get('code_verifier'));
});

test('forged, incomplete, mismatched, rotated-secret and expired session cookies are rejected', async t => {
  const requests = mockGithub(t);
  const { jar } = await signIn(createOwnerAuth(config));
  const tokenName = `${cookiePrefix}session_token`;
  const dataName = `${cookiePrefix}session_data`;
  const mutate = name => {
    const copy = new Map(jar);
    const value = copy.get(name);
    const position = value.length - 10;
    copy.set(name, `${value.slice(0, position)}${value[position] === 'A' ? 'B' : 'A'}${value.slice(position + 1)}`);
    return copy;
  };
  for (const invalid of [new Map(), mutate(tokenName), mutate(dataName), new Map([[tokenName, jar.get(tokenName)]]), new Map([[dataName, jar.get(dataName)]])]) {
    assert.equal((await session(createOwnerAuth(config), invalid)).data, null);
  }
  const other = await signIn(createOwnerAuth(config));
  const mixed = new Map(jar);
  mixed.set(tokenName, other.jar.get(tokenName));
  assert.equal((await session(createOwnerAuth(config), mixed)).data, null, 'encrypted data is bound to its signed session token');
  assert.equal((await session(createOwnerAuth({ ...config, secret: randomBytes(48).toString('base64url') }), jar)).data, null);
  const decoded = await symmetricDecodeJWT(decodeURIComponent(jar.get(dataName)), config.secret, 'better-auth-session');
  const now = Date.now();
  t.mock.timers.enable({ apis: ['Date'], now });
  // JWT expiry is rounded to seconds. Anchor the boundary to the issued cookie,
  // not to a later wall-clock read after several other requests have run.
  t.mock.timers.setTime(decoded.exp * 1000 - 2000);
  assert.equal((await session(createOwnerAuth(config), jar)).data?.user.githubId, config.githubId);
  t.mock.timers.setTime(decoded.exp * 1000 + 1000);
  assert.equal((await session(createOwnerAuth(config), jar)).data, null);
  assert.equal(requests.length, 6);
});

test('owner router blocks registration, editing, account linking and token export even with a valid owner cookie', async t => {
  const requests = mockGithub(t);
  const auth = createOwnerAuth(config);
  const { jar } = await signIn(auth);
  const blocked = [
    ['/sign-up/email', 'POST', { name: 'Attacker', email: 'attacker@example.test', password: 'fixture-password' }],
    ['/sign-in/email', 'POST', { email: 'attacker@example.test', password: 'fixture-password' }],
    ['/update-user', 'POST', { githubId: '9990001', name: 'Changed' }],
    ['/delete-user', 'POST', {}],
    ['/link-social', 'POST', { provider: 'github' }],
    ['/unlink-account', 'POST', { providerId: 'github' }],
    ['/list-accounts', 'GET'],
    ['/get-access-token', 'POST', { providerId: 'github' }],
    ['/refresh-token', 'POST', { providerId: 'github' }],
    ['/callback/google?code=fixture-code&state=fixture-state', 'GET'],
  ];
  for (const [path, method, body] of blocked) {
    const response = await auth.handler(request(path, { method, body, cookie: cookieHeader(jar) }));
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.getSetCookie().length, 0, path);
    assert.doesNotMatch(await response.text(), /fixture-github-access-token|Changed/);
  }
  await assert.rejects(auth.api.getAccessToken({ headers: new Headers({ cookie: cookieHeader(jar) }), body: { providerId: 'github' } }), error => error.status === 'NOT_FOUND');
  assert.equal((await session(auth, jar)).data.user.name, 'Owner Fixture');
  assert.equal(requests.length, 3);
});

test('OAuth state, origin and redirect checks prevent login CSRF and unsafe callbacks; sign-out clears owner cookies', async t => {
  const requests = mockGithub(t);
  const auth = createOwnerAuth(config);
  const flow = await begin(auth);
  const wrongState = await callback(auth, flow, 'forged-state');
  assert.equal(wrongState.status, 302);
  assert.match(wrongState.headers.get('location'), /error=/);
  assert.equal(requests.length, 0);
  const withoutCookie = await callback(auth, { ...flow, jar: new Map() });
  assert.equal(withoutCookie.status, 302);
  assert.equal(requests.length, 0);
  const { jar } = await signIn(auth);
  for (const options of [
    { origin: 'https://attacker.example.test', body: { provider: 'github' } },
    { body: { provider: 'google' } },
    { body: { provider: 'github', callbackURL: 'https://attacker.example.test/steal' } },
  ]) {
    const response = await auth.handler(request('/sign-in/social', { method: 'POST', cookie: cookieHeader(jar), ...options }));
    assert.ok([400, 403].includes(response.status), JSON.stringify({ options, status: response.status, body: await response.clone().text() }));
    assert.equal(response.headers.getSetCookie().length, 0);
  }
  const badSignOut = await auth.handler(request('/sign-out', { method: 'POST', cookie: cookieHeader(jar), origin: 'https://attacker.example.test' }));
  assert.equal(badSignOut.status, 403);
  assert.equal((await session(auth, jar)).data.user.githubId, config.githubId);
  const signOut = await auth.handler(request('/sign-out', { method: 'POST', cookie: cookieHeader(jar) }));
  assert.equal(signOut.status, 200);
  const cleared = cookies(signOut, jar);
  assert.equal(cleared.has(`${cookiePrefix}session_token`), false);
  assert.equal(cleared.has(`${cookiePrefix}session_data`), false);
  assert.equal(cleared.has(`${cookiePrefix}account_data`), false);
  assert.equal((await session(auth, cleared)).data, null);
  assert.equal(requests.length, 3);
});
