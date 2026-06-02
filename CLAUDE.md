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

## デプロイURL・店舗ID

| 店舗 | URL | store_id |
|---|---|---|
| いわき（デフォルト） | https://mens-este-app.vercel.app | 11111111-0000-0000-0000-000000000001 |
| 水戸 | https://mens-este-app.vercel.app/?store=22222222... | 22222222-0000-0000-0000-000000000002 |
| 神栖 | https://mens-este-app.vercel.app/?store=33333333... | 33333333-0000-0000-0000-000000000003 |
| NEVERLAND | https://mens-este-app.vercel.app/?store=44444444... | 44444444-0000-0000-0000-000000000004 |

---

## Edge Functions

| Function名 | URL | JWT認証 |
|---|---|---|
| line-webhook | https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-webhook | OFF |
| line-push | https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push | OFF |

---

## 修正時の必須手順（毎回必ず守ること）

1. **同じ処理が他の関数にも存在しないかgrep確認**してから修正する
2. **影響範囲をコメントで報告**してから修正する
3. 修正後は必ず **`node --check` で構文チェック**を実行する

```bash
# 影響範囲の確認
grep -n "対象の関数名や変数名" index.html

# 構文チェック（必須）
sed -n '/<script>$/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/check.js
node --check /tmp/check.js
```

**ローカルで「読み込み中のまま」= JS構文エラーを必ず疑うこと。**

---

## 開発ルール

- **既存機能を削除しない**。変更が必要な場合は必ず理由を説明する
- **str_replace時**は変更を最小限の行だけに絞る。置き換え後に変数の定義漏れがないかgrepで確認する
- **大規模な機能追加**は事前に細部まで仕様を確認してからコード作成。フェーズを分けて開発し、各フェーズ完了時に進捗を報告する
- **Supabase JOIN**（リレーション結合）はREST APIで失敗することがある → 分割クエリで対応する

---

## 重要な仕様・注意事項

### 変数名
- `isAdminMode`（`isAdmin`は誤り）

### 顧客識別
- **電話番号（tel）を主キーとして使用**
- `customer_no` は廃止（カラムは残存しているが使用しない）
- **来店回数は `reservations` テーブル（キャンセル除く）のみで集計**（salesテーブルは使わない）
- 管理者・セラピスト・顧客詳細の3画面で同じ基準を使うこと
- 日付単位で重複排除（同日複数予約を1回とカウント）

### 27時ルール
- 深夜0〜2時台の予約・売上は**前日扱い**（T03:00〜翌T02:59）
- `_fmtDatetimeJp(isoStr)` — ISO文字列を27時ルール対応でフォーマット
- `_fmtLocalDatetimeJp(localStr)` — `"YYYY-MM-DDTHH:MM"` 形式を手動パース（`new Date()` のTZずれ回避のため必須）
- **`new Date("2026-05-30T00:15")` はTZなしだとUTCとして解釈されてずれる**。ローカル日時文字列は必ず `_fmtLocalDatetimeJp` を使う

### UUID
- メニュー・ルームのIDはUUID（文字列）なので `Number()` で変換しない

### therapists取得
- 必ず `.eq('active', true)` を追加（重複レコード対策）

### モーダル表示
- `_showModal(id)` / `_hideModal(id)` を使う（iOS対応）
- 予約完了モーダル（resv-complete-modal）は `display:flex` を直接指定

### インターバル計算（予約重複チェック）
- 重複チェックは新規側・既存側の両方にintervalを加算
- `therapists` キャッシュ未ロード時は `getTherapistInterval` APIでDB直接取得
- DB取得失敗時はデフォルト30分にフォールバック
- **修正対象は3関数**：`updateResvRow` / `submitReservation` / `saveAndSendLine`
- `getReservations` の返り値に `rawDate`（元のISO文字列）を含む。重複チェック・案内テキスト生成では `r.rawDate` を使うこと

### 本指名自動昇格
- `checkAutoHonshimei()` はお客様名・電話番号・セラピスト名の**3つが全部揃っている時だけ**実行する
- セラピスト選択（onchange）では呼び出さない

### 日時フォーマット
- `showResvCompleteModal`・`updateResvRow`・`submitReservation` では `_fmtLocalDatetimeJp(dateVal)` を使う
- `_fmtDatetimeJp` はISO文字列（サーバーから返ってくる値）用、`_fmtLocalDatetimeJp` はローカル日時文字列（フォームのvalue）用

### シフトカレンダーの並び順
- 承認済みシフトあり → 提出済み（pending/rejected）あり → シフトなし の順

### 予約一覧セラピストヘッダー
- `flex-wrap:wrap` を使わない（改行する）
- `white-space:nowrap` + `overflow:hidden` で1行に固定

### 顧客メモ絞り込み
- `customer_id` で絞り込む（`customer_no` での結合フィルタは機能しない）

### LINE WebView対応
- `confirm()` が常にfalseを返す問題 → `_confirm()` カスタムモーダルに置換

### 神栖店固有機能
- `send_payroll_line=false` / `send_store_line=true`（店落ちのみ送信）
- スカウトモード（🔍スカウトタブ）は神栖店のみ表示（`startAdminMode` でSTORE_IDが33333333の場合のみ）

### NEVERLAND固有機能
- LINE管理ページのセラピスト一覧に「割引モード」列を表示（store_id=44444444）
- セラピストごとに `店舗設定 / 按分（折半）/ 店舗負担` を選択可能
- 判定: `const isNeverland = STORE_ID === '44444444-0000-0000-0000-000000000004'`

### シフトカレンダー勤怠表示（両ビュー共通）
- `absent` / `noshow`: グレー背景・取り消し線・❌ラベル（`_calShiftBadge` / `_calDateCard`）
- `late` / `early_leave`: 通常カラー・⚠ラベル
- `pending`（未承認）: グレー背景・⏳ラベル

### 予約行のLINE再通知
- 各予約行に「📨 LINE通知」ボタンあり（キャンセル以外）
- `sendResvLineNotify(idx)` — 任意のタイミングでセラピストにLINE送信可能
- LINE ID未登録の場合はアラート表示

### 日時パース（`_fmtDatetimeJp` の注意点）
- Supabase の `timestamptz` がTZなし文字列（`"2026-05-31T01:00:00"` 形式）で返ることがある
- タイムゾーン情報がない場合は末尾に `Z` を付加してUTC強制する処理を実装済み
- **この関数を修正する際は必ずこの補正ロジックを維持すること**

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
- 欠勤・無断欠勤（absent/noshow）はスカウト出勤日数・来店回数から除外

#### therapists（セラピストマスタ）
- `interval_min` integer DEFAULT 30 — インターバル（分）
- `course_back` numeric — コースバック率（例: 0.6 = 60%）
- `nomination_fee` integer — セラピスト個別指名料
- `discount_mode` text DEFAULT NULL — セラピスト個別割引モード（NULLなら店舗設定に従う）**NEVERLAND限定で使用**
- `parking_fee` integer DEFAULT NULL — パーキング代（円/日）。設定時に給料へ加算・店落ちから減算

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

### 割引モードの優先順位（`_calcPayroll`）
`row.therapist_discount_mode` → `storeSettings.discount_mode` → グローバルデフォルト

### 固定バック時の割引計算
| 割引モード | 計算式 |
|---|---|
| `deduct_then_back`（按分・折半） | therapistCoursePay = fixedBack − discount/2 |
| `store_bears`（店舗負担）/ デフォルト | therapistCoursePay = fixedBack（割引は店舗が全額負担）|

- 固定バックが設定されている場合、`course_back`（バック率）は**給料計算に使われない**
- LINE管理ページでの保存バリデーション: 固定バックが1件以上設定済みなら `course_back` 入力は任意

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

### セラピスト関連（セッション17で追加）
- `updateLineUser` に `discountMode` パラメータ追加（therapists.discount_mode を保存）

---

## デプロイ方法

```bash
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

---

## セッション15（2026/5/28〜5/30）で実施した主な修正

| # | 内容 |
|---|---|
| 1 | 予約重複チェックでtherapistsキャッシュ未ロード時にinterval=0になるバグ修正（3箇所） |
| 2 | スカウトモード実装（神栖店のみ）— DBテーブル・API・UI・集計・コピー機能 |
| 3 | 予約変更時の案内テキストで時刻が「undefined」になるバグ修正（`_fmtLocalDatetimeJp`新規追加） |
| 4 | 来店回数をreservationsテーブルのみに統一（管理者・セラピスト・顧客詳細の3画面） |
| 5 | 本指名自動昇格がお客様名未入力でも発動するバグ修正 |
| 6 | シフトカレンダーの並び順を「承認済み→提出済み→なし」に変更 |
| 7 | 予約一覧セラピストヘッダーの改行を修正（flex-wrap削除） |
| 8 | getReservationsの返り値にrawDate追加（日時パース問題の根本対策） |

---

## セッション16（2026/5/31）で実施した主な修正

| # | 内容 |
|---|---|
| 1 | 姫予約承認時に顧客案内文モーダルが表示されないバグ修正 |
| 2 | 来週シフト締め切りボタン復活（store_settings.shift_deadline） |
| 3 | 予約変更モーダルの時刻25時表示バグ修正（rawDate + `_fmtDatetimeJp` 使用） |
| 4 | 予約変更後フォームがリセットされないバグ修正 |
| 5 | 時刻系バグ全面調査・修正（saveAndSendLine / 姫予約承認後ルーム取得） |
| 6 | 重複チェック全面修正（B1〜B4: interval不足・欠勤除外漏れ等） |
| 7 | 姫予約承認時のシフトチェック強化 |
| 8 | store_integrations フェーズ1実装（shift-sync-tool）— 連携認証情報DB管理化 |

---

## セッション17（2026/6/1）で実施した主な修正

| # | 内容 |
|---|---|
| 1 | shift-sync-tool Phase2: server.js にCORS・API Key認証追加、setup.sh・ecosystem.config.js 作成 |
| 2 | shift-sync-tool Phase3: シフトカレンダーに🌐サイト連携ボタン・モーダル追加（VPS設定後に有効） |
| 3 | シフトカレンダー日付順ビュー: 欠勤・遅刻をわかりやすく表示（`_calDateCard`新規追加） |
| 4 | シフトカレンダーセラピスト縦軸ビュー: 欠勤・遅刻表示を日付順ビューと統一（`_calShiftBadge`修正） |
| 5 | `_fmtDatetimeJp` にTZなしUTC文字列の自動補正（末尾Zを付加）を追加→予約変更25時バグ根本修正 |
| 6 | 予約行に📨 LINE再通知ボタン追加（`sendResvLineNotify`）— 通知しないを選んだ後から送信可能 |
| 7 | NEVERLAND限定: セラピスト個別割引モード設定（therapists.discount_modeカラム追加・要SQL実行） |
| 8 | 固定バック設定時のコースバック率を任意化（固定バックあり＝要設定バッジ非表示） |
| 9 | 固定バック＋按分モード時の割引計算を折半に修正（therapistCoursePay = fixedBack − discount/2） |
| 10 | 割引モードのラベル「按分（客負担）」→「按分（折半）」に修正 |

### セッション17 未完了タスク（次回継続）
- shift-sync-tool VPSデプロイ（ConoHa VPS契約待ち）
- VPS契約後: `index.html` の `VPS_BASE_URL` / `VPS_API_KEY` を設定してpush

---

## セッション18（2026/6/2）で実施した主な修正

| # | 内容 |
|---|---|
| 1 | 予約一覧（セラピスト別ビュー）でシフトあり・予約なしのセラピストも表示するよう修正（`renderResvByTherapist`で`_resvShiftMap`をマージ） |
| 2 | 予約が1件もない日でもシフトあり時はセラピスト別ビューを表示（`renderResvTable`の早期リターン条件を修正） |
| 3 | パーキング代機能追加: 固定バック設定モーダルに入力欄追加・給料に加算・店落ちから減算・「🚗 パーキング代含む」バッジ表示・LINE送信メッセージに「（パーキング代含む）」追記（`therapists.parking_fee`カラム追加） |

### パーキング代の仕様
- 固定バック設定モーダル最上部の「🚗 パーキング代」欄で設定
- `therapists.parking_fee` に保存（INTEGER, NULL = 未設定）
- 給料計算: 1セラピスト1日につき1回加算（売上件数によらず固定）
- 給料画面: 給料・店落ちの両方に「🚗 パーキング代含む」バッジ（設定時のみ）
- LINE送信: 店落ち行に「（パーキング代含む）」を追記（設定時のみ）

---

## 過去の作業ログ（参照先）

詳細な作業履歴はdocsフォルダを参照してください。

| ファイル | 内容 |
|---|---|
| docs/work_log_session14.md | セッション14（5/15〜5/25）の作業内容 |
| docs/work_log_session15.md | セッション15（5/28〜5/30）の作業内容 |
| docs/work_log_session16.md | セッション16（5/31）の作業内容 |
| docs/work_log_session17.md | セッション17（6/1）の作業内容 |
| docs/work_log_session18.md | セッション18（6/2）の作業内容 |

**不明な仕様・消えた機能はまず作業ログを確認すること。**
