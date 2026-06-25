# Tempica

汎用勤怠管理システム（OSS・自己ホスト型）。多様な勤務形態（固定／フレックス／変形／シフト）に
**組織別設定**＋**従業員ごとの勤務形態割当（有効期間つき）**で対応する、シングルテナント型の勤怠管理基盤です。

打刻 → 集計 → 申請承認 → 月次締め → 給与システム向け汎用CSV出力 までを一元化します。

> 設計書一式は [`docs/`](./docs) を参照してください。本リポジトリは設計書 v1.0（仕様確定）に基づいて実装しています。

## アーキテクチャ

| レイヤー | 採用技術 |
|---|---|
| フロントエンド | React + TypeScript + Next.js（※デザイン確定後に実装） |
| バックエンド | Node.js + NestJS（TypeScript） |
| 認証 | バックエンド内蔵（Passport local + HttpOnly セッション Cookie。セッションは PostgreSQL に格納） |
| データベース | PostgreSQL 16 |
| 非同期/ジョブ | pg-boss（PostgreSQL 上のジョブキュー。Redis 不要） |
| ORM | Prisma |
| 実行環境 | Docker / docker compose |

最小構成は **db + backend + frontend** の 3 サービス。`worker` と `proxy` は任意です。

```
┌──────────┐     ┌─────────────────────────┐     ┌───────────────┐
│ frontend │ ──▶ │ backend (NestJS)        │ ──▶ │ db (Postgres) │
│ Next.js  │     │ API・認証・業務ロジック  │     │ 業務+ジョブ   │
└──────────┘     └─────────────────────────┘     └───────────────┘
                       │  pg-boss ジョブ              ▲
                       ▼                              │
                  ┌──────────┐ ─────────────────────┘
                  │ worker   │ 通知・CSV生成・バッチ（任意）
                  └──────────┘
```

## 実装ステータス（バックエンド）

フロントエンドはデザイン確定待ちのため、本フェーズではバックエンドと基盤を実装しています。

| 機能 | 状態 |
|---|---|
| 初期セットアップ / 認証（セッション Cookie） | ✅ 実装 |
| 組織・部署・メンバー管理 | ✅ 実装 |
| カスタム RBAC（機能 × データ範囲） | ✅ 実装 |
| 勤務形態・就業ルール・個人割当（期間重複ガード） | ✅ 実装 |
| 打刻（二重打刻防止・GPS） | ✅ 実装 |
| 日次集計（労働/残業/深夜/遅刻早退・丸め） | ✅ 実装 |
| 申請・承認ワークフロー（多段・差戻し・取消） | ✅ 実装 |
| 休暇種別・残数 | ✅ 実装 |
| 月次締め（事前チェック・ロック・再オープン） | ✅ 実装 |
| 汎用 CSV 出力（マッピング・エンコーディング） | ✅ 実装 |
| 監査ログ / 通知 | ✅ 実装 |
| シフト・レポート | 🟡 スキャフォルド（API スタブ） |
| フロントエンド画面（Next.js, 全画面） | ✅ 実装（Claude Design 準拠） |

## 開発・起動

### Docker（推奨）

```bash
cp .env.example .env             # 値を設定（DB_PASSWORD / SESSION_SECRET など）
docker compose up -d --build     # 起動（マイグレーション + 初期データ投入まで自動）
# → http://localhost:8080 を開く
```

backend コンテナは起動時に **マイグレーション適用 + 初期データ投入（冪等）** を自動実行するため、
追加の手動手順は不要です（無効化する場合は `AUTO_MIGRATE=false` / `AUTO_SEED=false`）。

デモ用ログイン（シード投入される標準データ）:

| メール | ロール | パスワード |
|---|---|---|
| `admin@example.com` | システム管理者 | `Password123!` |
| `manager@example.com` | 現場管理者 | `Password123!` |
| `employee@example.com` | 一般従業員 | `Password123!` |

空の組織から始めたい場合は、シードをスキップ（`AUTO_SEED=false`）してブラウザの初期セットアップ（S-02）を使用します。

### ローカル（backend 単体）

```bash
cd backend
npm install
cp ../.env.example .env           # DATABASE_URL を起動中の Postgres に向ける
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run start:dev                 # http://localhost:3000/api/v1
```

API ドキュメント（Swagger）は起動後 `http://localhost:3000/api/docs` で参照できます。

## テスト

```bash
cd backend
npm test                          # 単体テスト（業務ロジック）
npm run test:e2e                  # E2E（要 PostgreSQL）
```

## ライセンス

[Apache License 2.0](./LICENSE)
