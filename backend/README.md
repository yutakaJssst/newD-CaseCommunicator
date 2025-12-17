# GSN Editor Backend

Node.js + Express + TypeScript + PostgreSQL + Socket.IO

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を`.env`にコピーして編集:

```bash
cp .env.example .env
```

`.env`ファイルを編集して、PostgreSQLの接続情報を設定:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/gsn_editor?schema=public"
JWT_SECRET=your-secret-key
```

### 3. PostgreSQLの起動

Dockerを使用する場合:

```bash
docker run --name gsn-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=gsn_editor \
  -p 5432:5432 \
  -d postgres:16
```

または、ローカルにインストールされているPostgreSQLを使用。

### 4. データベースのマイグレーション

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

サーバーは `http://localhost:3001` で起動します。

## スクリプト

- `npm run dev` - 開発サーバー起動（ホットリロード対応）
- `npm run build` - TypeScriptをコンパイル
- `npm start` - 本番サーバー起動
- `npm run prisma:generate` - Prisma Clientを生成
- `npm run prisma:migrate` - データベースマイグレーション
- `npm run prisma:studio` - Prisma Studio（GUI）を起動

## API エンドポイント

### 認証

- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報取得

### プロジェクト（未実装）

- `GET /api/projects` - プロジェクト一覧
- `POST /api/projects` - プロジェクト作成
- `GET /api/projects/:id` - プロジェクト詳細
- `DELETE /api/projects/:id` - プロジェクト削除
- `POST /api/projects/:id/members` - メンバー追加
- `DELETE /api/projects/:id/members/:userId` - メンバー削除

### ダイアグラム（未実装）

- `GET /api/projects/:projectId/diagrams/:diagramId` - ダイアグラム取得
- `PUT /api/projects/:projectId/diagrams/:diagramId` - ダイアグラム保存

## WebSocket イベント

### クライアント → サーバー

- `join_project` - プロジェクトに参加
- `leave_project` - プロジェクトから退出
- `node_created` - ノード作成
- `node_updated` - ノード更新
- `node_deleted` - ノード削除
- `node_moved` - ノード移動
- `link_created` - リンク作成
- `link_deleted` - リンク削除

### サーバー → クライアント

- `user_joined` - ユーザー参加通知
- `user_left` - ユーザー退出通知
- `node_created` - ノード作成通知
- `node_updated` - ノード更新通知
- `node_deleted` - ノード削除通知
- `node_moved` - ノード移動通知
- `link_created` - リンク作成通知
- `link_deleted` - リンク削除通知

## ディレクトリ構造

```
backend/
├── src/
│   ├── controllers/       # APIコントローラー
│   ├── routes/           # ルート定義
│   ├── middleware/       # ミドルウェア（認証、エラーハンドリング等）
│   ├── services/         # ビジネスロジック
│   ├── models/           # データモデル
│   ├── websocket/        # WebSocketハンドラー
│   ├── db/               # データベース接続
│   ├── types/            # TypeScript型定義
│   ├── utils/            # ユーティリティ関数
│   └── server.ts         # エントリーポイント
├── prisma/
│   └── schema.prisma     # データベーススキーマ
├── .env                  # 環境変数
└── package.json
```

## 開発状況

### ✅ 完了

- プロジェクトセットアップ
- Prismaスキーマ定義
- 認証API（register, login, logout, me）
- 認証ミドルウェア
- WebSocket基本実装
- エラーハンドリング

### 🚧 作業中

- プロジェクト管理API
- ダイアグラム管理API
- 権限チェックミドルウェア

### 📋 TODO

- オンラインユーザー追跡
- 競合解決機能
- アクティビティログ
- テスト実装
