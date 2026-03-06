# おくすりリマインダー

毎日の薬の飲み忘れを防ぐPWAアプリ

## 機能

- 複数の薬を登録・管理
- 朝・昼・夕・就寝前の4つのタイミングで服用時刻を設定
- WebPush通知でリマインド
- 飲み忘れ時は自動で再通知
- 服用履歴をカレンダー形式で確認
- オフライン対応（表示のみ）

## 技術スタック

### フロントエンド
- Preact + TypeScript
- Vite
- PWA (Service Worker)

### バックエンド
- Cloudflare Workers
- Cloudflare KV
- Hono (Web Framework)

### 認証
- Firebase Authentication (Google認証)

### 通知
- WebPush (VAPID)

## セットアップ

### 前提条件
- Node.js 18以上
- Cloudflare アカウント
- Firebase プロジェクト

### 1. Firebase の設定

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Authentication を有効化し、Google認証を設定
3. プロジェクト設定からWeb アプリを追加し、設定値を取得

### 2. Cloudflare の設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. Workers & Pages > KV で新しいNamespaceを作成
3. `workers/wrangler.toml` のKV ID を更新

### 3. VAPID鍵の生成

```bash
cd workers
npx web-push generate-vapid-keys
```

### 4. 環境変数の設定

#### フロントエンド
```bash
cd frontend
cp .env.example .env
# .env を編集してFirebaseの設定値を入力
```

#### Workers
```bash
cd workers
cp .dev.vars.example .dev.vars
# .dev.vars を編集して設定値を入力
```

本番環境では Cloudflare Dashboard > Workers > Settings > Variables で設定

### 5. 依存関係のインストール

```bash
# フロントエンド
cd frontend
npm install

# Workers
cd ../workers
npm install
```

### 6. 開発サーバーの起動

```bash
# ターミナル1: Workers
cd workers
npm run dev

# ターミナル2: フロントエンド
cd frontend
npm run dev
```

http://localhost:5173 でアプリにアクセス

## デプロイ

### Workers

```bash
cd workers
npm run deploy
```

### フロントエンド (Cloudflare Pages)

1. GitHubリポジトリにプッシュ
2. Cloudflare Pages でリポジトリを接続
3. ビルド設定:
   - ビルドコマンド: `cd frontend && npm install && npm run build`
   - ビルド出力ディレクトリ: `frontend/dist`
4. 環境変数を設定

## iPhoneでの利用方法

1. Safari でアプリにアクセス
2. 共有ボタン → 「ホーム画面に追加」
3. アプリを起動してGoogleでログイン
4. 設定画面で「通知を有効化」

※ iOS 16.4以降が必要

## ディレクトリ構成

```
medicine-reminder/
├── frontend/                  # Preact アプリ
│   ├── src/
│   │   ├── components/        # UIコンポーネント
│   │   ├── pages/             # ページコンポーネント
│   │   ├── hooks/             # カスタムフック
│   │   ├── services/          # API呼び出し、Firebase
│   │   ├── stores/            # 状態管理
│   │   ├── styles/            # CSS
│   │   └── types/             # TypeScript型定義
│   ├── public/
│   │   ├── manifest.json      # PWA設定
│   │   └── sw.js              # Service Worker
│   └── vite.config.ts
├── workers/                   # Cloudflare Workers
│   ├── src/
│   │   ├── routes/            # APIルート
│   │   ├── services/          # ビジネスロジック
│   │   ├── utils/             # ユーティリティ
│   │   └── index.ts           # エントリーポイント
│   └── wrangler.toml
└── README.md
```

## API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| POST | /api/auth/verify | Firebase トークン検証 |
| GET | /api/medications | 薬一覧取得 |
| POST | /api/medications | 薬登録 |
| PUT | /api/medications/:id | 薬更新 |
| DELETE | /api/medications/:id | 薬削除 |
| GET | /api/settings | ユーザー設定取得 |
| PUT | /api/settings | ユーザー設定更新 |
| GET | /api/records/:date | 日別記録取得 |
| GET | /api/records?from=&to= | 期間指定記録取得 |
| POST | /api/records | 服用記録登録 |
| GET | /api/push/vapid-key | VAPID公開鍵取得 |
| POST | /api/push/subscribe | WebPush購読登録 |
| DELETE | /api/push/subscribe | WebPush購読解除 |
| POST | /api/push/test | テスト通知送信 |

## ライセンス

MIT
