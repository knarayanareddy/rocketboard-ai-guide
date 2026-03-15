-- Security hardening for RLS policies
-- Created: 2026-03-15

-- 1. Secure pack_members table
-- Drop problematic overly permissive policy if it exists
DROP POLICY IF EXISTS "Users can insert own pack membership" ON public.pack_members;
DROP POLICY IF EXISTS "Authenticated users can insert own pack membership" ON public.pack_members;

-- Ensure insert is only allowed for admins/owners OR for a 'learner' joining a public pack (if we want that)
-- For now, we enforce that only a pack admin/owner can add members.
DROP POLICY IF EXISTS "Pack admins can insert members" ON public.pack_members;
CREATE POLICY "Pack admins can insert members"
  ON public.pack_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Admins of the pack can add anyone
    public.has_pack_access(auth.uid(), pack_id, 'admin')
  );

-- 2. Secure learner_badges table
-- Prevent users from self-awarding badges
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.learner_badges;
DROP POLICY IF EXISTS "Authenticated users can insert own badges" ON public.learner_badges;

CREATE POLICY "Only service role can award badges"
  ON public.learner_badges FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can view their own badges"
  ON public.learner_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Pack members can view other members' badges"
  ON public.learner_badges FOR SELECT TO authenticated
  USING (public.is_pack_member(auth.uid(), pack_id));

-- 3. Secure organizations table
-- Only allow members to see their organization metadata
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
CREATE POLICY "Members can view their own organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members 
      WHERE org_members.org_id = organizations.id 
      AND org_members.user_id = auth.uid()
    )
  );
