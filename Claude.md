# GSN Editor 開発プロジェクト

## プロジェクト概要

既存の**D-Case Communicator**（GSN記述ツール）をスクラッチで作り直すプロジェクト。
まずは基本的なGSN描画機能の実装を目指す。

### 既存システムの分析結果

**D-Case Communicator**は、複数ユーザーがネットワーク越しにリアルタイムで協調しながらGSN（Goal Structuring Notation）を記述できるWebアプリケーション。

#### 技術スタック（既存）
- **フロントエンド**: AngularJS, D3.js v4, Bootstrap
- **バックエンド**: PHP, MongoDB
- **通信**: WebSocket (Python websocket-server)
- **サーバー**: Nginx, PHP-FPM
- **インフラ**: Docker対応

#### 主要機能（既存）
1. リアルタイムコラボレーション
2. GSN要素の描画・編集（7種類のノードタイプ）
3. ノード間のリンク作成（実線・破線・二重線）
4. テンプレート機能
5. JSONエクスポート/インポート
6. 権限管理（招待制/全公開/URL公開）
7. コミット/履歴管理
8. Slack連携

#### ファイル構成（既存）
```
dcase_com-main/
├── html/
│   ├── js/
│   │   ├── editor.js          # メインエディタ（1,855行）
│   │   ├── DCaseAPI.js        # API層
│   │   ├── DCaseParts.js      # GSN要素定義
│   │   ├── DBApi.js           # DB API
│   │   ├── SendMessage.js     # WebSocket送信
│   │   └── RecvMessage.js     # WebSocket受信
│   ├── api/                   # PHP APIエンドポイント
│   ├── css/
│   └── [各種HTMLファイル]
└── docker/                    # Docker設定
```

---

## 新規実装の方針

### スコープ

**Phase 1 (MVP) - 基本描画機能のみ実装**
- GSN要素（ノード）の描画
- ノード間の接続（リンク）の描画
- ノードの配置・移動
- ノードのサイズ変更
- キャンバスの拡大縮小・パン操作
- ノード内容の編集
- JSONエクスポート/インポート

**対象外（将来実装予定）**
- リアルタイム同期
- ユーザー認証・権限管理
- テンプレート機能
- 履歴管理・コミット
- 外部連携（Slack等）

### 推奨技術スタック

#### フロントエンド
- **フレームワーク**: React 18+ または Vue 3+
- **言語**: TypeScript
- **描画**: React Flow / D3.js v7+ / Konva.js
- **状態管理**: Zustand (React) / Pinia (Vue)
- **UI**: shadcn/ui (React) / Naive UI (Vue)
- **ビルドツール**: Vite
- **スタイリング**: Tailwind CSS
- **アイコン**: Lucide Icons

#### 開発環境
- **パッケージマネージャ**: pnpm
- **Linter/Formatter**: ESLint + Prettier
- **型チェック**: TypeScript strict mode

---

## GSN要素仕様

### ノードタイプ（7種類）

| タイプ | 日本語名 | 形状 | デフォルト色 | 用途 |
|--------|----------|------|--------------|------|
| Goal | ゴール | 矩形 | `#CCFFCC` (薄緑) | 達成すべき目標 |
| Strategy | 戦略 | 平行四辺形 | `#FFFFFF` (白) | ゴール分解の方針 |
| Context | 前提 | 角丸矩形 | `#FFFFFF` (白) | 前提条件 |
| Evidence | 証拠 | 楕円 | `#FFC5AA` (薄橙) | ゴール達成の根拠 |
| Assumption | 仮定 | 楕円 | `#FFE699` (薄黄) | 論証の仮定事項 |
| Justification | 正当化 | 楕円 | `#BDD7EE` (薄青) | 戦略の正当性根拠 |
| Undeveloped | 未展開 | ダイヤモンド | `#FFFFFF` (白) | 未展開のゴール |

### データ構造

```typescript
interface Node {
  id: string;                    // 一意識別子
  type: NodeType;                // ノードタイプ
  position: { x: number; y: number; };
  size: { width: number; height: number; };
  content: string;               // HTML形式の内容
  style?: {
    borderColor?: string;
    borderWidth?: number;
    fillColor?: string;
  };
}

interface Link {
  id: string;
  source: string;                // 始点ノードID
  target: string;                // 終点ノードID
  type: 'solid' | 'dashed';      // 実線 or 破線
}

interface DiagramData {
  version: string;
  title: string;
  nodes: Node[];
  links: Link[];
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}
```

---

## 実装計画

### Phase 1: MVP（Minimum Viable Product）

**優先順位順**

1. ✅ プロジェクトセットアップ（Vite + React/Vue + TypeScript）
2. ✅ 基本的なノード描画（Goal, Strategy, Context, Evidence）
3. ✅ ノードの配置（クリックで追加）
4. ✅ ノードの移動（ドラッグ&ドロップ）
5. ✅ リンクの作成（実線のみ）
6. ✅ リンクの描画
7. ✅ キャンバスのパン操作
8. ✅ キャンバスのズーム操作
9. ✅ ノード内容の編集（テキストのみ）
10. ✅ JSONエクスポート/インポート

**推定工数**: 1〜2日

### Phase 2: 拡張機能

1. ノードサイズ変更
2. 破線リンク（Context関連）
3. リッチテキストエディタ
4. ノード削除・リンク削除
5. 複数選択
6. Undo/Redo
7. LocalStorageへの自動保存

**推定工数**: 2〜3日

### Phase 3: 高度な機能

1. 全ノードタイプ対応（Assumption, Justification等）
2. ノードスタイルのカスタマイズ
3. グリッドスナップ
4. 整列機能
5. エクスポート（PNG/SVG画像）

**推定工数**: 3〜5日

---

## 主要操作仕様

### ノード操作

#### ノード追加
1. サイドパネルからノードタイプを選択
2. キャンバスをクリック
3. クリック位置にノードを配置（デフォルトサイズ: 180x120）

#### ノード移動
1. ノードをドラッグ
2. マウス移動に追従
3. ドロップで位置確定

#### ノード内容編集
1. ノードをダブルクリック
2. モーダルダイアログ表示
3. リッチテキストエディタで編集
4. 保存ボタンで確定

#### ノード削除
1. 削除モードを選択
2. 対象ノードをクリック
3. ノードと接続リンクを同時削除

### リンク操作

#### リンク追加
1. リンク追加モードを選択
2. 始点ノードをクリック（ハイライト表示）
3. 終点ノードをクリック
4. リンク作成

#### リンク削除
1. 削除モードを選択
2. 対象リンクをクリック
3. 即座に削除

### キャンバス操作

#### パン操作
- 中ボタンドラッグ
- スペースキー + 左ドラッグ
- 空白領域を左ドラッグ

#### ズーム操作
- マウスホイール（Ctrl + ホイール）
- UI上の +/- ボタン
- ズーム範囲: 0.2〜3.0倍
- ズーム中心: マウスカーソル位置

---

## UI構成

```
┌─────────────────────────────────────────────┐
│  ヘッダー                                    │
│  [タイトル入力]  [表示倍率: 1.0x] [-][+]    │
├──────┬──────────────────────────────────────┤
│      │                                      │
│ サイ │                                      │
│ ド   │        キャンバス領域                │
│ パネ │        (SVG)                         │
│ ル   │                                      │
│      │                                      │
│ ┌──┐│                                      │
│ │🎯││                                      │
│ └──┘│                                      │
│ Goal│                                      │
│      │                                      │
│ ┌──┐│                                      │
│ │⬡ ││                                      │
│ └──┘│                                      │
│ Str. │                                      │
│      │                                      │
└──────┴──────────────────────────────────────┘
```

### サイドパネル
- **ノードパレット**: 各ノードタイプのアイコン + ラベル
- **編集メニュー**: リンク追加、削除モード切り替え

### ヘッダー
- タイトル入力欄
- 表示倍率表示
- ズームボタン（+/-）
- メニュー（JSONエクスポート/インポート）

---

## コンポーネント構成（React例）

```
src/
├── components/
│   ├── Canvas/
│   │   ├── Canvas.tsx              # メインキャンバス
│   │   ├── Node.tsx                # ノードコンポーネント
│   │   ├── Link.tsx                # リンクコンポーネント
│   │   └── NodeEditor.tsx          # ノード編集モーダル
│   ├── Sidebar/
│   │   ├── NodePalette.tsx         # ノードパレット
│   │   └── EditMenu.tsx            # 編集メニュー
│   └── Header/
│       └── Header.tsx              # ヘッダー
├── stores/
│   └── diagramStore.ts             # 状態管理（Zustand）
├── types/
│   └── diagram.ts                  # 型定義
└── utils/
    ├── nodeRenderer.ts             # ノード描画ロジック
    └── linkRenderer.ts             # リンク描画ロジック
```

---

## セットアップコマンド（React + Vite）

```bash
# プロジェクト作成
pnpm create vite@latest gsn-editor --template react-ts

# 依存関係インストール
cd gsn-editor
pnpm install

# 追加パッケージ
pnpm add zustand                               # 状態管理
pnpm add @dnd-kit/core @dnd-kit/utilities      # ドラッグ&ドロップ
pnpm add react-quill                           # リッチテキストエディタ
pnpm add lucide-react                          # アイコン
pnpm add tailwindcss postcss autoprefixer
pnpm dlx tailwindcss init -p

# 開発サーバー起動
pnpm dev
```

---

## 非機能要件

### パフォーマンス
- 100ノードまでスムーズに動作
- ドラッグ操作: 60fps以上
- 初期読み込み: 2秒以内

### ブラウザ対応
- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

---

## ドキュメント

- **詳細仕様書**: [GSN_DRAWING_SPEC.md](./GSN_DRAWING_SPEC.md)
- **既存コード**: `dcase_com-main/` ディレクトリ

---

## 参考資料

- GSN Community Standard Version 3.0 (2021)
- https://scsc.uk/gsn
- 既存D-Case Communicator実装

---

**更新日**: 2025-12-09
**プロジェクト状態**: 仕様策定完了、実装準備中
