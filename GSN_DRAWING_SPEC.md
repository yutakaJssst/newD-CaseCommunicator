# GSN基本描画機能 仕様書

## 1. 概要

### 1.1 目的
Goal Structuring Notation (GSN) を用いた安全論証図を描画・編集するための基本機能を実装する。

### 1.2 スコープ
本仕様書では、以下の基本機能に限定する：
- GSN要素（ノード）の描画
- ノード間の接続（リンク）の描画
- ノードの配置・移動
- ノードのサイズ変更
- キャンバスの拡大縮小・パン操作
- ノード内容の編集

**対象外機能（将来実装）**：
- リアルタイム同期
- ユーザー認証・権限管理
- テンプレート機能
- 履歴管理・コミット
- 外部連携（Slack等）

---

## 2. 技術スタック

### 2.1 推奨構成

#### フロントエンド
- **フレームワーク**: React 18+ または Vue 3+
- **言語**: TypeScript
- **描画ライブラリ**: SVG操作に以下のいずれかを使用
  - React Flow (React使用時)
  - D3.js v7+
  - Konva.js + react-konva
- **状態管理**:
  - Zustand または Pinia (Vue)
  - Recoil (React)
- **UI コンポーネント**:
  - shadcn/ui (React)
  - Naive UI (Vue)
- **ビルドツール**: Vite

#### スタイリング
- **CSS フレームワーク**: Tailwind CSS
- **アイコン**: Lucide Icons

#### 開発環境
- **パッケージマネージャ**: pnpm
- **Linter/Formatter**: ESLint + Prettier
- **型チェック**: TypeScript strict mode

---

## 3. GSN要素仕様

### 3.1 ノードタイプ定義

| タイプ | 日本語名 | 形状 | デフォルト色 | 説明 |
|--------|----------|------|--------------|------|
| Goal | ゴール | 矩形 | `#CCFFCC` (薄緑) | 達成すべき目標を記述 |
| Strategy | 戦略 | 平行四辺形 (skewX -15deg) | `#FFFFFF` (白) | ゴール分解の方針を記述 |
| Context | 前提 | 角丸矩形 (rx=10, ry=10) | `#FFFFFF` (白) | ゴール/戦略の前提条件 |
| Evidence | 証拠 | 楕円 | `#FFC5AA` (薄橙) | ゴール達成の根拠 |
| Assumption | 仮定 | 楕円 | `#FFE699` (薄黄) | 論証の仮定事項 |
| Justification | 正当化 | 楕円 | `#BDD7EE` (薄青) | 戦略の正当性根拠 |
| Undeveloped | 未展開 | ダイヤモンド | `#FFFFFF` (白) | 未展開のゴール |

### 3.2 ノードデータ構造

```typescript
interface Node {
  id: string;                    // 一意識別子 (例: "node_abc123")
  type: NodeType;                // ノードタイプ
  position: {
    x: number;                   // X座標 (中心点)
    y: number;                   // Y座標 (中心点)
  };
  size: {
    width: number;               // 幅 (デフォルト: 180px)
    height: number;              // 高さ (デフォルト: 120px)
  };
  content: string;               // HTML形式の内容
  style?: {
    borderColor?: string;        // 枠線色 (デフォルト: #0000FF)
    borderWidth?: number;        // 枠線幅 (デフォルト: 2px)
    fillColor?: string;          // 背景色 (タイプごとのデフォルト)
  };
  label?: string;                // テンプレートラベル (将来機能)
}

type NodeType =
  | 'Goal'
  | 'Strategy'
  | 'Context'
  | 'Evidence'
  | 'Assumption'
  | 'Justification'
  | 'Undeveloped';
```

### 3.3 各ノードのSVG描画仕様

#### Goal (ゴール)
```svg
<rect
  x="{-width/2}"
  y="{-height/2}"
  width="{width}"
  height="{height}"
  fill="#CCFFCC"
  stroke="#0000FF"
  stroke-width="2"
/>
```

#### Strategy (戦略)
```svg
<rect
  x="{-width/2}"
  y="{-height/2}"
  width="{width}"
  height="{height}"
  fill="#FFFFFF"
  stroke="#0000FF"
  stroke-width="2"
  transform="skewX(-15)"
/>
```

#### Context (前提)
```svg
<rect
  x="{-width/2}"
  y="{-height/2}"
  width="{width}"
  height="{height}"
  rx="10"
  ry="10"
  fill="#FFFFFF"
  stroke="#0000FF"
  stroke-width="2"
/>
```

#### Evidence (証拠)
```svg
<ellipse
  cx="0"
  cy="0"
  rx="{width/2}"
  ry="{height/2}"
  fill="#FFC5AA"
  stroke="#0000FF"
  stroke-width="2"
/>
```

#### Assumption (仮定)
```svg
<ellipse
  cx="0"
  cy="0"
  rx="{width/2}"
  ry="{height/2}"
  fill="#FFE699"
  stroke="#0000FF"
  stroke-width="2"
/>
```

#### Justification (正当化)
```svg
<ellipse
  cx="0"
  cy="0"
  rx="{width/2}"
  ry="{height/2}"
  fill="#BDD7EE"
  stroke="#0000FF"
  stroke-width="2"
/>
```

#### Undeveloped (未展開)
```svg
<polygon
  points="{-width/2},0 0,{height/2} {width/2},0 0,{-height/2}"
  fill="#FFFFFF"
  stroke="#0000FF"
  stroke-width="2"
/>
```

---

## 4. リンク仕様

### 4.1 リンクタイプ

| タイプ | 表現 | 用途 |
|--------|------|------|
| Supported By | 実線矢印 | 上位要素が下位要素によって支持される |
| In Context Of | 破線矢印 | コンテキストの関連付け |

### 4.2 リンクデータ構造

```typescript
interface Link {
  id: string;                    // 一意識別子
  source: string;                // 始点ノードID
  target: string;                // 終点ノードID
  type: 'solid' | 'dashed';      // 実線 or 破線
  style?: {
    color?: string;              // 線の色 (デフォルト: #0000FF)
    width?: number;              // 線の太さ (デフォルト: 2px)
  };
}
```

### 4.3 リンク描画仕様

#### 実線 (Supported By)
```svg
<path
  d="M {sourceX} {sourceY} L {targetX} {targetY}"
  stroke="#0000FF"
  stroke-width="2"
  fill="none"
  marker-end="url(#arrowhead)"
/>
```

#### 破線 (In Context Of)
```svg
<path
  d="M {sourceX} {sourceY} L {targetX} {targetY}"
  stroke="#0000FF"
  stroke-width="2"
  stroke-dasharray="8 8"
  fill="none"
  marker-end="url(#arrowhead)"
/>
```

#### 矢印マーカー定義
```svg
<defs>
  <marker
    id="arrowhead"
    markerWidth="10"
    markerHeight="10"
    refX="9"
    refY="3"
    orient="auto"
  >
    <polygon
      points="0 0, 10 3, 0 6"
      fill="#0000FF"
    />
  </marker>
</defs>
```

---

## 5. キャンバス仕様

### 5.1 キャンバス状態

```typescript
interface CanvasState {
  viewport: {
    scale: number;               // 拡大率 (0.1 ~ 3.0)
    offsetX: number;             // X方向オフセット
    offsetY: number;             // Y方向オフセット
  };
  selectedNodes: string[];       // 選択中のノードID配列
  mode: 'select' | 'addNode' | 'addLink' | 'delete';
}
```

### 5.2 デフォルト値
- キャンバスサイズ: 親要素の100%
- 初期スケール: 1.0
- 最小スケール: 0.2
- 最大スケール: 3.0
- スケール変更単位: 0.1
- 背景色: `#FFFFFF`

---

## 6. 操作仕様

### 6.1 ノード操作

#### 6.1.1 ノード追加
1. サイドパネルからノードタイプを選択
2. キャンバスをクリック
3. クリック位置にノードを配置

**入力**:
- ノードタイプ
- クリック座標

**出力**:
- 新規ノード作成（デフォルトサイズ: 180x120）
- 内容は空（プレースホルダー: "ダブルクリックで内容を編集"）

#### 6.1.2 ノード移動
1. ノードをドラッグ
2. マウス移動に追従
3. ドロップで位置確定

**制約**:
- キャンバス外への移動は可能
- グリッドスナップ機能（オプション）

#### 6.1.3 ノード削除
1. 削除モードを選択
2. 対象ノードをクリック
3. 確認ダイアログ表示
4. OK で削除実行

**動作**:
- ノードに接続されたリンクも同時削除

#### 6.1.4 ノード内容編集
1. ノードをダブルクリック
2. モーダルダイアログ表示
3. リッチテキストエディタで編集
4. 保存ボタンで確定

**エディタ機能**:
- 基本的なテキスト装飾（太字、斜体、下線）
- リスト（番号付き、箇条書き）
- 改行対応

#### 6.1.5 ノードサイズ変更
1. ノードを選択（クリック）
2. 四隅にリサイズハンドル表示
3. ハンドルをドラッグでサイズ変更

**制約**:
- 最小サイズ: 80x60
- アスペクト比固定: オプション

### 6.2 リンク操作

#### 6.2.1 リンク追加
1. リンク追加モードを選択
2. 始点ノードをクリック（ハイライト表示）
3. 終点ノードをクリック
4. リンク作成

**制約**:
- 同一ノードへの自己参照は不可
- 重複リンクは警告表示（作成は可能）

#### 6.2.2 リンク削除
1. 削除モードを選択
2. 対象リンクをクリック
3. 確認なしで即座に削除

### 6.3 キャンバス操作

#### 6.3.1 パン操作
- **方法1**: 中ボタンドラッグ
- **方法2**: スペースキー + 左ドラッグ
- **方法3**: 空白領域を左ドラッグ

#### 6.3.2 ズーム操作
- **方法1**: マウスホイール（Ctrl + ホイール）
- **方法2**: UI上の +/- ボタン
- **ズーム中心**: マウスカーソル位置

---

## 7. UI構成

### 7.1 画面レイアウト

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

### 7.2 サイドパネル

#### ノードパレット
- 各ノードタイプのアイコン + ラベル
- クリックで選択状態（ハイライト）
- 再クリックで選択解除

#### 編集メニュー
- **リンク追加**: リンク作成モードに切り替え
- **削除**: 削除モードに切り替え

### 7.3 ヘッダー

- **タイトル入力欄**: 図のタイトル
- **表示倍率表示**: 現在のズーム倍率
- **ズームボタン**: +/- ボタン
- **メニュー**:
  - JSONエクスポート
  - JSONインポート

---

## 8. データ永続化

### 8.1 データ形式

```typescript
interface DiagramData {
  version: string;               // スキーマバージョン (例: "1.0.0")
  title: string;                 // 図のタイトル
  nodes: Node[];                 // ノード配列
  links: Link[];                 // リンク配列
  metadata: {
    createdAt: string;           // 作成日時 (ISO 8601)
    updatedAt: string;           // 更新日時 (ISO 8601)
  };
}
```

### 8.2 保存方法

#### Phase 1 (MVP)
- **ローカルストレージ**: `localStorage` に JSON保存
- **エクスポート**: JSON ファイルとしてダウンロード

#### Phase 2 (将来)
- **バックエンド**: REST API経由でサーバー保存
- **自動保存**: 5秒ごとに変更を自動保存

---

## 9. 実装優先順位

### Phase 1: MVP (Minimum Viable Product)
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

### Phase 2: 拡張機能
1. ノードサイズ変更
2. 破線リンク（Context関連）
3. リッチテキストエディタ
4. ノード削除・リンク削除
5. 複数選択
6. Undo/Redo
7. LocalStorageへの自動保存

### Phase 3: 高度な機能
1. 全ノードタイプ対応（Assumption, Justification等）
2. ノードスタイルのカスタマイズ
3. グリッドスナップ
4. 整列機能
5. エクスポート（PNG/SVG画像）

---

## 10. 非機能要件

### 10.1 パフォーマンス
- 100ノードまでスムーズに動作
- ドラッグ操作: 60fps以上
- 初期読み込み: 2秒以内

### 10.2 ブラウザ対応
- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

### 10.3 アクセシビリティ
- キーボード操作対応（将来）
- スクリーンリーダー対応（将来）

---

## 11. 参考資料

### GSN標準
- GSN Community Standard Version 3.0 (2021)
- https://scsc.uk/gsn

### 既存実装
- 既存D-Case Communicator (AngularJS + D3.js v4)

---

## 付録A: コンポーネント構成（React例）

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
│   └── diagramStore.ts             # 状態管理
├── types/
│   └── diagram.ts                  # 型定義
└── utils/
    ├── nodeRenderer.ts             # ノード描画ロジック
    └── linkRenderer.ts             # リンク描画ロジック
```

---

## 付録B: 開発環境セットアップ

### 推奨コマンド（React + Vite）

```bash
# プロジェクト作成
pnpm create vite@latest gsn-editor --template react-ts

# 依存関係インストール
cd gsn-editor
pnpm install

# 追加パッケージ
pnpm add zustand
pnpm add @dnd-kit/core @dnd-kit/utilities  # ドラッグ&ドロップ
pnpm add react-quill                       # リッチテキストエディタ
pnpm add lucide-react                      # アイコン
pnpm add tailwindcss postcss autoprefixer
pnpm dlx tailwindcss init -p

# 開発サーバー起動
pnpm dev
```

---

**仕様書バージョン**: 1.0.0
**作成日**: 2025-12-09
**対象プロジェクト**: GSN Editor (D-Case Communicator リプレース)
