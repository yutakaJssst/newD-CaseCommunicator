# GSN Editor マルチユーザー対応 設計仕様書

**作成日**: 2025-12-17
**参考**: D-Case Communicator (dcase_com-main)

---

## 📋 目次

1. [概要](#概要)
2. [既存D-Case Communicatorの分析](#既存d-case-communicatorの分析)
3. [新規実装の設計](#新規実装の設計)
4. [技術スタック](#技術スタック)
5. [データベース設計](#データベース設計)
6. [API設計](#api設計)
7. [WebSocket通信設計](#websocket通信設計)
8. [権限管理](#権限管理)
9. [実装ロードマップ](#実装ロードマップ)

---

## 概要

### 目標

既存のGSN Editorにマルチユーザー機能を追加し、以下を実現する：

1. **ユーザー登録・認証**: メールアドレスとパスワードによるユーザー管理
2. **プロジェクト管理**: ユーザーごとに複数のGSNプロジェクトを作成・管理
3. **共有機能**: プロジェクトを他のユーザーと共有
4. **リアルタイム同時編集**: 複数ユーザーが同時に同じプロジェクトを編集
5. **権限管理**: オーナー、メンバー、閲覧者の3段階の権限
6. **変更履歴**: コミット・履歴機能による変更追跡

### スコープ（Phase 5）

**実装する機能:**
- ✅ ユーザー登録・ログイン・ログアウト
- ✅ プロジェクト一覧・作成・削除
- ✅ プロジェクト共有（メンバー追加・削除）
- ✅ リアルタイム同時編集（WebSocket）
- ✅ 権限管理（オーナー、編集者、閲覧者）
- ✅ オンライン状態表示（誰が編集中か）

**将来実装（Phase 6以降）:**
- ⏳ コミット・履歴管理
- ⏳ チャット機能
- ⏳ 通知機能（Slack連携等）
- ⏳ 公開プロジェクト（URL共有）

---

## 既存D-Case Communicatorの分析

### アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│  フロントエンド (AngularJS + D3.js)            │
├─────────────────────────────────────────────────┤
│  WebSocket通信 (Socket.io / Python server)     │
├─────────────────────────────────────────────────┤
│  REST API (PHP)                                 │
├─────────────────────────────────────────────────┤
│  データベース (MongoDB)                         │
└─────────────────────────────────────────────────┘
```

### 主要機能の実装方法

#### 1. 認証システム

**login.php:**
- メールアドレスとパスワード（SHA256 + salt）でログイン
- `authID`（セッショントークン）を発行、有効期限6時間
- MongoDBの`UserInfo.Auth`コレクションに保存

**認証フロー:**
```
1. ユーザーがメール・パスワードを送信
2. サーバーがDB内のpasswdHash（SHA256）と照合
3. 認証成功 → authIDを生成・返却
4. クライアントがauthIDをCookieまたはLocalStorageに保存
5. 以降の全APIリクエストにauthIDを含める
```

#### 2. プロジェクト管理

**createDCase.php:**
- `dcaseID`をランダム生成（SHA256ハッシュ）
- `dcaseInfo.dcaseList`コレクションに保存
- フィールド:
  - `dcaseID`: プロジェクト一意ID
  - `title`: タイトル
  - `member`: メンバーリスト（userID, userName, position, value）
  - `public`: 公開フラグ（0=非公開、1=公開）
  - `createDay`, `updateDay`: 作成・更新日時

**getDCaseList.php:**
- ユーザーIDに基づいてプロジェクト一覧を取得
- 自分がメンバーになっているプロジェクトのみ表示

#### 3. リアルタイム同時編集

**WebSocket通信（SendMessage.js / RecvMessage.js）:**

**送信メッセージ例:**
```javascript
{
  "mode": "createNode",
  "dcaseID": "abc123...",
  "node": {
    "id": "node_1",
    "type": "Goal",
    "x": 100,
    "y": 200,
    "detail": "ノード内容",
    // ...
  },
  "msgCount": 123
}
```

**受信メッセージ例:**
```javascript
{
  "mode": "createNode",
  "dcaseID": "abc123...",
  "node": { /* 同じノードデータ */ }
}
```

**メッセージタイプ:**
- `connected`: クライアント接続
- `createNode`: ノード作成
- `updateNode`: ノード更新
- `deleteNode`: ノード削除
- `moveTo`: ノード移動
- `changeSize`: ノードサイズ変更

**WebSocketサーバー（Python）:**
- すべての接続クライアントにブロードキャスト
- 同じ`dcaseID`のクライアントにのみ配信

#### 4. 権限管理

**memberフィールド構造:**
```javascript
{
  "userID": "user_001",
  "userName": "山田 太郎",
  "position": 0,  // 0=オーナー, 1=編集者, 2=閲覧者
  "value": 5      // 貢献度（将来的な拡張用）
}
```

**position（権限レベル）:**
- `0`: オーナー（削除、メンバー管理可能）
- `1`: 編集者（編集可能）
- `2`: 閲覧者（読み取り専用）

---

## 新規実装の設計

### アーキテクチャ（モダン技術スタック）

```
┌─────────────────────────────────────────────────┐
│  フロントエンド (React 19 + TypeScript)        │
├─────────────────────────────────────────────────┤
│  WebSocket通信 (Socket.IO v4)                   │
├─────────────────────────────────────────────────┤
│  REST API (Node.js + Express)                   │
├─────────────────────────────────────────────────┤
│  データベース (PostgreSQL / MongoDB)            │
└─────────────────────────────────────────────────┘
```

### ディレクトリ構成

```
newD-CaseCommunicatorM1/
├── gsn-editor/                    # フロントエンド（既存）
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   └── PasswordReset.tsx
│   │   │   ├── Projects/
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── CreateProjectDialog.tsx
│   │   │   │   └── ShareProjectDialog.tsx
│   │   │   ├── Collaboration/
│   │   │   │   ├── OnlineUsers.tsx
│   │   │   │   ├── UserCursor.tsx
│   │   │   │   └── PresenceIndicator.tsx
│   │   │   └── (既存コンポーネント)
│   │   ├── stores/
│   │   │   ├── authStore.ts       # 認証状態管理
│   │   │   ├── projectStore.ts    # プロジェクト一覧管理
│   │   │   └── diagramStore.ts    # 既存（拡張）
│   │   ├── services/
│   │   │   ├── api.ts             # REST APIクライアント
│   │   │   └── websocket.ts       # WebSocketクライアント
│   │   └── types/
│   │       ├── auth.ts
│   │       └── project.ts
│   └── package.json
│
├── backend/                        # バックエンド（新規）
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── projectController.ts
│   │   │   └── diagramController.ts
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Project.ts
│   │   │   └── Diagram.ts
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   └── websocketService.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   └── diagrams.ts
│   │   ├── websocket/
│   │   │   └── handlers.ts
│   │   ├── db/
│   │   │   └── connection.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
│
└── MULTIUSER_SPEC.md              # 本ドキュメント
```

---

## 技術スタック

### フロントエンド（既存 + 拡張）

- **React 19.2.0** - UIフレームワーク
- **TypeScript 5.9.3** - 型安全性
- **Zustand 5.0.9** - 状態管理（既存）
- **Socket.IO Client 4.x** - WebSocket通信
- **Axios / Fetch** - HTTP通信
- **React Router 6.x** - ルーティング（ログイン画面等）
- **Vite 7.2.4** - ビルドツール

### バックエンド（新規）

- **Node.js 20+** - ランタイム
- **Express 4.x** - Webフレームワーク
- **TypeScript 5.x** - 型安全性
- **Socket.IO 4.x** - WebSocketサーバー
- **Prisma / Mongoose** - ORM/ODM
- **PostgreSQL / MongoDB** - データベース
- **bcrypt** - パスワードハッシュ化
- **jsonwebtoken (JWT)** - 認証トークン
- **express-validator** - バリデーション
- **dotenv** - 環境変数管理

### インフラ

- **Docker / Docker Compose** - コンテナ化
- **Nginx** - リバースプロキシ（本番環境）

---

## データベース設計

### オプション1: PostgreSQL（推奨）

**理由:**
- リレーショナルデータの整合性
- トランザクション対応
- 権限管理・共有機能に適している

#### テーブル設計

**users テーブル:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

**projects テーブル:**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
```

**project_members テーブル:**
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

**diagrams テーブル:**
```sql
CREATE TABLE diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,  -- GSN図のデータ（nodes, links等）
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diagrams_project ON diagrams(project_id);
```

**sessions テーブル（認証トークン管理）:**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

**activity_logs テーブル（将来の履歴管理用）:**
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,  -- 'create_node', 'update_node', 'delete_node', etc.
  data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_project ON activity_logs(project_id);
```

### オプション2: MongoDB（既存D-Case互換）

既存D-Case Communicatorと同じMongoDBを使用する場合。

**コレクション設計:**

**UserInfo.UserList:**
```javascript
{
  _id: ObjectId,
  userID: "user_001",
  email: "user@example.com",
  passwordHash: "sha256hash...",
  salt: "random_salt",
  firstName: "太郎",
  lastName: "山田",
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

**UserInfo.Auth:**
```javascript
{
  _id: ObjectId,
  userID: "user_001",
  email: "user@example.com",
  authID: "session_token_...",
  timeout: 20251217180000  // YmdHis形式
}
```

**dcaseInfo.projectList:**
```javascript
{
  _id: ObjectId,
  projectID: "proj_abc123",
  title: "安全性論証プロジェクト",
  description: "説明文",
  ownerID: "user_001",
  members: [
    {
      userID: "user_001",
      userName: "山田 太郎",
      role: "owner",  // owner, editor, viewer
      addedAt: ISODate()
    }
  ],
  isPublic: false,
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

**dcaseInfo.diagrams:**
```javascript
{
  _id: ObjectId,
  diagramID: "diag_xyz789",
  projectID: "proj_abc123",
  title: "メインダイアグラム",
  data: {
    version: "1.0.0",
    nodes: [ /* ノード配列 */ ],
    links: [ /* リンク配列 */ ],
    modules: { /* モジュール */ }
  },
  version: 1,
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

---

## API設計

### 認証API

**POST /api/auth/register**
- ユーザー登録
- リクエスト:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "firstName": "太郎",
    "lastName": "山田"
  }
  ```
- レスポンス:
  ```json
  {
    "result": "OK",
    "user": {
      "id": "user_001",
      "email": "user@example.com",
      "firstName": "太郎",
      "lastName": "山田"
    }
  }
  ```

**POST /api/auth/login**
- ログイン
- リクエスト:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- レスポンス:
  ```json
  {
    "result": "OK",
    "token": "jwt_token_here...",
    "user": {
      "id": "user_001",
      "email": "user@example.com",
      "firstName": "太郎",
      "lastName": "山田"
    }
  }
  ```

**POST /api/auth/logout**
- ログアウト
- ヘッダー: `Authorization: Bearer <token>`
- レスポンス:
  ```json
  {
    "result": "OK"
  }
  ```

**GET /api/auth/me**
- 現在のユーザー情報取得
- ヘッダー: `Authorization: Bearer <token>`
- レスポンス:
  ```json
  {
    "result": "OK",
    "user": {
      "id": "user_001",
      "email": "user@example.com",
      "firstName": "太郎",
      "lastName": "山田"
    }
  }
  ```

### プロジェクト管理API

**GET /api/projects**
- プロジェクト一覧取得
- ヘッダー: `Authorization: Bearer <token>`
- レスポンス:
  ```json
  {
    "result": "OK",
    "projects": [
      {
        "id": "proj_001",
        "title": "安全性論証",
        "description": "説明文",
        "role": "owner",
        "isPublic": false,
        "createdAt": "2025-12-17T10:00:00Z",
        "updatedAt": "2025-12-17T12:00:00Z"
      }
    ]
  }
  ```

**POST /api/projects**
- プロジェクト作成
- リクエスト:
  ```json
  {
    "title": "新規プロジェクト",
    "description": "説明文",
    "isPublic": false
  }
  ```
- レスポンス:
  ```json
  {
    "result": "OK",
    "project": {
      "id": "proj_002",
      "title": "新規プロジェクト",
      "description": "説明文",
      "role": "owner",
      "isPublic": false
    }
  }
  ```

**GET /api/projects/:id**
- プロジェクト詳細取得
- レスポンス:
  ```json
  {
    "result": "OK",
    "project": {
      "id": "proj_001",
      "title": "安全性論証",
      "description": "説明文",
      "role": "editor",
      "members": [
        {
          "userId": "user_001",
          "userName": "山田 太郎",
          "role": "owner"
        }
      ],
      "diagrams": [
        {
          "id": "diag_001",
          "title": "メインダイアグラム"
        }
      ]
    }
  }
  ```

**DELETE /api/projects/:id**
- プロジェクト削除（オーナーのみ）

**POST /api/projects/:id/members**
- メンバー追加
- リクエスト:
  ```json
  {
    "email": "member@example.com",
    "role": "editor"  // editor or viewer
  }
  ```

**DELETE /api/projects/:id/members/:userId**
- メンバー削除（オーナーのみ）

### ダイアグラムAPI

**GET /api/projects/:projectId/diagrams/:diagramId**
- ダイアグラムデータ取得
- レスポンス:
  ```json
  {
    "result": "OK",
    "diagram": {
      "id": "diag_001",
      "projectId": "proj_001",
      "title": "メインダイアグラム",
      "data": {
        "version": "1.0.0",
        "nodes": [ /* ... */ ],
        "links": [ /* ... */ ]
      }
    }
  }
  ```

**PUT /api/projects/:projectId/diagrams/:diagramId**
- ダイアグラム保存（手動保存時）
- リクエスト:
  ```json
  {
    "title": "更新されたタイトル",
    "data": {
      "version": "1.0.0",
      "nodes": [ /* ... */ ],
      "links": [ /* ... */ ]
    }
  }
  ```

---

## WebSocket通信設計

### 接続フロー

```
1. クライアント: Socket.IOでサーバーに接続
2. クライアント: 認証トークンを送信
3. サーバー: トークン検証
4. クライアント: プロジェクトに参加（join room）
5. サーバー: 他のクライアントに「ユーザー参加」を通知
6. 以降、リアルタイム同期
```

### イベント設計

#### クライアント → サーバー

**join_project**
```javascript
{
  "projectId": "proj_001",
  "diagramId": "diag_001"
}
```

**leave_project**
```javascript
{
  "projectId": "proj_001"
}
```

**node_created**
```javascript
{
  "projectId": "proj_001",
  "diagramId": "diag_001",
  "node": {
    "id": "node_123",
    "type": "Goal",
    "position": { "x": 100, "y": 200 },
    "size": { "width": 180, "height": 120 },
    "content": "ノード内容",
    "label": "G1"
  }
}
```

**node_updated**
```javascript
{
  "projectId": "proj_001",
  "diagramId": "diag_001",
  "nodeId": "node_123",
  "updates": {
    "content": "更新された内容",
    "position": { "x": 150, "y": 250 }
  }
}
```

**node_deleted**
```javascript
{
  "projectId": "proj_001",
  "diagramId": "diag_001",
  "nodeId": "node_123"
}
```

**node_moved**
```javascript
{
  "projectId": "proj_001",
  "diagramId": "diag_001",
  "nodeId": "node_123",
  "position": { "x": 200, "y": 300 }
}
```

**link_created / link_deleted**
```javascript
{
  "projectId": "proj_001",
  "diagramId": "diag_001",
  "link": {
    "id": "link_456",
    "source": "node_123",
    "target": "node_789",
    "type": "solid"
  }
}
```

**cursor_moved**（将来実装）
```javascript
{
  "projectId": "proj_001",
  "position": { "x": 500, "y": 400 }
}
```

#### サーバー → クライアント

**user_joined**
```javascript
{
  "userId": "user_002",
  "userName": "佐藤 花子",
  "timestamp": "2025-12-17T10:30:00Z"
}
```

**user_left**
```javascript
{
  "userId": "user_002",
  "userName": "佐藤 花子",
  "timestamp": "2025-12-17T11:00:00Z"
}
```

**node_created / node_updated / node_deleted / node_moved**
- クライアントから受信したイベントを他のクライアントにブロードキャスト
- 送信者自身には送らない（`socket.broadcast.to(roomId).emit()`）

**sync_required**
```javascript
{
  "reason": "conflict_detected"
}
```

### 競合解決戦略

**基本方針: Last Write Wins (LWW)**
- タイムスタンプで最後の更新を優先
- 競合検出時は警告をクライアントに送信

**将来的な改善（Operational Transformation / CRDT）:**
- Phase 6以降で検討

---

## 権限管理

### ロール定義

| ロール | 権限 |
|--------|------|
| **owner** | プロジェクト削除、メンバー管理、編集、閲覧 |
| **editor** | 編集、閲覧 |
| **viewer** | 閲覧のみ |

### 権限チェック（ミドルウェア）

**バックエンド（auth.ts）:**
```typescript
export const requireProjectAccess = (minRole: 'viewer' | 'editor' | 'owner') => {
  return async (req, res, next) => {
    const { projectId } = req.params;
    const userId = req.user.id;

    const member = await db.projectMembers.findOne({
      projectId,
      userId
    });

    if (!member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const roleHierarchy = { viewer: 0, editor: 1, owner: 2 };
    if (roleHierarchy[member.role] < roleHierarchy[minRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.userRole = member.role;
    next();
  };
};
```

**フロントエンド（authStore.ts）:**
```typescript
interface ProjectMember {
  userId: string;
  userName: string;
  role: 'owner' | 'editor' | 'viewer';
}

export const canEdit = (role: string): boolean => {
  return role === 'owner' || role === 'editor';
};

export const canDelete = (role: string): boolean => {
  return role === 'owner';
};
```

---

## 実装ロードマップ

### Phase 5-1: 認証システム（1週間）

**バックエンド:**
- ✅ Express + TypeScriptセットアップ
- ✅ PostgreSQL接続設定
- ✅ Userモデル作成
- ✅ /auth/register, /auth/login, /auth/logout API実装
- ✅ JWTトークン発行・検証

**フロントエンド:**
- ✅ LoginForm, RegisterFormコンポーネント作成
- ✅ authStore実装（Zustand）
- ✅ ログイン状態の永続化（LocalStorage）
- ✅ APIクライアント（Axios）実装

### Phase 5-2: プロジェクト管理（1週間）

**バックエンド:**
- ✅ Project, ProjectMemberモデル作成
- ✅ /projects/* API実装（CRUD + メンバー管理）
- ✅ 権限チェックミドルウェア

**フロントエンド:**
- ✅ ProjectListコンポーネント
- ✅ CreateProjectDialog
- ✅ ShareProjectDialog
- ✅ projectStore実装

### Phase 5-3: リアルタイム同時編集（2週間）

**バックエンド:**
- ✅ Socket.IOサーバーセットアップ
- ✅ WebSocketイベントハンドラ実装
- ✅ ルーム管理（プロジェクトごと）
- ✅ オンライン状態管理

**フロントエンド:**
- ✅ Socket.IOクライアント統合
- ✅ diagramStoreをWebSocket対応に拡張
- ✅ OnlineUsersコンポーネント
- ✅ リアルタイム更新の反映

### Phase 5-4: UI/UX改善（1週間）

- ✅ ローディング状態表示
- ✅ エラーハンドリング改善
- ✅ オンライン状態の視覚的表示
- ✅ 競合警告UI

**合計工数**: 約5週間

---

## セキュリティ考慮事項

### 認証

- ✅ パスワードは`bcrypt`でハッシュ化（saltラウンド10以上）
- ✅ JWTトークンは短時間（6時間）で期限切れ
- ✅ HTTPS通信必須（本番環境）
- ✅ CSRF対策（SameSite Cookie）

### WebSocket

- ✅ 接続時に認証トークン検証
- ✅ イベントごとに権限チェック
- ✅ Rate Limiting（DoS対策）

### データ保護

- ✅ SQL Injection対策（Prisma / Mongoose使用）
- ✅ XSS対策（React標準のエスケープ）
- ✅ 環境変数で機密情報管理（.env）

---

## 参考資料

- **既存D-Case Communicator**: `/dcase_com-main/`
- **Socket.IO Documentation**: https://socket.io/docs/v4/
- **Prisma Documentation**: https://www.prisma.io/docs
- **JWT Best Practices**: https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/

---

**次のステップ:**
1. バックエンドのセットアップ（Node.js + Express + PostgreSQL）
2. 認証API実装
3. フロントエンドのログイン画面実装

実装を開始する準備ができましたら、お知らせください！
