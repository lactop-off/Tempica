-- 同一従業員の勤務形態割当（user_work_pattern）の期間重複を DB レベルで禁止する。
-- 設計書 第IV部 A-2 の EXCLUDE 制約に対応。アプリ層でも事前検証するが、これは最終防衛線。
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE user_work_pattern
  ADD CONSTRAINT user_work_pattern_no_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
  );
