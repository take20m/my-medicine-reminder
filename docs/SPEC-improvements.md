# お薬リマインダー改善 SPEC

作成日: 2026-09-22 / 対象ブランチ: `take20m/manta`

3件の独立した改善をまとめた仕様書。コミットは機能ごとに3つに分ける。

---

## 1. 最大再通知回数の設定

### 現状

`workers/src/services/scheduler.ts:126-146` は、設定時刻からの経過分 `diffMinutes` が
`0 <= diffMinutes <= 60` の範囲で、`reminderInterval`（5/10/15/30/60分）の倍数に当たる
cron ウィンドウでのみ再通知を送る。**回数の概念はなく、60分というハードコードの時間上限**で
打ち切られている。結果、間隔15分なら最大4回、間隔60分なら最大1回と、間隔によって回数が変わる。

### 仕様

- `UserSettings` に `maxReminderCount: number`（**再通知**の最大回数。初回通知は含めない）を追加。
- 設定可能値: **0〜10回**。既定値 **4回**（現状の「15分間隔 × 60分上限 = 4回」と実質同等）。
  - `0` を選ぶと再通知なし（初回通知のみ）。
- 打ち切り条件は**回数のみ**。60分のハードコード上限は撤廃する。
  - 送信条件: `diffMinutes > 0` かつ `diffMinutes % reminderInterval === 0` かつ
    `diffMinutes / reminderInterval <= maxReminderCount`
  - 例）間隔15分・最大3回 → 初回 07:30、再通知 07:45 / 08:00 / 08:15 で終了。
- **安全弁: 日をまたいだら打ち切る。** 回数が残っていても JST の 24:00 で停止する。
  - 服薬記録が日付単位（`records` の PK に `date` を含む）のため、翌日に前日分を通知するのは不整合。
  - 実装上は既存の `diffMinutes < 0 → continue` がそのまま機能する（翌日 00:30 に対し
    前日 22:00 起点なら `30 - 1320 = -1290` で負）。追加ロジックは不要。
  - 例）就寝前 22:00・間隔60分・最大10回 → 23:00 の1回のみ送信し、00:00 で停止。
- 既存どおり、対象タイミングの未服用の薬が無くなれば送信は止まる。
- 通知の文言は**変更しない**（現状の「◯◯のお薬の時間です」のまま。回数は表示しない）。

### 変更対象

| ファイル | 変更内容 |
| --- | --- |
| `shared/types.ts` | `UserSettings.maxReminderCount: number` を追加 |
| `workers/src/db/schema.ts` | `users.maxReminderCount`（`max_reminder_count` INTEGER NOT NULL DEFAULT 4）を追加 |
| `workers/drizzle/0001_*.sql` | `drizzle-kit generate` で生成（`ALTER TABLE users ADD COLUMN ...`） |
| `workers/src/db/queries.ts` | `DEFAULT_SETTINGS` / `rowToUser` / `upsertUser` / `createUser` / `updateUserSettings` に反映 |
| `workers/src/routes/settings.ts` | PUT の検証に `0 <= maxReminderCount <= 10` の整数チェックを追加 |
| `workers/src/services/scheduler.ts` | 60分上限を撤廃し回数判定へ。候補時刻の展開幅も拡張（下記） |
| `frontend/src/pages/SettingsPage.tsx` | 「最大再通知回数」セレクトを追加（再通知間隔の直下） |

### 候補ユーザー絞り込みの拡張

`scheduler.ts` の `relevantTimesForWindow()` は現在、過去 `60 + CRON_INTERVAL` 分ぶんの
`HH:MM` を展開して `getUsersByTimings()` に渡している。上限が「回数 × 間隔」最大 600分
（10回 × 60分）に広がるため、展開幅も **600 + CRON_INTERVAL 分**に広げる。

- **日をまたがない**ので、`currentMinutes - d < 0` になる分は展開しない
  （例: JST 03:00 実行時は過去180分ぶんのみ）。これで安全弁がクエリ段階でも効く。
- バインド変数は増えない。`getUsersByTimings()` は `json_each` で JSON 文字列1個に
  まとめている（`queries.ts:416-433`）ため、D1 の 100変数/クエリ 制限には当たらない。
  JSON 文字列は最大 4KB 程度。
- 候補ユーザー数は増えうるが、そこから先は既存どおり1ユーザーずつ判定するため
  挙動は変わらない（個人用途の規模では実害なし）。

### 受入条件

- 設定画面で最大再通知回数を 0〜10 回で選択・保存でき、リロード後も保持される。
- 間隔15分・最大3回のとき、07:30 起点で 07:45 / 08:00 / 08:15 に再通知が飛び、08:30 には飛ばない。
- 最大0回のとき、初回通知のみで再通知が飛ばない。
- 就寝前 22:00・間隔60分・最大10回のとき、00:00 以降に通知が飛ばない。
- 対象タイミングを服用済みにすると、回数が残っていても再通知が止まる。
- 既存ユーザーは移行後 `maxReminderCount = 4` となり、通知の体感が従来と変わらない。

---

## 2. アカウント欄の Google ID を非表示に

### 現状

`workers/src/routes/auth.ts:20` が `displayName` に
`payload.firebase.identities['google.com'][0]`（Google の `sub`、21桁の数字）を入れており、
`frontend/src/pages/SettingsPage.tsx:341` がそれをそのまま表示している。
**表示側のバグではなく、DB に保存されている値そのものが数字**。

### 仕様

- `SettingsPage.tsx:341` の `displayName` 行を削除し、アカウント欄は**メールアドレスのみ**表示する。
- `auth.ts` の `displayName` 決定ロジック、`shared/types.ts` の `User.displayName`、
  DB カラムは**変更しない**（API 互換を保つ。非目標を参照）。

### 受入条件

- 設定画面のアカウント欄にメールアドレスとログアウトボタンのみが表示される。
- API レスポンス・DB スキーマに変更がない。

---

## 3. 薬が登録されている時間帯のタブを開く

### 現状

`frontend/src/pages/HomePage.tsx:9-27` の `getCurrentTiming()` は
「現在時刻に最も近い過去のタイミング」を返すだけで、薬の登録有無を見ていない。
このため朝しか薬を登録していなくても、昼に開くと「昼」タブが選ばれ
「昼に服用する薬はありません」と表示される。

加えて、この判定は `user` 変更時の effect（`HomePage.tsx:56-63`）で走るため、
薬リストのロード完了とは独立しており、タイミングによっては薬 0 件の状態で判定される。

### 仕様

- 自動選択の候補を「**有効な薬が1つ以上登録されているタイミング**」に限定する。
  - 候補の中から「現在時刻に最も近い過去のタイミング」を選ぶ。
  - 該当がなければ（＝すべての候補が未来なら）候補のうち最も早いタイミング。
  - 候補が空（薬が1件も無い）なら従来どおり全タイミングから選ぶ。
  - 服用済みかどうかは見ない（朝を服用済みでも朝タブを開く）。
- 判定は**薬リストのロード完了後**に行い、**初回1回だけ**自動選択する。
  以降はユーザーのタブ操作を上書きしない。
- タブの表示自体は変更しない（薬が無いタイミングのタブも従来どおり表示する）。

### 変更対象

| ファイル | 変更内容 |
| --- | --- |
| `frontend/src/pages/HomePage.tsx` | `getCurrentTiming()` に薬リストを渡す形へ変更、effect の依存と初回フラグを調整 |

### 受入条件

- 朝のみ薬を登録した状態で 12:50 に開くと「朝」タブが開く（朝を服用済みでも同じ）。
- 朝と夕に登録した状態で 12:50 に開くと「朝」タブ、21:45 に開くと「夕」タブが開く。
- 薬が1件も無い場合は従来どおり現在時刻基準のタブが開く。
- 自動選択後にユーザーが別タブを押した状態は、再描画で巻き戻らない。

---

## 非目標（今回やらないこと）

- `auth.ts` の `displayName` 決定ロジックの修正、および既存ユーザーの `display_name` の
  データ移行（Google の実名取得）。アカウント欄を非表示にすることで当面の要望は満たせるため。
- 通知文言に再通知回数を含めること。
- 薬が登録されていないタイミングのタブを UI から消すこと。
- 打ち切り時間をユーザーが設定できるようにすること（回数のみで制御する）。
- 再通知間隔の選択肢（5/10/15/30/60分）の変更。
- KV 関連コード・旧マイグレーションスクリプトの削除。

## テスト方針

- **Workers**: 既存の `vitest`（`workers/src/utils/*.test.ts`）に倣う。
  `scheduler.ts` の通知判定を DB 非依存の純関数として切り出し、
  `workers/src/services/scheduler.test.ts` を追加する。
  - 境界値: `diffMinutes = 0`（初回）/ 間隔ちょうど / 最大回数ちょうど / 最大回数+1 /
    `maxReminderCount = 0` / 日またぎ（`diffMinutes < 0`）/ cron ウィンドウ 5分の取りこぼし。
  - `relevantTimesForWindow()` も、JST 00:05 実行時に前日ぶんを展開しないことを検証。
- **Frontend**: 現在テスト基盤（vitest）が無い。**今回は導入せず**、
  タブ選択ロジックを `frontend/src/utils/` の純関数に切り出したうえで、
  受入条件は `npm run dev` での手動確認とする。
- CI（`.github/workflows/ci.yml`）は `tsc --noEmit` + `npm test` + フロントの `build` を実行する。

## 互換性・移行

- D1 マイグレーション `0001_*.sql` は `ALTER TABLE users ADD COLUMN max_reminder_count
  INTEGER NOT NULL DEFAULT 4` の追加のみ。既存行は自動的に 4 になる。
- `dev` ブランチへ push すると CI が `medicine-reminder-db-dev` にマイグレーションを適用し
  dev 環境へデプロイ、`main` へ push すると本番に適用される
  （`.github/workflows/ci.yml` の `deploy-dev` / `deploy-prod`）。
  したがって **dev で動作確認してから main へ**進める。
- API は後方互換。旧フロントが `maxReminderCount` を送らなくても
  `updateUserSettings()` が現在値を維持する。

## ロールバック

- 3件を機能ごとの独立コミットに分けるため、問題が出た機能だけ `git revert` できる。
- D1 のカラム追加は破壊的ではないため、コードを revert してもカラムは残したままでよい
  （`DEFAULT 4` があるので旧コードでも INSERT は通る）。
