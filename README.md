# GSN Editor

Goal Structuring Notation (GSN) を描画・編集するためのWebアプリケーション。

## プロジェクト概要

既存の **D-Case Communicator** をスクラッチで作り直すプロジェクト。
まずは基本的なGSN描画機能の実装を目指しています。

### 現在の実装状態

**Phase 1 (MVP)**: ✅ 完了
**Phase 2**: 🚧 一部完了（ノードリサイズ、GSN標準準拠リンク）

## 技術スタック

- **フレームワーク**: React 19.2.0
- **言語**: TypeScript 5.9.3
- **状態管理**: Zustand 5.0.9
- **ビルドツール**: Vite 7.2.4
- **描画**: SVG (ネイティブ)
- **パッケージマネージャ**: npm

## 主要機能

### 実装済み

- ✅ GSN要素（7種類のノード）の描画
  - Goal, Strategy, Context, Evidence, Assumption, Justification, Undeveloped
- ✅ ノード間の接続（リンク）の描画
  - GSN標準準拠: Context/Assumption/Justificationへのリンクは白抜き矢印
  - スマート接続点計算: 横並び・縦並びに応じた最適な接続
- ✅ ノードの配置・移動（ドラッグ&ドロップ）
- ✅ ノードのサイズ変更（4方向リサイズハンドル）
- ✅ キャンバスの拡大縮小・パン操作
  - Ctrl/Cmd + ホイール: ズーム
  - 中ボタンドラッグ / Shift+左ドラッグ: パン
- ✅ ノード内容の編集（モーダルダイアログ）
- ✅ JSONエクスポート/インポート
- ✅ 右クリックメニュー（リンク追加、ノード削除）

### 未実装（今後の予定）

- ❌ リアルタイム同期
- ❌ ユーザー認証・権限管理
- ❌ テンプレート機能
- ❌ 履歴管理・コミット
- ❌ LocalStorage自動保存
- ❌ Undo/Redo
- ❌ リッチテキストエディタ
- ❌ PNG/SVGエクスポート

## セットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd newD-CaseCommunicator/gsn-editor

# 依存関係をインストール
npm install

# 開発サーバー起動
npm run dev
```

開発サーバーは http://localhost:5173/ で起動します。

## ビルド

```bash
# プロダクションビルド
npm run build

# ビルド結果をプレビュー
npm run preview
```

## 使い方

### ノードの追加

1. 左サイドバーからノードタイプを選択
2. キャンバスをクリックして配置

### リンクの作成

1. 親ノードを右クリック
2. 「リンク追加」を選択
3. 子ノードをクリック

### ノードの編集

- ノードをダブルクリックで編集モーダルを表示

### ノードのサイズ変更

- ノードを選択すると4隅にリサイズハンドル（小さな正方形）が表示
- ハンドルをドラッグしてサイズ変更

### キャンバス操作

- **ズーム**: Ctrl/Cmd + マウスホイール
- **パン**: 中ボタンドラッグ または Shift+左ドラッグ
- **選択解除**: 空白領域をクリック

### データの保存・読み込み

- ヘッダーの「エクスポート」ボタンでJSONファイルをダウンロード
- ヘッダーの「インポート」ボタンでJSONファイルを読み込み

## GSN標準への準拠

### ノードタイプ

| タイプ | 形状 | デフォルト色 | 用途 |
|--------|------|--------------|------|
| Goal | 矩形 | 薄緑 (#CCFFCC) | 達成すべき目標 |
| Strategy | 平行四辺形 | 白 (#FFFFFF) | ゴール分解の方針 |
| Context | 角丸矩形 | 白 (#FFFFFF) | 前提条件 |
| Evidence | 楕円 | 薄橙 (#FFC5AA) | ゴール達成の根拠 |
| Assumption | 楕円 | 薄黄 (#FFE699) | 論証の仮定事項 |
| Justification | 楕円 | 薄青 (#BDD7EE) | 戦略の正当性根拠 |
| Undeveloped | ダイヤモンド | 白 (#FFFFFF) | 未展開のゴール |

### リンクの種類

- **SupportedBy（サポート関係）**: 塗りつぶし矢印 + 実線
  - Goal/Strategy/Evidenceノードへのリンク
- **InContextOf（文脈関係）**: 白抜き矢印 + 実線
  - Context/Assumption/Justificationノードへのリンク
  - 自動的に白抜き矢印が適用される

## プロジェクト構成

```
gsn-editor/
├── src/
│   ├── App.tsx                    # メインアプリケーション
│   ├── main.tsx                   # エントリーポイント
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── Canvas.tsx         # SVGキャンバス
│   │   │   ├── Node.tsx           # ノード描画
│   │   │   ├── Link.tsx           # リンク描画
│   │   │   ├── NodeEditor.tsx    # ノード編集モーダル
│   │   │   └── ContextMenu.tsx   # 右クリックメニュー
│   │   ├── Header/
│   │   │   └── Header.tsx         # ヘッダー
│   │   └── Sidebar/
│   │       ├── Sidebar.tsx        # サイドバー
│   │       └── NodePalette.tsx   # ノードパレット
│   ├── stores/
│   │   └── diagramStore.ts        # Zustand状態管理
│   ├── types/
│   │   └── diagram.ts             # TypeScript型定義
│   └── utils/
├── public/
└── index.html
```

## 開発ガイド

詳細な開発ガイドは [CLAUDE.md](./CLAUDE.md) を参照してください。

## 参考資料

- [GSN Community Standard Version 3.0 (2021)](https://scsc.uk/gsn)
- 既存D-Case Communicator実装（`dcase_com-main/` ディレクトリ）

## ライセンス

(ライセンス情報を記載)

## 更新履歴

### 2025-12-09

- ✅ Phase 1 (MVP) 完了
- ✅ ノードサイズ変更機能実装（Phase 2）
- ✅ GSN標準準拠のリンク描画実装（Phase 2）
  - Context/Assumption/Justificationへのリンクは白抜き矢印
  - 相対位置に基づく最適な接続点計算
