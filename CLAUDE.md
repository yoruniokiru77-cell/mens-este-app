# マッサージサロン管理システム — CLAUDE.md

このファイルはClaude Codeが自動で読み込む指示書です。
開発を始める前に必ずこの内容を把握してください。

---

## システム概要

マッサージサロン（いわき/HerRoom・水戸/Reメンズエステ・神栖/Premium・NEVERLAND・STELLA）向けの統合管理システム。

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
| STELLA | https://mens-este-app.vercel.app/?store=55555555... | 55555555-0000-0000-0000-000000000005 |

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
- **ラジオボタン禁止**: 選択UIは必ず `hidden radio + 見た目ボタン` パターンを使うこと（`_selectCancelReason`等の実装参照）

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
- `customer_id` で絞り込む（`customer_no` での結合フィルタは機能しない）

### 27時ルール
- 深夜0〜2時台の予約・売上は**前日扱い**（T03:00〜翌T02:59）
- `_fmtDatetimeJp(isoStr)` — ISO文字列を27時ルール対応でフォーマット
- `_fmtLocalDatetimeJp(localStr)` — `"YYYY-MM-DDTHH:MM"` 形式を手動パース（`new Date()` のTZずれ回避のため必須）
- **`new Date("2026-05-30T00:15")` はTZなしだとUTCとして解釈されてずれる**。ローカル日時文字列は必ず `_fmtLocalDatetimeJp` を使う

### 日時フォーマットの使い分け
- `_fmtDatetimeJp` はISO文字列（サーバーから返ってくる値）用
- `_fmtLocalDatetimeJp` はローカル日時文字列（フォームのvalue）用
- `showResvCompleteModal`・`updateResvRow`・`submitReservation` では `_fmtLocalDatetimeJp(dateVal)` を使う
- Supabase の `timestamptz` がTZなし文字列（`"2026-05-31T01:00:00"` 形式）で返ることがある → タイムゾーン情報がない場合は末尾に `Z` を付加してUTC強制する処理が実装済み。**この補正ロジックは必ず維持すること**

### UUID
- メニュー・ルームのIDはUUID（文字列）なので `Number()` で変換しない

### therapists取得
- 必ず `.eq('active', true)` を追加（重複レコード対策）

### モーダル表示
- `_showModal(id)` / `_hideModal(id)` を使う（iOS対応）
- 予約完了モーダル（resv-complete-modal）は `display:flex` を直接指定

### LINE WebView対応
- セラピスト側（LINE WebViewで動く）の関数では `confirm()` は常に false を返す
- **必ず `await _confirm(msg, okLabel, cancelLabel)` を使う**
- 管理者側（通常ブラウザ）は `confirm()` のままで可

### インターバル計算（予約重複チェック）
- 重複チェックは新規側・既存側の両方にintervalを加算
- `therapists` キャッシュ未ロード時は `getTherapistInterval` APIでDB直接取得
- DB取得失敗時はデフォルト30分にフォールバック
- **修正対象は3関数**：`updateResvRow` / `submitReservation` / `saveAndSendLine`
- `getReservations` の返り値に `rawDate`（元のISO文字列）を含む。重複チェック・案内テキスト生成では `r.rawDate` を使うこと
- `getTherapistInterval` の引数は `{ name }`（`{ therapist: ... }` を渡すと undefined になり常に30分フォールバック）

### 本指名自動昇格
- `checkAutoHonshimei()` はお客様名・電話番号・セラピスト名の**3つが全部揃っている時だけ**実行する
- セラピスト選択（onchange）では呼び出さない

### 姫予約の重複チェック3経路（不変条件）
- 申請時（`submitHimeReservation`・セラピスト）: `_confirm` で警告
- 承認時（`confirmHimeApprove`・管理者）: `confirm` で警告
- 通常予約登録時（`submitReservation`）: 承認待ち姫予約（status='active'）を**含めて**チェック済み
- いずれも除外条件は `status === 'cancelled'` のみ。承認待ち姫予約は除外しないこと。

### シフトカレンダーの並び順
- 承認済みシフトあり → 提出済み（pending/rejected）あり → シフトなし の順

### シフトカレンダー勤怠表示（両ビュー共通）
- `absent` / `noshow`: グレー背景・取り消し線・❌ラベル（`_calShiftBadge` / `_calDateCard`）
- `late` / `early_leave`: 通常カラー・⚠ラベル
- `pending`（未承認）: グレー背景・⏳ラベル
- 欠勤・無断欠勤（absent/noshow）はスカウト出勤日数・来店回数から除外

### 予約一覧セラピストヘッダー
- `flex-wrap:wrap` を使わない（改行する）
- `white-space:nowrap` + `overflow:hidden` で1行に固定

### 予約行のLINE再通知
- 各予約行に「📨 LINE通知」ボタンあり（キャンセル以外）
- `sendResvLineNotify(idx)` — 任意のタイミングでセラピストにLINE送信可能
- LINE ID未登録の場合はアラート表示

### 管理者フィルタ
- `therapists.is_admin = true` のセラピストはシフト表・セラピスト情報・予約登録のセラピスト選択から除外
- `window._adminThNames` (Set) に管理者名をロードしてシフトカレンダーのフィルタにも適用

### 神栖店固有機能
- `send_payroll_line=false` / `send_store_line=true`（店落ちのみ送信）
- スカウトモード（🔍スカウトタブ）は神栖店のみ表示（`startAdminMode` でSTORE_IDが33333333の場合のみ）

### STELLA固有機能
- `store_id = '55555555-0000-0000-0000-000000000005'`
- 以下のタブ・機能を非表示:
  - ナビ: 備品（supply.html）タブ
  - マスタ管理: 固定費・振込先・都度経費タブ
  - 売上確認: 都度経費・固定費セクション（`store-expense-section`）
  - 神栖・STELLAでは面接管理・アナウンスタブも非表示
- 判定: `const isStella = STORE_ID === '55555555-0000-0000-0000-000000000005'`

### NEVERLAND固有機能
- LINE管理ページのセラピスト一覧に「割引モード」列を表示（store_id=44444444）
- セラピストごとに `店舗設定 / 按分（折半）/ 店舗負担` を選択可能
- 判定: `const isNeverland = STORE_ID === '44444444-0000-0000-0000-000000000004'`
- 「釣銭」LINEコマンドはNEVERLAND向け
- cash.html では「退勤時の釣銭残高」「投函額」「残すべき釣銭」と表示を変更（`NEVERLAND_STORE_ID_CASH` で判定）

### パーキング代
- 固定バック設定モーダル最上部の「🚗 パーキング代」欄で設定
- `therapists.parking_fee` に保存（INTEGER, NULL = 未設定）
- 給料計算: 1セラピスト1日につき1回加算（売上件数によらず固定）
- 給料画面: 給料・店落ちの両方に「🚗 パーキング代含む」バッジ（設定時のみ）
- LINE送信: 店落ち行に「（パーキング代含む）」を追記（設定時のみ）

### 延長固定バック
- `therapists.extension_back`（円/回・それ以外）/ `extension_back_honshimei`（円/回・本指名）
- `_calcPayroll`内: `sale_options`の`menuId=null`かつ`name.includes('延長')`の項目がextとして計算
- 固定バック設定時: `extFixed`（本指名なら`extensionBackHon`、それ以外なら`extensionBack`）を使用
- 未設定時: `option_back`率で計算

### セラピスト名変更機能
- マスタ管理→セラピストタブの一覧に「✏️ 名前変更」ボタンあり
- `openRenameTherapistModal(therapistId, therapistName)` → `execRenameTherapist()` → `apiGet('renameTherapist', ...)`
- カスケード更新対象: `therapists` / `reservations` / `sales` / `shifts`（therapist_idベース＋therapist_name両方）/ `payroll_confirmations` / `tokens`
- **同名セラピストが退職→新人で使い回した場合、給料計算・来店履歴で新旧が混在する（既知課題）**

### 機種変更時のLINE ID自動更新
- セラピストが新スマホで同じ名前をBotに送信 → 既存レコードのline_user_idを自動上書き（`registerTherapist`）
- 異なる名前で登録してしまった場合はSQL手動対応が必要

### セラピスト確認機能
- `reservations.therapist_confirmed` — セラピストが予約を確認したかどうかのフラグ
- `confirmReservation` — DB更新 + 店舗LINEに通知
- `confirmAllReservations` — 未確認全件を1通のLINEでまとめて通知
- 管理者予約一覧に「✅ 確認済」バッジ表示（`therapist_confirmed=true`の場合）

### 売上編集の給料キャッシュ
- `openSalesEditModal` は `_ensurePayrollCache()` を `await` する
- 戻り値が `false`（DB取得失敗）の場合は `sales-edit-cache-warning` バナーを表示
- **給料計算ページを一度開いてからでないとキャッシュが存在しない点に注意**

### sale_optionsとoption_priceの整合性
- `sale_options`テーブルが古い/欠損データの場合、OPT給料が正しく計算されない
- 症状: 固定バックが参照されず `amount × optionBack` にフォールバックしてOPT給料がズレる
- 対処: 売上編集モーダルで正しいオプションを選択して再保存 → `saveSaleOptions`が `sale_options`を DELETE→INSERT で更新する

### 金庫管理（cash.html）の全店舗共通フロー
1. セラピストがLINEで「金庫」（いわき）または「釣銭」（NEVERLAND）→ cash.html を開く
2. 出勤時残高を入力
3. 管理者が給料画面でLINE送信 → `payroll_confirmations.store_drop` に正確な店落ちを保存
4. セラピストが再度 cash.html を開く → 店落ち表示・退勤入力
5. 退勤時残高・投函額を入力

- **cash.html を使用しているのはいわきとNEVERLANDのみ**（水戸・神栖はLINEウェブフック未対応）
- 店落ち取得は全店舗 `payroll_confirmations` から取得（簡易計算は廃止済み）
- `payroll_confirmations.period` フォーマット: `"YYYY/MM/DD"` 形式（例: `"2026/06/17"`）= index.html の `dateLabel` と同一形式

### sendPayrollLine の送信内容
```
【給与明細】（店舗名）
日付

給料：¥XX,XXX          ← send_payroll_line=true
店落ち：¥XX,XXX         ← send_store_line=true
（パーキング代含む）      ← parkingFee設定時
前回XX円不足/過払い       ← 繰越あり時
合計請求：¥XX,XXX        ← 繰越あり時

--- 経費内訳 ---         ← send_expense_line=true かつ経費あり
--- 明細 ---            ← 明細トグルON時
HH:MM XX分 給料¥XX,XXX 店落¥XX,XXX

確認したらLINEで「確認」と返信してください。
```

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
- `therapist_confirmed` boolean DEFAULT false — セラピスト確認フラグ

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
- `parking_fee` integer DEFAULT NULL — パーキング代（円/日）
- `extension_back` integer DEFAULT NULL — 延長固定バック（それ以外）
- `extension_back_honshimei` integer DEFAULT NULL — 延長固定バック（本指名）
- `is_admin` boolean DEFAULT false — 管理者フラグ（trueのセラピストは選択肢から除外）
- `age` integer / `cup` text / `real_name` text / `profile_notes` text — セラピスト情報タブ用

#### customers（顧客マスタ）
- `status` の有効値: `normal`, `注意`, `NG`, `出禁`（「通常」は不可）
- `ng_therapists` — `text[]` 型（jsonbではない）

#### store_settings（店舗設定）
- `discount_mode` — `deduct_then_back`（按分）/ `store_bears`（店舗全額）
- `send_payroll_line` boolean — 給料LINE送信フラグ
- `send_store_line` boolean — 店落ちLINE送信フラグ

#### therapist_menu_backs（固定バック設定）
- 本指名と通常で分けて設定可能（`back_amount_honshimei` 列あり）

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

### スカウト関連
- `getScoutCompanies` — 紹介元会社一覧
- `saveScoutCompany` — 会社登録・更新
- `getTherapistScout` — セラピスト紐付け取得
- `saveTherapistScout` — 紐付け保存（UPSERT）
- `deleteTherapistScout` — 紐付け解除（active=false）
- `getScoutSummary` — 月次集計（5段階分割クエリ）

### セラピスト関連
- `updateLineUser` — `discountMode` パラメータあり（therapists.discount_mode を保存）

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
| ログイン | ログインURL（12時間有効）を発行 |
| 登録 | 別店舗の追加登録（招待コードを入力） |
| 発注 | 備品発注画面URLを発行 |
| シフト | 今週・来週の承認済みシフトを返信 |
| 金庫 | 金庫管理画面URLを発行（いわき店のみ） |
| 釣銭 | 金庫管理画面URLを発行（NEVERLAND向け） |
| 確認 | 給料確認（confirmed_atを更新） |

---

## `_calcPayroll` 関数の完全仕様（index.html:2689）

**この関数は唯一の給料計算ロジック。絶対に変更前に全仕様を確認すること。**

### 引数
```javascript
_calcPayroll(row, storeSettings, opts)
// row:          salesレコード相当のオブジェクト
// storeSettings: store_settingsレコード（nullの場合window._cachedStoreSettingsを使用）
// opts:         { miscFee, accomFee, optItems, menuBackMap, therapistId,
//                extensionBack, extensionBackHon }
```

### 不変条件（変更禁止）
```
totalAmount      = coursePrice + actualOptPrice + nomFee - discount
baseTherapistPay = therapistCoursePay + therapistOptPay + nomFee
storeDrop        = totalAmount - baseTherapistPay
therapistPay     = baseTherapistPay - miscFee - accomFee
```
⚠ **miscFee/accomFeeはUI層（recalcPayroll）でstoreDropに加算される。`_calcPayroll`内では除外すること（二重計上防止）。**

### コース給料（therapistCoursePay）の計算順序
| 条件 | 計算式 |
|---|---|
| 固定バックあり × 按分モード（deduct_then_back） | `fixedBack - round(discount / 2)` |
| 固定バックあり × 店舗負担 or デフォルト | `fixedBack`（割引全額店舗負担） |
| 固定バックなし × store_bears | `round(coursePrice × courseBack)` |
| 固定バックなし × deduct_then_back or デフォルト | `round((coursePrice - discount) × courseBack)` |

### オプション給料（therapistOptPay）の計算順序
1. `optItems`（sale_optionsレコード）+ `menuBackMap` + `therapistId` が全て揃っている場合 → 1件ずつ固定バックを参照
2. それ以外 → `optPrice × optionBack` で一括計算

#### optItemsの各件の判定
- `menuId=null` かつ `name.includes('延長')` → 延長バック（`therapistExtPay`に加算・表示分離用）
  - `extensionBack` / `extensionBackHon` が設定されていれば固定額を使用
  - 未設定の場合 → **`courseBack`（コースバック率）で計算**（`optionBack`ではない・重要）
- それ以外 → `menuBackMap[therapistId + '_' + menuId]` で固定バックを検索
  - 固定バックあり → その額
  - 固定バックなし → `amount × optionBack`

### 割引モードの優先順位
`row.therapist_discount_mode` → `storeSettings.discount_mode` → `DISCOUNT_MODE`（グローバルデフォルト）

### バック率のデフォルト値
- `courseBack`: セラピスト未設定時は `ss.default_course_back || 0.5`
- `optionBack`: セラピスト未設定時は `ss.default_option_back ?? 1.0`

### 戻り値
```javascript
{ storeDrop, therapistPay, therapistCoursePay, therapistOptPay, therapistExtPay, courseBack, optionBack, fixedBack }
```

### 給料明細モーダル（openPayrollPreviewModal: line 5644）の列構成
| 列 | 内容 |
|---|---|
| 時刻 | 予約時刻 |
| コース | 分数 + 指名種別 |
| お客様 | 顧客名 |
| 合計金額 | 会計金額（割引・指名料の内訳付き） |
| コースバック | therapistCoursePay（固定=青太字、率=グレー） |
| OPT給料 | therapistOptPay - therapistExtPay |
| 指名料 | nominationFee（セラピスト受取分） |
| 延長給料 | therapistExtPay |
| 店落ち | storeDrop |

### グローバルキャッシュ（getPayroll実行時に設定）

| 変数 | 内容 |
|---|---|
| `window._payrollMenuByMin` | course_min → menu_id |
| `window._payrollMenuBackMap` | therapistId+'_'+menuId → {other, honshimei} |
| `window._cachedStoreSettings` | 店舗設定 |

売上編集モーダルの`calcSalesEditTotal`がこれらを参照して`_calcPayroll`を呼び出す。**給料計算ページを一度開いてからでないとキャッシュが存在しない点に注意。**

---

## v2リアーキテクチャ計画（2026/6/24決定）

### 方針
現行システム（main/Vercel本番）は一切触らず、v2ブランチで並行開発する。

```
現行: main branch → mens-este-app.vercel.app（本番・触らない）
新規: v2 branch   → mens-este-app-v2.vercel.app（開発・テスト）
共通: 同じSupabaseを参照
```

### 技術スタック
| 要素 | 採用 |
|---|---|
| ビルド | Vite |
| 言語 | TypeScript |
| UI | Vanilla TS（Reactなし） |
| テスト | Vitest |
| デプロイ | Vercel（別プロジェクト: mens-este-app-v2） |

### フェーズ
1. **Phase 1**: v2ブランチ作成・Vite+TS初期化・Vercel別プロジェクト接続
2. **Phase 2**: `_calcPayroll`をTypedモジュールに移植・Vitestで全パターンテスト作成
3. **Phase 3**: `apiGet`のswitch文をservice別ファイルに分割（payrollService.ts等）
4. **Phase 4**: 画面ごとにUI移植
5. **Phase 5**: v2をmainにマージ・本番URL差し替え

### 作業手順（Phase 1）
1. `git checkout -b v2`
2. `npm create vite@latest . -- --template vanilla-ts`
3. Vercelで新プロジェクト`mens-este-app-v2`を作成・v2ブランチ接続
4. `_calcPayroll`をTypeScriptで書き直し（src/lib/calcPayroll.ts）
5. Vitestで給料計算の全パターンテスト作成

---

## 未完了タスク

- **VPSデプロイ（shift-sync-tool）**: ConoHa VPS（IP: 133.88.117.129）起動済み・SSH未接続
  - rootパスワード: `/xiSa!8xZsZ7uDy`
  - ファイル: `C:\Users\skb81\OneDrive\事業\AI\1.メンエス\シフト自動連係\shift-sync-tool\`
  - 完了後: `index.html` の `VPS_BASE_URL` / `VPS_API_KEY` を更新して git push

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
| docs/work_log_session19.md | セッション19（6/3〜6/4）の作業内容 |
| memory/project_session20.md | セッション20（7/21）の作業内容 |
| docs/work_log_session22.md | セッション22（7/28〜29）の作業内容 |
| docs/work_log_session23.md | セッション23（7/30）の作業内容 |

**不明な仕様・消えた機能はまず作業ログを確認すること。**
