# GSN Editor

Goal Structuring Notation (GSN) を描画・編集するためのWebアプリケーション。
既存の D-Case Communicator をスクラッチで再実装したプロジェクトです。

## プロジェクト概要

- フロントエンド: React + TypeScript + Vite (SVG描画)
- バックエンド: Express + TypeScript + Prisma + SQLite
- リアルタイム協調: Socket.IO
- 認証: JWT

## 主要機能

- 8種類のGSNノード、ドラッグ移動、サイズ変更
- リッチテキスト編集、ラベル自動採番
- リンク作成/削除、右クリックメニュー
- モジュール機能、パンくずナビゲーション、サブツリーコピー
- 自動レイアウト、Undo/Redo、グリッドスナップ
- GSN検証（6種類）とコメント機能
- プロジェクト/メンバー管理、リアルタイム同期（WebSocket）
- バージョン管理（コミット/履歴/ロールバック）
- JSON/PNG/SVGエクスポート（プロジェクト全体対応）

## セットアップ

### 必要要件
- Node.js 18+
- npm

### バックエンド

```bash
cd backend
npm install
cp .env.example .env
```

`.env` を編集して `JWT_SECRET` を設定します。
SQLite を使用するため、通常は `DATABASE_URL` はデフォルトのままで問題ありません。

```bash
npx prisma migrate dev
npm run dev
```

バックエンドは `http://localhost:3001` で起動します。

### フロントエンド

```bash
cd gsn-editor
npm install
npm run dev
```

フロントエンドは `http://localhost:5173/` で起動します。

## クイック操作

- ノード追加: 左サイドバーからタイプ選択 → キャンバスクリック
- 編集: ダブルクリックで編集モーダル
- リンク: 右クリック → 「子ノードにリンク」
- モジュール化: Goal右クリック → 「モジュールにする」
- コミット: ヘッダーの💾ボタン → コミットメッセージ入力
- 履歴表示: ヘッダーの📜ボタン → バージョン選択で復元
- エクスポート: ヘッダーの「エクスポート ▾」

## リアルタイム同時編集のテスト

1. 2つのブラウザを起動
2. それぞれ別ユーザーでログイン
3. 同じプロジェクトを開く
4. ノード/リンク操作が同期されることを確認

## ドキュメント

- 詳細仕様・設計メモ: `CLAUDE.md`
- GSN描画仕様: `GSN_DRAWING_SPEC.md`
- マルチユーザー仕様: `MULTIUSER_SPEC.md`
- テストガイド: `TESTING.md`
- レガシー版の手順: `LEGACY.md`

## ディレクトリ構成

```
newD-CaseCommunicatorM1/
├── gsn-editor/                    # フロントエンド（React）
├── backend/                       # バックエンド（Express + Prisma）
├── dcase_com-main/                # レガシー参照コード（AngularJS版）
├── CLAUDE.md                      # 詳細仕様・設計メモ
├── GSN_DRAWING_SPEC.md            # GSN描画仕様
├── MULTIUSER_SPEC.md              # マルチユーザー仕様
├── TESTING.md                     # テストガイド
└── LEGACY.md                      # レガシー版セットアップ
```

## ライセンス

(ライセンス情報を記載)
