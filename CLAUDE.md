# マッサージサロン管理システム — CLAUDE.md

このファイルはClaude Codeが自動で読み込む指示書です。
開発を始める前に必ずこの内容を把握してください。

---

## システム概要

マッサージサロン（いわき/HerRoom・水戸/Reメンズエステ・神栖/Premium・NEVERLAND）向けの統合管理システム。

| 要素 | 内容 |
|---|---|
| フロントエンド | index.html（単一ファイル・約13,500行）/ supply.html / cash.html / ranking.html |
| データベース | Supabase（PostgreSQL） |
| LINE連携 | Supabase Edge Functions（line-webhook / line-push） |
| デプロイ | Vercel（GitHubプッシュで自動デプロイ） |

---

## デプロイURL

| 店舗 | URL |
|---|---|
| いわき（デフォルト） | https://mens-este-app.vercel.app |
| 水戸 | https://mens-este-app.vercel.app/?store=22222222-0000-0000-0000-000000000002 |
| 神栖 | https://mens-este-app.vercel.app/?store=33333333-0000-0000-0000-000000000003 |
| NEVERLAND | https://mens-este-app.vercel.app/?store=44444444-0000-0000-0000-000000000004 |

---

## 店舗ID

| 店舗 | store_id |
|---|---|
| いわき（HerRoom） | 11111111-0000-0000-0000-000000000001 |
| 水戸（Reメンズエステ） | 22222222-0000-0000-0000-000000000002 |
| 神栖（Premium） | 33333333-0000-0000-0000-000000000003 |
| NEVERLAND | 44444444-0000-0000-0000-000000000004 |

---

## Edge Functions

| Function名 | URL | JWT認証 |
|---|---|---|
| line-webhook | https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-webhook | OFF |
| line-push | https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push | OFF |

---

## 開発ルール（必須）

### コード修正後は必ず構文チェック
```bash
# index.htmlのJSを抽出して構文チェック
sed -n '/<script>$/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/check.js
node --check /tmp/check.js
```
**ローカルで「読み込み中のまま」= 必ずJS構文エラーを疑うこと。**

### str_replace時の注意
- 変更は最小限の行だけを対象にする
- 置き換え後に変数の定義漏れがないかgrep確認する
- 修正後は必ず構文チェックを実行する

### 既存機能を削除しない
- 変更が必要な場合は必ず理由を説明する
- 常に全体構造を把握したうえで修正する

### 大規模な機能追加
- 事前に細部まで仕様を確認してからコード作成
- フェーズを分けて細分化して開発
- 各フェーズ完了時に進捗を報告

---

## 重要な仕様・注意事項

### 変数名
- `isAdminMode`（`isAdmin`は誤り）

### 顧客識別
- **電話番号（tel）を主キーとして使用**
- `customer_no` は廃止（カラムは残存しているが使用しない）
- 来店回数は `reservations` テーブル（キャンセル除く）で集計（`sales` テーブルは使わない）

### 27時ルール
- 深夜0〜2時台の予約・売上は**前日扱い**（T03:00〜翌T02:59）
- `_fmtDatetimeJp(isoStr)` — ISO文字列を27時ルール対応でフォーマット
- `_fmtLocalDatetimeJp(localStr)` — `"YYYY-MM-DDTHH:MM"` 形式を手動パース（new Date()のTZずれ回避）

### UUID
- メニュー・ルームのIDはUUID（文字列）なので `Number()` で変換しない

### therapists取得
- 必ず `.eq('active', true)` を追加（重複レコード対策）

### モーダル表示
- `_showModal(id)` / `_hideModal(id)` を使う（iOS対応）
- 予約完了モーダル（resv-complete-modal）は `display:flex` を直接指定

### インターバル計算
- 重複チェックは新規側・既存側の両方にintervalを加算
- `therapists` キャッシュ未ロード時は `getTherapistInterval` APIでDB直接取得
- DB取得失敗時はデフォルト30分にフォールバック

### 顧客メモ絞り込み
- `customer_id` で絞り込む（`customer_no` での結合フィルタは機能しない）

### Supabase注意
- FOREIGN KEY JOIN（リレーション結合）はREST APIで失敗することがある → **分割クエリで対応**
- `therapist_scouts` の削除は `active=false` で論理削除（物理削除しない）

### LINE WebView対応
- `confirm()` が常にfalseを返す問題 → `_confirm()` カスタムモーダルに置換

### 神栖店固有機能
- `send_payroll_line=false` / `send_store_line=true`（店落ちのみ送信）
- スカウトモード（🔍スカウトタブ）は神栖店のみ表示

---

## データベース構造

### 全テーブル一覧
```
reservations, sales, shifts, therapists, customers, customer_memos,
menus, rooms, stores, store_settings, tokens, expenses, manuals,
payroll_confirmations, room_checklists, checkout_logs, cash_logs,
supplies, supply_orders, therapist_menu_backs, store_drop_balance,
sale_options, registration_states, scout_companies, therapist_scouts
```

### 主要テーブルのポイント

#### reservations（予約情報）
- `is_unassigned` boolean — フリー予約（セラピスト未割り当て）フラグ
- `cancel_reason` text — キャンセル理由
- `is_hime` / `is_hime_approved` — 姫予約フラグ
- `status` — active / cancelled

#### sales（売上データ）
- `customer_tel` — 来店回数・新規客判定に使用
- `reservation_id` — 重複登録防止（同一IDはUPDATE）

#### shifts（出勤シフト）
- `status` — pending / approved / rejected
- `attendance_type` — normal / late / early_leave / absent / noshow
- 欠勤・無断欠勤（absent/noshow）はスカウト出勤日数から除外

#### therapists（セラピストマスタ）
- `interval_min` integer DEFAULT 30 — インターバル（分）
- `course_back` numeric — コースバック率（例: 0.6 = 60%）
- `nomination_fee` integer — セラピスト個別指名料

#### customers（顧客マスタ）
- `status` の有効値: `normal`, `注意`, `NG`, `出禁`（「通常」は不可）
- `ng_therapists` — `text[]` 型（jsonbではない）

#### store_settings（店舗設定）
- `discount_mode` — `deduct_then_back`（按分）/ `store_bears`（店舗全額）
- `send_payroll_line` boolean — 給料LINE送信フラグ
- `send_store_line` boolean — 店落ちLINE送信フラグ

#### scout_companies（スカウト紹介元マスタ）※神栖店専用
- `back_rate` numeric — スカウトバック率（例: 0.1 = 10%）
- `advisory_fee` integer — 顧問料（円/日）

#### therapist_scouts（セラピスト×紹介元紐付け）※神栖店専用
- UNIQUE(store_id, therapist_id) — 1セラピストは1会社のみ
- `active=false` で論理削除

---

## 料金・給料の優先順位

### コース料金
1. ハードコードデフォルト値
2. `store_settings.course_prices` で上書き
3. `menus` テーブルのマスタで上書き（最終値）

### 給料バック
1. `therapist_menu_backs` テーブルに固定バック金額があれば優先
2. 未設定の場合は `therapists.course_back` のバック率で計算

### スカウトバック（神栖店）
- SB = コース売上 × コースバック率 × スカウトバック率
- オプション・指名料は**含めない**

---

## 画面構成（index.html）

| page ID | 表示名 | 対象 |
|---|---|---|
| page-payroll | 給料計算 | 管理者 |
| page-reservation | 予約管理 | 管理者 |
| page-sales-report | 売上確認 | 管理者 |
| page-shift-calendar | シフト表 | 管理者 |
| page-customer-master | 顧客マスタ | 管理者 |
| page-master-mgmt | マスタ管理 | 管理者 |
| page-line-mgmt | LINE管理 | 管理者 |
| page-scout | スカウト集計 | 管理者（神栖店のみ） |
| page-my-reservations | 予約確認 | セラピスト |
| page-shift-submit | シフト提出 | セラピスト |
| page-customer-list | 顧客リスト | セラピスト |
| page-sales-input | 売上入力 | セラピスト |

---

## APIケース構造（index.html）

全APIは `async function apiGet(action, params)` の switch文で処理。
`apiGetCached(action, params)` は5分間キャッシュ付きラッパー。

### スカウト関連（セッション15で追加）
- `getScoutCompanies` — 紹介元会社一覧
- `saveScoutCompany` — 会社登録・更新
- `getTherapistScout` — セラピスト紐付け取得
- `saveTherapistScout` — 紐付け保存（UPSERT）
- `deleteTherapistScout` — 紐付け解除（active=false）
- `getScoutSummary` — 月次集計（5段階分割クエリ）

---

## デプロイ方法

```bash
# ローカルで修正後、GitHubにプッシュするだけでVercelが自動デプロイ
git add .
git commit -m "fix: 修正内容の説明"
git push origin main
```

Supabaseのスキーマ変更後は「API → Reload schema」でキャッシュを更新。

---

## LINEコマンド一覧

| コマンド | 動作 |
|---|---|
| ログイン | ログインURL（3時間有効）を発行 |
| 登録 | 別店舗の追加登録（招待コードを入力） |
| 発注 | 備品発注画面URLを発行 |
| シフト | 今週・来週の承認済みシフトを返信 |
| 金庫 | 金庫管理画面URLを発行（いわき店のみ） |
| 確認 | 給料確認（confirmed_atを更新） |
