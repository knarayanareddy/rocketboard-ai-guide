-- Add UPDATE and DELETE policies for ingestion_jobs to allow pack members to manage their ingestion tasks
-- Created: 2026-04-23

CREATE POLICY "Pack members can update ingestion jobs"
  ON public.ingestion_jobs FOR UPDATE TO authenticated
  USING (public.is_pack_member(auth.uid(), pack_id))
  WITH CHECK (public.is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Pack members can delete finished ingestion jobs"
  ON public.ingestion_jobs FOR DELETE TO authenticated
  USING (public.is_pack_member(auth.uid(), pack_id) AND status IN ('completed', 'failed'));
