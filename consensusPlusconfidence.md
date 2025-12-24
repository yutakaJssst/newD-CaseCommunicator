# Consensus + Confidence Calculation Spec for GSN Editor

このファイルは、GSNエディタに **合意形成スコア（Consensus）** と  
**専門家による Strategy-aware Confidence** を実装するための仕様です。  
LLM（AIモデル）がこの仕様を読んでロジックを理解し、実装生成に使うことを想定しています。

---

## 0. 全体像

### 入力情報

1. **GSN構造**
   - Goalノード、Strategyノード
   - 親子関係（Strategyによる分解を含む）

2. **アンケート結果（非専門家）**
   - すべてのゴールノード＋すべてのStrategyノードについて  
     → 0,1,2,3 の4件法スコア（合意度）

3. **アンケート結果（専門家）**
   - 末端のゴール（leaf goals）  
     → 0〜1 の連続値スコア（Confidence）
   - Strategyノード  
     → 0〜1 の連続値スコア（Confidence）
   - それ以外のゴールノード（中間ゴール）  
     → 0,1,2,3 の4件法スコア（合意度）

### 出力情報

1. **各ノードの Consensus Score ∈ [0,1]**  
   - 非専門家＋専門家の情報を統合した「合意形成スコア」

2. **各ノードの Confidence（専門家のみから算出）**
   - 平均値：μ  
   - 分散：σ²  
   → Strategy-aware Confidence に基づく技術的な妥当性と不確かさ

---

## 1. GSN構造モデル

各ノードは最低限、以下の属性を持つとする：

- `node_id`: 文字列。ノードの一意なID
- `node_type`: `"goal"` または `"strategy"`
- `is_leaf`: 真偽値
  - `goal` かつ子ゴールを持たないもの → `true`
  - `strategy` → 常に `true` とみなしてよい（子ゴールを持たない前提）
- `strategy_id`:
  - `goal` の場合、そのゴールを分解する Strategyノードの `node_id`
  - Strategyがない場合は `null`
- `children_goals`:
  - そのゴールの直下のサブゴール（`goal`ノード）の `node_id` 配列
  - Strategyノードは空配列でよい

**前提**：  
多くのゴールは「Strategy 1つ＋子ゴール複数」という形で分解される。  
Strategyが付いていないゴールも許容するが、その場合は後述の簡易ルールで扱う。

---

## 2. アンケート入力モデル

### 2.1 非専門家（general stakeholders）

- 対象ノード：
  - すべてのゴールノード
  - すべてのStrategyノード
- スケール：
  - `0` = 強く不同意  
  - `1` = やや不同意  
  - `2` = やや同意  
  - `3` = 強く同意

データ構造イメージ：

```jsonc
{
  "rater_id": "stakeholder_001",
  "role": "non_expert",
  "node_id": "G4",
  "scale_type": "likert_0_3",
  "value": 2
}