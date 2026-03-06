import type { Context, Next } from 'hono';
import type { Env } from '../types';

interface FirebaseTokenPayload {
  iss: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  firebase: {
    identities: Record<string, string[]>;
    sign_in_provider: string;
  };
}

interface JwkWithKid extends JsonWebKey {
  kid?: string;
}

interface JwksResponse {
  keys: JwkWithKid[];
}

// Firebase公開鍵をキャッシュするための変数
let cachedKeys: Record<string, CryptoKey> | null = null;
let keysExpiresAt: number = 0;

// Firebase公開鍵を取得
async function getFirebasePublicKeys(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (cachedKeys && now < keysExpiresAt) {
    return cachedKeys;
  }

  // JWKSエンドポイントを使用
  const jwksResponse = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );

  if (!jwksResponse.ok) {
    throw new Error('Failed to fetch Firebase JWKS');
  }

  // キャッシュ有効期限を設定（1時間）
  keysExpiresAt = now + 3600 * 1000;

  const jwks: JwksResponse = await jwksResponse.json();
  cachedKeys = {};

  for (const jwk of jwks.keys) {
    if (jwk.kid && jwk.kty === 'RSA') {
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      cachedKeys[jwk.kid] = key;
    }
  }

  return cachedKeys;
}

// Base64URLデコード
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// Firebase IDトークンを検証
export async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<FirebaseTokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // ヘッダーをデコード
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  if (header.alg !== 'RS256') {
    throw new Error('Invalid algorithm');
  }

  // ペイロードをデコード
  const payload: FirebaseTokenPayload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64))
  );

  // 有効期限をチェック
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  if (payload.iat > now + 60) {
    throw new Error('Token issued in the future');
  }

  // issuer をチェック
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid issuer');
  }

  // audience をチェック
  if (payload.aud !== projectId) {
    throw new Error('Invalid audience');
  }

  // 署名を検証
  const keys = await getFirebasePublicKeys();
  const key = keys[header.kid];
  if (!key) {
    throw new Error('Key not found');
  }

  const signature = base64UrlDecode(signatureB64);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!isValid) {
    throw new Error('Invalid signature');
  }

  return payload;
}

// Hono用の変数型定義
interface AuthVariables {
  uid: string;
  email: string | undefined;
}

// 認証ミドルウェア
export function authMiddleware() {
  return async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice(7);
    try {
      const payload = await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID);
      c.set('uid', payload.sub);
      c.set('email', payload.email);
      await next();
    } catch (error) {
      console.error('Auth error:', error);
      return c.json({ success: false, error: 'Invalid token' }, 401);
    }
  };
}
