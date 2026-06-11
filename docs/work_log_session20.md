# セッション20 作業ログ（2026/6/11）

## 実施した修正

| # | 内容 |
|---|---|
| 1 | 顧客詳細の来店履歴合計金額にオプション代が含まれないバグ修正（`sale_options`テーブルの`h.options`配列を使用） |
| 2 | 完売バッジが翌日の予約一覧でも表示されるバグ修正（`isToday`判定に27時ルールを適用） |
| 3 | お休み申請機能追加（セラピストが申請 → 管理者承認 → 当日欠勤/事前欠勤に設定・LINE通知） |
| 4 | 予約キャンセルモーダル追加（理由選択＋メモ付きでセラピストにLINE通知） |
| 5 | 顧客詳細にキャンセル履歴セクション追加（管理者のみ表示・お客様都合のみ） |
| 6 | 最短案内の残分数計算バグ修正（`calcEarliestAvailable`が`{earliest, remaining}`を返すよう変更） |
| 7 | お休み申請承認済みセラピストを予約一覧から非表示 |
| 8 | 雑費・宿泊費・その他の内訳LINE送信設定を店舗設定に追加（デフォルトOFF） |

---

## 詳細

### 1. 来店履歴合計金額バグ修正
- **原因**: `h.optionPrice`（`reservations.option_price`）は売上登録時に更新されないため常に0
- **修正**: `h.options`（`sale_options`テーブルから取得済みの配列）の合計を使用

### 2. 完売バッジ27時ルールバグ修正
- **原因**: `isToday`判定が通常の日付比較のため、深夜0〜2時台に前日を「今日」と認識できていなかった
- **修正**: `todayDate`にも27時ルールを適用（0〜2時台は1日戻す）

### 3. お休み申請機能
- **DB**: `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_dayoff_request boolean DEFAULT false;` が必要
- **新しいattendance_type**: `pre_absent`（事前欠勤）を追加（当日→`absent`、前日以前→`pre_absent`）
- **フロー**: セラピストがシフト提出画面の「お休み申請」タブから申請 → 管理者のシフトカレンダーに通知パネル表示 → 承認/却下でLINE通知

### 4. 予約キャンセルモーダル
- 理由選択: お客様都合 / セラピスト都合 / その他
- 任意メモ入力可能
- キャンセル後、選択した理由とメモ付きでセラピストにLINE送信

### 5. キャンセル履歴
- `getCustomerHistory`に`includeCancel`パラメータ追加
- お客様都合のキャンセルのみ顧客詳細に表示（管理者のみ）

### 6. 最短案内残分数修正
- `calcEarliestAvailable`の返り値を`number|null`から`{earliest, remaining}|null`に変更
- `remaining`は「次の予約開始まで - インターバル」で正しく計算

### 7. お休み申請承認済み非表示
- `_resvShiftMap`から`isDayoffRequest=true`のシフトのみのセラピストを除外
- 予約が1件でもある場合は表示を維持

### 8. 雑費・宿泊費LINE送信設定
- **店舗設定に追加**: 「雑費・宿泊費・その他の内訳をLINEで送信する」トグル（デフォルトOFF）
- **DB**: `ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS send_expense_line boolean DEFAULT false;`（実行済み）
- ONの場合、経費入力がある場合のみLINEメッセージに内訳を追記

---

## 未完了タスク（次回継続）

- **VPSデプロイ（shift-sync-tool）**: ConoHa VPS IP: 133.88.117.129、rootパスワード: `/xiSa!8xZsZ7uDy`
  - ファイル: `C:\Users\skb81\OneDrive\事業\AI\1.メンエス\シフト自動連係\shift-sync-tool\`
  - 完了後: `index.html`の`VPS_BASE_URL` / `VPS_API_KEY`を更新してgit push
- **お休み申請DB**: `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_dayoff_request boolean DEFAULT false;` 未実行の場合は要対応
