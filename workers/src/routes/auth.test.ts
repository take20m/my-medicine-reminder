import { describe, expect, it } from 'vitest';
import { resolveDisplayName } from './auth';
import type { FirebaseTokenPayload } from '../utils/auth';

// 検証に関係ない必須フィールドはダミーで埋める
function payload(overrides: Partial<FirebaseTokenPayload>): FirebaseTokenPayload {
  return {
    iss: 'https://securetoken.google.com/test',
    aud: 'test',
    auth_time: 0,
    user_id: 'uid',
    sub: 'uid',
    iat: 0,
    exp: 0,
    firebase: {
      identities: { 'google.com': ['105707479157731766727'] },
      sign_in_provider: 'google.com'
    },
    ...overrides
  };
}

describe('resolveDisplayName', () => {
  it('name クレームを優先する', () => {
    expect(
      resolveDisplayName(payload({ name: 'みその たけぞう', email: 'a@example.com' }))
    ).toBe('みその たけぞう');
  });

  it('name が無ければメールアドレスを使う', () => {
    expect(resolveDisplayName(payload({ email: 'a@example.com' }))).toBe('a@example.com');
  });

  it('name も email も無ければ User', () => {
    expect(resolveDisplayName(payload({}))).toBe('User');
  });

  it('空文字の name はメールアドレスにフォールバックする', () => {
    expect(resolveDisplayName(payload({ name: '', email: 'a@example.com' }))).toBe(
      'a@example.com'
    );
  });

  it('Google の sub (数字) を表示名に使わない', () => {
    const resolved = resolveDisplayName(payload({ name: '山田', email: 'a@example.com' }));
    expect(resolved).not.toBe('105707479157731766727');
  });

  it('name が無い場合でも sub を使わない (旧実装の回帰防止)', () => {
    const resolved = resolveDisplayName(payload({ email: 'a@example.com' }));
    expect(resolved).not.toBe('105707479157731766727');
  });
});
