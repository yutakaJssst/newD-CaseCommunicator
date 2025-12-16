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

### ノードタイプ（8種類）

| タイプ | 日本語名 | 形状 | デフォルト色 | 用途 |
|--------|----------|------|--------------|------|
| Goal | ゴール | 矩形 | `#CCFFCC` (薄緑) | 達成すべき目標 |
| Strategy | 戦略 | 平行四辺形 | `#FFFFFF` (白) | ゴール分解の方針 |
| Context | 前提 | 角丸矩形 | `#FFFFFF` (白) | 前提条件 |
| Evidence | 証拠 | 楕円 | `#FFC5AA` (薄橙) | ゴール達成の根拠 |
| Assumption | 仮定 | 楕円 | `#FFE699` (薄黄) | 論証の仮定事項 |
| Justification | 正当化 | 楕円 | `#BDD7EE` (薄青) | 戦略の正当性根拠 |
| Undeveloped | 未展開 | ダイヤモンド | `#FFFFFF` (白) | 未展開のゴール |
| Module | モジュール | フォルダ型 | `#E0E0E0` (グレー) | 別ダイアグラムへのリンク |

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

**更新日**: 2025-12-16
**プロジェクト状態**: Phase 1 (MVP) 完了 / Phase 2 完了 / 推奨実装順序 完了 / **モジュール機能実装完了**

---

## 現在の実装状況（gsn-editorフォルダ）

### 技術スタック（実装済み）
- **フレームワーク**: React 19.2.0
- **言語**: TypeScript 5.9.3
- **状態管理**: Zustand 5.0.9
- **ビルドツール**: Vite 7.2.4
- **描画**: SVG (ネイティブ)
- **パッケージマネージャ**: npm

### アーキテクチャ

#### ディレクトリ構造
```
gsn-editor/
├── src/
│   ├── App.tsx                    # メインアプリケーション
│   ├── main.tsx                   # エントリーポイント
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── Canvas.tsx         # SVGキャンバス（ノード・リンク描画、ユーザー操作）
│   │   │   ├── Node.tsx           # ノード描画（7種類の形状に対応）
│   │   │   ├── Link.tsx           # リンク描画（実線・破線対応）
│   │   │   ├── NodeEditor.tsx    # ノード内容編集モーダル
│   │   │   └── ContextMenu.tsx   # 右クリックメニュー
│   │   ├── Header/
│   │   │   └── Header.tsx         # タイトル編集・ズーム・エクスポート/インポート
│   │   └── Sidebar/
│   │       ├── Sidebar.tsx        # サイドバーコンテナ
│   │       └── NodePalette.tsx   # ノードタイプ選択パレット
│   ├── stores/
│   │   └── diagramStore.ts        # Zustandストア（状態管理）
│   ├── types/
│   │   └── diagram.ts             # TypeScript型定義・定数
│   └── utils/                     # （空・将来拡張用）
```

### 実装済み機能の詳細

#### 1. ノード描画・操作（Node.tsx）
- **8種類のノードタイプに対応**:
  - `Goal`: 矩形（デフォルト色: `#CCFFCC`）
  - `Strategy`: 平行四辺形（`skewX(-15)`変形）
  - `Context`: 角丸矩形（`rx=10, ry=10`）
  - `Evidence`: 楕円（デフォルト色: `#FFC5AA`）
  - `Assumption`: 楕円（デフォルト色: `#FFE699`）
  - `Justification`: 楕円（デフォルト色: `#BDD7EE`）
  - `Undeveloped`: ダイヤモンド（polygon）
  - `Module`: フォルダ型（タブ付き矩形、デフォルト色: `#E0E0E0`）
- **ノード内容表示**: `foreignObject`要素を使用してHTML表示
- **選択状態のハイライト**: 選択時は赤枠（`#FF0000`）、strokeWidth=3
- **ラベル表示**: ノード右上にラベル（茶色背景 `#800000`）
- **モジュールノード専用パディング**: タブと重ならないよう上部30px

#### 2. キャンバス操作（Canvas.tsx）
- **ノード追加**:
  - サイドバーからノードタイプ選択 → キャンバスクリック
  - SVG座標系への変換（`screenToSvgCoordinates`）
- **ノード移動**:
  - ドラッグ&ドロップ（マウス座標の差分計算）
- **リンク作成**:
  - 右クリックメニューから「リンク追加」 → 親ノードクリック → 子ノードクリック
  - 重複リンクチェック機能あり
- **パン操作**:
  - 中ボタンドラッグ または Shift+左ドラッグ
  - `viewport.offsetX/offsetY`の更新
- **ズーム操作**:
  - マウスホイール（`handleWheel`）
  - 範囲: 0.2〜3.0倍
- **右クリックメニュー**:
  - ノード: リンク追加、ノード削除、モジュール変換（Goalのみ）
  - リンク: リンク削除
- **グリッドスナップ**:
  - ヘッダーの⊞ボタンでON/OFF切り替え
  - ONの時、20pxグリッド線を表示
  - ノード追加・移動時に自動でグリッドに吸着

#### 3. リンク描画（Link.tsx）
- **スマートな接続点計算**: ノード間の相対位置に基づいて最適な接続点を自動選択
  - 横並び（前提ノードが横にある場合）: 左右の辺から接続
  - 縦並び（通常の階層構造）: 上下の辺から接続
- **GSN標準準拠の矢印**:
  - 通常のリンク（SupportedBy）: 塗りつぶし矢印
  - Context/Assumption/Justificationへのリンク（InContextOf）: 白抜き矢印
- **破線対応**: `strokeDasharray="8 8"`（明示的に指定された場合のみ）

#### 4. ノード編集（NodeEditor.tsx）
- **モーダルダイアログ**:
  - ノードダブルクリックで起動
  - テキストエリアでコンテンツ編集
  - ESCキーで閉じる
  - 保存 or キャンセル

#### 5. 状態管理（diagramStore.ts）
- **Zustandストア**:
  - `title`, `nodes`, `links`, `canvasState`, `history`, `historyIndex`
- **主要アクション**:
  - `addNode`, `updateNode`, `deleteNode`, `moveNode`
  - `addLink`, `deleteLink`
  - `setViewport`, `selectNode`, `clearSelection`, `toggleGridSnap`
  - `undo`, `redo`, `canUndo`, `canRedo`
  - `convertToModule`, `switchToModule`, `switchToParent`
  - `exportData`, `importData`, `exportAsImage`, `reset`
- **ID生成**: タイムスタンプ + ランダム文字列
- **LocalStorage永続化**: `persist`ミドルウェアで自動保存
- **履歴管理**: 最大50件の操作履歴を保持

#### 6. エクスポート/インポート（Header.tsx）
- **エクスポートドロップダウンメニュー**:
  - JSONエクスポート: `DiagramData`形式（version, title, nodes, links, metadata）
  - PNG画像エクスポート: 高解像度2倍、全ノードを含む境界を自動計算
  - SVG画像エクスポート: ベクター形式、拡大縮小しても綺麗
- **JSONインポート**:
  - ファイル選択ダイアログ
  - JSONパース後、`importData`で状態復元
- **Undo/Redoボタン**:
  - ヘッダーに配置
  - キーボードショートカット（Ctrl+Z / Ctrl+Y）対応
  - 無効状態の視覚的フィードバック

#### 7. 型定義（diagram.ts）
- **厳密な型安全性**:
  - `NodeType`, `LinkType`, `CanvasMode`
  - `Node`, `Link`, `DiagramData`
- **定数定義**:
  - `NODE_COLORS`, `NODE_LABELS`
  - `DEFAULT_NODE_SIZE` (180x120)
  - `DEFAULT_CANVAS_STATE`

### 実装の特徴

#### 優れている点
1. **型安全性**: TypeScript strictモードで完全な型定義
2. **シンプルなアーキテクチャ**: React + Zustandのみで、外部描画ライブラリ不使用
3. **SVGネイティブ描画**: パフォーマンスと柔軟性のバランス
4. **リアクティブな状態管理**: Zustandによる効率的な更新
5. **右クリックメニュー**: UXの向上（リンク追加、削除）
6. **GSN標準準拠のリンク描画**:
   - Context系ノードへのリンクは自動的に白抜き矢印
   - ノードタイプに基づく接続点計算（Strategy/Evidence/Undeveloped: 縦、Context/Assumption/Justification: 横）
7. **ノードサイズ変更機能**: 4方向のリサイズハンドル
8. **複数選択機能**: Ctrl+クリックで複数選択、一括移動
9. **リッチテキストエディタ**: 太字、斜体、下線、フォントサイズ、URLリンク対応
10. **パン操作**: 空白領域ドラッグ、Shift+ドラッグ、中ボタンドラッグ
11. **視覚的なノードパレット**: 各ノードの形状アイコン表示

#### 注意点
1. **移動操作の履歴**: ノード移動は履歴に保存されない（頻繁すぎるため意図的に除外）
2. **Assumption/Justification識別**: 右下に"A"/"J"添え字で区別（色では区別しない）

### 完了した機能（Phase 1-3）

#### Phase 1 (MVP) ✅ 完了
- ✅ プロジェクトセットアップ（Vite + React + TypeScript）
- ✅ 7種類のノード描画（Goal, Strategy, Context, Evidence, Assumption, Justification, Undeveloped）
- ✅ ノードの配置・移動
- ✅ リンクの作成・描画
- ✅ キャンバスのパン・ズーム操作
- ✅ ノード内容の編集
- ✅ JSONエクスポート/インポート

#### Phase 2 ✅ 完了
- ✅ **ノードサイズ変更機能**: 4方向のリサイズハンドル実装済み
- ✅ **GSN標準準拠のリンク描画**: Context系ノードへの白抜き矢印、ノードタイプに基づく接続点計算
- ✅ **LocalStorage自動保存**: `zustand/middleware`の`persist`使用
- ✅ **Undo/Redo**: 履歴配列管理（最大50件）、Ctrl+Z/Ctrl+Y対応

#### 推奨実装順序 ✅ 完了
1. ✅ **削除モードの改善**: 右クリックメニューから削除可能（専用モードボタンは不要と判断）
2. ✅ **パン操作の改善**: 空白領域を左ドラッグでパン操作
3. ✅ **複数選択機能**: Ctrl+クリックで複数ノード選択、一括ドラッグ移動
4. ✅ **リッチテキストエディタ**: contentEditable使用、太字・斜体・下線・フォントサイズ・URLリンク対応

#### モジュール機能 ✅ 完了（2025-12-16）
- ✅ **Moduleノードタイプの追加**: フォルダ型の8番目のノードタイプ
- ✅ **Goalからのモジュール化**: 右クリックメニュー「モジュールにする」でサブツリーを別ダイアグラムに分離
- ✅ **空のモジュール作成**: サイドバーから直接Moduleノードを配置可能
- ✅ **モジュール階層管理**: `Record<string, DiagramData>`でモジュール間の親子関係を管理
- ✅ **モジュールナビゲーション**: ダブルクリックでモジュール内を開く、パンくずリストで親に戻る
- ✅ **トップゴール自動反映**: モジュール内のルートGoalの内容が親ダイアグラムのModuleノードに表示
- ✅ **リンク接続点の最適化**: Moduleノードへのリンクは親ノードの下中央から接続
- ✅ **LocalStorage永続化対応**: MapからRecordへ変更してシリアライズ可能に

#### UX改善機能 ✅ 完了（2025-12-16）
- ✅ **ノードラベル自動採番**: G1, S1, E1などノードタイプごとに自動採番、手動編集も可能
- ✅ **グリッドスナップ機能**: ヘッダーの⊞ボタンでON/OFF、20px間隔グリッド、ノード追加・移動時に自動吸着
- ✅ **リンク右クリック削除**: リンクを右クリックで「リンクを削除」メニュー表示、クリック領域拡大（透明線12px）
- ✅ **PNG/SVGエクスポート**: エクスポートドロップダウンメニューからJSON/PNG/SVG選択可能
  - PNG: 高解像度2倍、全ノードを含む境界を自動計算、50pxパディング
  - SVG: ベクター形式、完全なノード・リンク・ラベル再現
  - テキスト: HTMLタグ除去、最大5行表示、長い場合は省略記号

#### 次のステップ候補（Phase 3）
1. **検証機能**: ルートノード存在チェック、循環参照検出、孤立ノード警告
2. **モジュール一括エクスポート/インポート**: 全モジュールをまとめて保存・復元
3. **テンプレート機能**: よく使うパターンを保存・再利用

### GSN標準との対応

#### GSN Community Standard Version 1 準拠状況

**準拠済み**:
- ✅ 基本要素（Goal, Strategy, Context, Solution/Evidence）の形状
- ✅ 親子関係の視覚表現（SupportedBy: 矢印付き実線）
- ✅ ノードの識別子（id）
- ✅ 内容の記述（content）

**部分準拠**:
- ⚠️ InContextOf関係: 破線実装済みだが、Context特有の接続が自動化されていない
- ⚠️ Assumptionノード: 形状は実装済み、楕円+破線の組み合わせが未自動化

**未準拠（将来実装）**:
- ❌ モジュール拡張（Module, ContractモジュールへのAwayノード）
- ❌ パターン拡張（多重性 m..n 表記、オプショナリティ {O}）
- ❌ Undevelopedノードへの自動推奨（証拠不足の検出）

#### GSN標準からの推奨事項（実装候補）

1. **リンクタイプの自動判定**:
   - Context/Assumption/Justification → 他ノード: 破線（InContextOf）
   - Goal/Strategy/Evidence: 実線（SupportedBy）

2. **ノードラベルの活用**:
   - 現在: `label`プロパティは実装済みだが未使用
   - 推奨: Gnn（Goalの番号）、Snn（Strategyの番号）の自動採番

3. **Undevelopedノードの促進**:
   - 子ノードのないGoalに対して、Undevelopedノード追加を促すUI

4. **検証機能**:
   - ルート（最上位Goal）の存在チェック
   - 循環参照の検出
   - 孤立ノードの警告

---

## 開発者向けメモ

### コマンド
```bash
# 開発サーバー起動
cd gsn-editor && npm run dev

# ビルド
npm run build

# Lint
npm run lint
```

### デバッグTips
- **ノードIDの確認**: ブラウザDevToolsでノードをinspect → `data-*`属性
- **ストア状態の確認**: React DevTools → Components → useDiagramStore
- **SVG座標デバッグ**: `screenToSvgCoordinates`にconsole.log追加

### 既知の問題
1. **ノードドラッグ時のちらつき**: 高速移動時に軽微なレンダリング遅延
   - 対策候補: `requestAnimationFrame`の使用
2. **ズーム時の座標ずれ**: 極端なズーム（0.2倍未満、3.0倍超）で境界処理が不安定
   - 対策: ズーム範囲制限の維持（現在0.2〜3.0）

---

## GSN標準ドキュメントの理解

### GSN Community Standard Version 1 (2011) サマリ

#### Part 1: 規範的定義
- **Goal（ゴール）**: 達成すべき主張（矩形）
- **Strategy（戦略）**: ゴール分解の推論方針（平行四辺形）
- **Solution（解決/証拠）**: ゴール達成の直接的根拠（円形）
  - 実装では「Evidence」として実装
- **Context（前提）**: 論証の文脈（角丸矩形）
- **Assumption（仮定）**: 正当化されていない前提（円形、破線InContextOf）
- **Justification（正当化）**: Strategyの妥当性を説明（円形、破線InContextOf）

#### Part 2: ガイダンス
- **トップダウン開発**: 6ステップメソッド
  1. ゴール特定 → 2. 証拠確認 → 3. サブゴール展開 → 4. 戦略明示化 → 5. 前提明示化 → 6. 全サブゴールで繰り返し
- **ボトムアップ開発**: 既存証拠から論証を構築
- **よくある誤り**:
  - Goalが主張ではなく活動になっている
  - Strategyが欠如（暗黙的な推論）
  - Contextの乱用（本来はGoalやAssumptionにすべき）

#### 実装への示唆
- **自動検証ツール候補**:
  - Goalが疑問文で書かれていないかチェック（文末に「?」）
  - Strategyの後に必ず複数のGoalがあるかチェック
  - Solutionが葉ノード（子ノードなし）であるかチェック
