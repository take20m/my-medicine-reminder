export function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-gray-100)',
      padding: 'var(--spacing-md)'
    }}>
      <div class="card" style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: 'var(--spacing-xl)',
        lineHeight: 1.7
      }}>
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontSize: 'var(--font-size-sm)'
          }}
        >
          ← 戻る
        </a>

        <h1 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-lg)'
        }}>
          プライバシーポリシー
        </h1>

        <p style={{ marginBottom: 'var(--spacing-lg)' }}>
          おくすりリマインダー（以下「本サービス」）は、ユーザーの個人情報を以下のとおり取り扱います。
        </p>

        <Section title="1. 事業者">
          本サービスは個人により開発・運営されています。
        </Section>

        <Section title="2. 取得する情報">
          本サービスは以下の情報を取得・保管します。
          <ul style={listStyle}>
            <li>Googleアカウントから取得する情報：メールアドレス、表示名、Googleが発行する一意の識別子（Firebase UID）</li>
            <li>ユーザーが本サービスに入力した情報：お薬の名称・用量・服用タイミング、服用記録、通知時刻設定</li>
            <li>Webプッシュ通知に必要な情報：ブラウザが発行する購読エンドポイントおよび暗号化用の公開鍵</li>
          </ul>
        </Section>

        <Section title="3. 利用目的">
          取得した情報は以下の目的で利用します。
          <ul style={listStyle}>
            <li>本サービスへのログイン認証およびユーザー識別</li>
            <li>お薬リマインダー機能の提供（指定時刻でのプッシュ通知送信）</li>
            <li>服用記録の保存・表示</li>
            <li>障害対応・運用改善</li>
          </ul>
        </Section>

        <Section title="4. 保管場所">
          情報は以下の事業者が提供するサービス上に保管されます。
          <ul style={listStyle}>
            <li>認証情報：Google LLC が提供する Firebase Authentication</li>
            <li>お薬データ・服用記録・設定・購読情報：Cloudflare, Inc. が提供する Cloudflare Workers KV</li>
          </ul>
        </Section>

        <Section title="5. 第三者提供">
          取得した情報をユーザーの同意なく第三者に提供することはありません。ただし以下の場合を除きます。
          <ul style={listStyle}>
            <li>Webプッシュ通知の送信に必要な範囲で、ブラウザベンダー（Apple、Google、Mozilla 等）が運営するプッシュサービスへ購読エンドポイント情報を送信する場合</li>
            <li>法令に基づく開示請求があった場合</li>
          </ul>
        </Section>

        <Section title="6. Cookie・ローカルストレージ等の利用">
          本サービスはログイン状態の保持のため、ブラウザの Cookie・Local Storage・IndexedDB を利用します。また Service Worker によりアプリの動作に必要なリソースをキャッシュします。
        </Section>

        <Section title="7. 退会・データ削除">
          ログアウトはアプリ内の「ログアウト」ボタンから可能です。アカウントおよび関連データの完全な削除をご希望の場合は、下記の問い合わせ先までご連絡ください。
        </Section>

        <Section title="8. プライバシーポリシーの変更">
          本ポリシーの内容は必要に応じて改定することがあります。改定後のポリシーは本ページに掲載した時点で効力を生じるものとします。
        </Section>

        <Section title="9. お問い合わせ">
          本ポリシーおよび個人情報の取り扱いに関するお問い合わせは、GitHub リポジトリの Issues よりご連絡ください。
          <ul style={listStyle}>
            <li>
              <a
                href="https://github.com/take20m/my-medicine-reminder/issues"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)' }}
              >
                https://github.com/take20m/my-medicine-reminder/issues
              </a>
            </li>
          </ul>
        </Section>

        <p style={{
          marginTop: 'var(--spacing-xl)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-gray-600)'
        }}>
          最終更新日：2026年4月28日
        </p>
      </div>
    </div>
  );
}

const listStyle = {
  marginTop: 'var(--spacing-sm)',
  marginLeft: 'var(--spacing-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-xs)'
} as const;

function Section({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section style={{ marginBottom: 'var(--spacing-lg)' }}>
      <h2 style={{
        fontSize: 'var(--font-size-lg)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-sm)'
      }}>
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
