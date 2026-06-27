-- Remove duplicate transactions from automated sources.
-- For each (user_id, date::date, amount) group, keeps only the first created row.
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, date::date, amount
        ORDER BY created_at ASC
      ) AS rn
    FROM transactions
    WHERE source IN ('email', 'sms', 'notification')
  ) ranked
  WHERE rn > 1
);
