-- Allow 'notification' as a valid transaction source
-- (push notifications from bank apps intercepted via NotificationListenerService)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('email','sms','manual','api','pdf','notification'));
