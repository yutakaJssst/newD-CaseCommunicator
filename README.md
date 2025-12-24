# GSN Editor

Goal Structuring Notation (GSN) を描画・編集するためのWebアプリケーション。
既存の D-Case Communicator をスクラッチで再実装したプロジェクトです。

## 技術スタック

- **フロントエンド**: React 19 + TypeScript 5.9 + Vite 7 (SVG描画)
- **バックエンド**: Express 5 + TypeScript + Prisma 6 + SQLite
- **リアルタイム協調**: Socket.IO 4.8
- **認証**: JWT + bcrypt
- **状態管理**: Zustand 5.0

## 主要機能

### GSN描画
- 8種類のノード（Goal, Strategy, Context, Evidence, Assumption, Justification, Undeveloped, Module）
- ドラッグ移動、サイズ変更、リッチテキスト編集
- リンク作成/削除、右クリックメニュー
- ラベル自動採番、グリッドスナップ

### 高度な機能
- モジュール機能とパンくずナビゲーション
- 自動レイアウト（Reingold-Tilford）
- Undo/Redo、サブツリーコピー
- GSN検証（6種類：ルートノード、循環参照、孤立ノード等）
- コメント機能（ノード単位）
- パターン保存・再利用

### 協調作業
- プロジェクト/メンバー管理（owner/editor/viewer）
- リアルタイム同期（WebSocket）
- ユーザーカーソル表示
- バージョン管理（コミット/履歴/ロールバック）

### アンケート
- GSNからアンケート自動生成（Goal/Strategy）
- 公開URLで回答収集（ログイン不要）
- スコア0〜3は必須、コメント任意
- 回答者向け説明文・画像（10MBまで）
- 集計（平均/件数）表示とCSV出力
- 回答到着時に集計を自動更新

### エクスポート
- JSON（単一ダイアグラム/プロジェクト全体）
- PNG/SVG画像
- アンケート結果CSV

## セットアップ

### 必要要件
- Node.js 18+
- npm

### バックエンド

```bash
cd backend
npm install
cp .env.example .env  # JWT_SECRETを設定
npx prisma migrate dev
npm run dev  # → http://localhost:3001
```

### フロントエンド

```bash
cd gsn-editor
npm install
npm run dev  # → http://localhost:5173
```

## クイック操作ガイド

| 操作 | 方法 |
|------|------|
| ノード追加 | 左サイドバーからタイプ選択 → キャンバスクリック |
| ノード編集 | ダブルクリック |
| リンク追加 | 右クリック → 「子ノードにリンク」 |
| モジュール化 | Goal右クリック → 「モジュールにする」 |
| コミット | ヘッダー💾ボタン |
| 履歴表示 | ヘッダー📜ボタン |
| 検証 | ヘッダー✓ボタン |
| アンケート管理 | ヘッダー「アンケート」ボタン |
| パターン保存 | ノード選択 → 右クリック → 「パターンとして保存」 |
| パターン適用 | ヘッダー📋ボタン → パターン選択 → 「適用」 |
| エクスポート | ヘッダー「エクスポート ▾」 |
| Undo/Redo | Ctrl+Z / Ctrl+Y (macOS: Cmd+Z / Cmd+Y) |
| 全選択 | Ctrl+A (macOS: Cmd+A) |
| コピー&ペースト | Ctrl+C / Ctrl+V |
| 削除 | Delete or Backspace |
| 全体表示 | ヘッダー⊡ボタン |

## リアルタイム同時編集のテスト

1. 2つのブラウザを起動
2. それぞれ別ユーザーでログイン
3. 同じプロジェクトを開く
4. ノード/リンク操作が同期されることを確認
5. ヘッダーに「○人オンライン」と表示される

## テスト結果 (2025-12-24)

- `backend`: `npm run build` ✅
- `gsn-editor`: `npm run build` ✅（Viteのdynamic import警告あり）
- 実ブラウザでの機能テストは未実施

## ディレクトリ構成

```
newD-CaseEditor/
├── gsn-editor/          # フロントエンド（React）
│   └── src/
│       ├── components/  # UI コンポーネント
│       ├── stores/      # Zustand状態管理
│       ├── services/    # API・WebSocketクライアント
│       ├── api/         # APIエンドポイント定義
│       ├── types/       # TypeScript型定義
│       └── utils/       # ユーティリティ関数
├── backend/             # バックエンド（Express + Prisma）
│   ├── src/
│   │   ├── controllers/ # ビジネスロジック
│   │   ├── routes/      # APIルート
│   │   ├── middleware/  # 認証・エラーハンドリング
│   │   └── websocket/   # WebSocketハンドラー
│   └── prisma/
│       ├── schema.prisma  # DBスキーマ
│       └── dev.db         # SQLite DB
├── dcase_com-main/      # レガシー参照コード（AngularJS版）
├── CLAUDE.md            # 詳細仕様・開発メモ
├── GSN_DRAWING_SPEC.md  # GSN描画仕様
└── TESTING.md           # テストガイド
```

## ドキュメント

- **開発メモ**: [CLAUDE.md](CLAUDE.md) - 技術仕様、実装履歴
- **GSN仕様**: [GSN_DRAWING_SPEC.md](GSN_DRAWING_SPEC.md) - ノード/リンク描画仕様
- **テストガイド**: [TESTING.md](TESTING.md) - API/機能テスト手順

## データベーススキーマ

- **User**: ユーザー情報
- **Session**: 認証セッション
- **Project**: プロジェクト
- **ProjectMember**: メンバー管理（role: owner/editor/viewer）
- **Diagram**: GSNダイアグラムデータ（JSON）
- **DiagramVersion**: バージョン履歴
- **Pattern**: 再利用可能なGSNパターン
- **Survey**: アンケート本体（説明文・公開画像含む）
- **SurveyQuestion**: 質問（ノード参照）
- **SurveyResponse**: 回答単位
- **SurveyAnswer**: 回答内容（スコア/コメント）
- **ActivityLog**: アクティビティログ

## 開発ガイドライン

- **型安全**: TypeScript strictモード厳守
- **コードスタイル**: ESLint + Prettier
- **状態管理**: Zustand（LocalStorage永続化）
- **API設計**: RESTful + WebSocket
- **セキュリティ**: JWT認証、SQLインジェクション対策（Prisma）、XSS対策

## ライセンス

(ライセンス情報を記載)
