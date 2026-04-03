import type { Env, PushSubscriptionData } from '../types';

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

// Base64URL エンコード
function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64URL デコード
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// VAPID JWTを生成（ES256署名）
async function createVapidAuthHeader(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = { typ: 'JWT', alg: 'ES256' };
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));

  const payload = { aud: audience, exp: expiration, sub: subject };
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));

  const signingInput = `${headerB64}.${payloadB64}`;

  // PKCS8形式に変換してインポート（P-256 raw秘密鍵用）
  const keyBytes = base64UrlDecode(privateKey);
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04,
    0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
  ]);
  const pkcs8Key = concatUint8Arrays([pkcs8Header, keyBytes]);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Key,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const derSignature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  // DER形式からraw R||S形式（各32バイト、計64バイト）に変換
  const signature = derToRaw(new Uint8Array(derSignature));
  const signatureB64 = base64UrlEncode(signature);
  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  return `vapid t=${jwt}, k=${publicKey}`;
}

// Uint8Array を結合
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ECDSA DER署名をraw R||S形式（64バイト）に変換
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <r_len> <r> 0x02 <s_len> <s>
  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30 + total length

  // R
  offset += 1; // skip 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // S
  offset += 1; // skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 32 + (32 - sLen) : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

// aes128gcm暗号化用のキー導出
async function deriveEncryptionKeys(
  clientPublicKey: Uint8Array,
  clientAuth: Uint8Array,
  serverKeyPair: CryptoKeyPair,
  salt: Uint8Array
): Promise<{ key: CryptoKey; nonce: Uint8Array }> {
  // クライアント公開鍵をインポート
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH共有シークレットを導出
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ecdhParams: any = { name: 'ECDH', public: clientKey };
  const sharedSecret = await crypto.subtle.deriveBits(
    ecdhParams,
    serverKeyPair.privateKey,
    256
  );

  // サーバー公開鍵をエクスポート
  const exportedKey = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(exportedKey as ArrayBuffer);

  // auth info
  const encoder = new TextEncoder();
  const authInfo = concatUint8Arrays([
    encoder.encode('WebPush: info\0'),
    clientPublicKey,
    serverPublicKey
  ]);

  // HKDF Extract
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(sharedSecret),
    'HKDF',
    false,
    ['deriveBits']
  );

  // PRK
  const prkBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: clientAuth, info: authInfo },
    ikmKey,
    256
  );

  const prkKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(prkBits),
    'HKDF',
    false,
    ['deriveBits']
  );

  // CEK
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKey,
    128
  );

  const cek = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(cekBits),
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt']
  );

  // Nonce
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKey,
    96
  );

  return { key: cek, nonce: new Uint8Array(nonceBits) };
}

// aes128gcm形式でペイロードを暗号化
async function encryptPayload(
  payload: Uint8Array,
  clientPublicKey: Uint8Array,
  clientAuth: Uint8Array
): Promise<{ body: Uint8Array; serverPublicKey: Uint8Array }> {
  // サーバー側の一時鍵ペアを生成
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as CryptoKeyPair;

  // ソルトを生成
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 暗号化キーとnonceを導出
  const { key, nonce } = await deriveEncryptionKeys(
    clientPublicKey,
    clientAuth,
    serverKeyPair,
    salt
  );

  // パディングを追加（RFC 8188: payload + 0x02 for final record）
  const paddedPayload = concatUint8Arrays([
    payload,
    new Uint8Array([2]) // final record delimiter
  ]);

  // 暗号化
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    paddedPayload
  );

  // サーバー公開鍵
  const exportedKey = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(exportedKey as ArrayBuffer);

  // aes128gcm形式のボディを構築
  // salt (16) + rs (4) + idlen (1) + keyid (65) + encrypted
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  const body = concatUint8Arrays([
    salt,
    rs,
    new Uint8Array([65]),
    serverPublicKey,
    new Uint8Array(encrypted)
  ]);

  return { body, serverPublicKey };
}

// WebPush通知を送信
export async function sendPushNotification(
  env: Env,
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  try {
    // クライアントの公開鍵とauth secretをデコード
    const clientPublicKey = base64UrlDecode(subscription.keys.p256dh);
    const clientAuth = base64UrlDecode(subscription.keys.auth);

    // ペイロードを暗号化
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const { body } = await encryptPayload(
      payloadBytes,
      clientPublicKey,
      clientAuth
    );

    // VAPID認証ヘッダーを生成
    const authHeader = await createVapidAuthHeader(
      subscription.endpoint,
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );

    // Push送信
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'high'
      },
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Push notification failed:', response.status, errorText);

      // 410 Gone or 404 = 購読が無効
      if (response.status === 410 || response.status === 404) {
        return false;
      }

      throw new Error(`Push failed: ${response.status} ${errorText}`);
    }

    console.log('Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('sendPushNotification error:', error);
    throw error;
  }
}
