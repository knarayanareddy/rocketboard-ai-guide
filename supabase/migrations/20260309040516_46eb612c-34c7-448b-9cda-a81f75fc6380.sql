
-- Allow authenticated users to insert notifications for peer features (replies, accepted answers, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
    AND policyname = 'Authenticated users can insert peer notifications'
  ) THEN
    CREATE POLICY "Authenticated users can insert peer notifications"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;
