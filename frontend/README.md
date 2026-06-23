# Tempica フロントエンド（Next.js）

Claude Design の確定素案（[`design/Tempica.dc.html`](./design/Tempica.dc.html)）に基づく
**React + TypeScript + Next.js（App Router）+ Tailwind CSS** 実装です。

## デザイン

- デザイントークン（ティール系パレット・フォント・角丸）は [`design/README.md`](./design/README.md) を参照。
- 設定は `tailwind.config.ts`（`brand` / `paper` / `line` / `ink` / 状態色）と `app/globals.css`（プリミティブ）に反映。
- フォントは Google Fonts（Noto Sans JP / M PLUS Rounded 1c / JetBrains Mono）を `<link>` で読込。

## 画面（実装済み）

| ルート | 画面 |
|---|---|
| `/login` `/setup` | ログイン / 初期セットアップ（3ステップ） |
| `/dashboard` | ダッシュボード（勤務サマリ・クイック打刻・有給残・最近の申請） |
| `/punch` | 打刻（大型ボタン・GPS・履歴・二重打刻防止連動） |
| `/attendance` | 自分の勤怠（月カレンダー・月次サマリ・日次明細） |
| `/requests` `/requests/new` | 申請一覧・状況 / 申請作成（種別タブ） |
| `/approvals` | 承認一覧（承認・差戻し・一括承認） |
| `/shift` `/leave` | シフト / 休暇残数 |
| `/members` `/work-patterns` `/roles` | メンバー / 勤務形態 / ロール・権限 |
| `/closing` | 月次締め・CSV 出力 |
| `/notifications` | 通知 |

サイドナビ／ボトムナビは権限（RBAC）に応じて項目を出し分けます。

## バックエンド連携

- 認証は **HttpOnly セッション Cookie**。API クライアント（`lib/api.ts`）は全リクエストを `credentials: 'include'` で送信。
- `/api/v1/*` は `next.config.mjs` の rewrites で `BACKEND_ORIGIN`（既定 `http://localhost:3000`）へプロキシ。
  これにより Cookie が同一オリジンで共有される。

## 開発

```bash
cd frontend
npm install
cp .env.example .env.local       # BACKEND_ORIGIN をバックエンドに合わせる
npm run dev                      # http://localhost:8080
```

バックエンド（`../backend`）を `:3000` で起動しておくこと。

## ビルド / Docker

```bash
npm run build && npm start       # standalone をローカル起動
# もしくはリポジトリルートで
docker compose up -d --build     # db + backend + frontend
```
