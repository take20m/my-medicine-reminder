import { describe, expect, it } from 'vitest';
import { verifyFirebaseToken } from './auth';

const PROJECT_ID = 'test-project';

function base64UrlEncode(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeToken(header: object, payload: object, signature = 'fake'): string {
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.${signature}`;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    auth_time: now - 60,
    user_id: 'test-uid',
    sub: 'test-uid',
    iat: now - 10,
    exp: now + 3600,
    email: 'test@example.com',
    firebase: { identities: {}, sign_in_provider: 'google.com' },
    ...overrides
  };
}

describe('verifyFirebaseToken - 事前バリデーション', () => {
  it('ピリオド区切りが3つでないと弾く', async () => {
    await expect(verifyFirebaseToken('a.b', PROJECT_ID)).rejects.toThrow('Invalid token format');
    await expect(verifyFirebaseToken('a.b.c.d', PROJECT_ID)).rejects.toThrow('Invalid token format');
  });

  it('alg が RS256 でないと弾く', async () => {
    const token = makeToken({ alg: 'HS256', kid: 'k1' }, validPayload());
    await expect(verifyFirebaseToken(token, PROJECT_ID)).rejects.toThrow('Invalid algorithm');
  });

  it('exp が過去だと expired で弾く', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken(
      { alg: 'RS256', kid: 'k1' },
      validPayload({ exp: now - 10 })
    );
    await expect(verifyFirebaseToken(token, PROJECT_ID)).rejects.toThrow('Token expired');
  });

  it('iat が未来60秒を超えていると弾く', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken(
      { alg: 'RS256', kid: 'k1' },
      validPayload({ iat: now + 3600 })
    );
    await expect(verifyFirebaseToken(token, PROJECT_ID)).rejects.toThrow('Token issued in the future');
  });

  it('iss が想定プロジェクトと異なると弾く', async () => {
    const token = makeToken(
      { alg: 'RS256', kid: 'k1' },
      validPayload({ iss: 'https://securetoken.google.com/other-project' })
    );
    await expect(verifyFirebaseToken(token, PROJECT_ID)).rejects.toThrow('Invalid issuer');
  });

  it('aud が想定プロジェクトと異なると弾く', async () => {
    const token = makeToken(
      { alg: 'RS256', kid: 'k1' },
      validPayload({ aud: 'other-project' })
    );
    await expect(verifyFirebaseToken(token, PROJECT_ID)).rejects.toThrow('Invalid audience');
  });
});
