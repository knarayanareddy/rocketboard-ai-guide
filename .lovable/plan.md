
# Implementation Plan: Tasks 2–7

This plan covers 6 major features to be built sequentially. Each task involves database tables, hooks, UI pages/components, and sidebar/routing integration.

---

## Task 2: Content Feedback & Rating System

**Database (migration)**
- `content_feedback` table: id, user_id, pack_id, module_key, section_id (nullable), feedback_type (validated via trigger), comment, is_resolved, resolved_by, resolved_at, created_at. Unique on (user_id, pack_id, module_key, section_id, feedback_type). Index on (pack_id, module_key, is_resolved).
- `content_ratings` table: id, user_id, pack_id, module_key, section_id (nullable), rating (1-5, validated via trigger), created_at. Unique on (user_id, pack_id, module_key, section_id).
- RLS: users insert/read/update/delete own rows; authors+ read all for pack.
- Validation triggers instead of CHECK constraints for feedback_type and rating.

**Hook**: `src/hooks/useContentFeedback.ts`
- `submitFeedback`, `submitRating`, `fetchMyFeedback`, `fetchPackFeedback`, `resolveFeedback`
- Uses React Query for caching/invalidation

**UI Changes**
- `src/components/SectionFeedback.tsx` — thumbs up/down + flag dropdown with optional comment, placed at bottom of each section
- Add to `GeneratedSectionViewer` in `ModuleView.tsx` (after citations area)
- `src/components/ModuleRating.tsx` — 1-5 star rating + optional comment, shown after quiz/endcap in ModuleView
- `src/components/QuizQuestionFeedback.tsx` — small thumbs up/down after answer reveal in QuizRunner

**Feedback Dashboard**
- `src/pages/FeedbackPage.tsx` — overview stats, modules ranked by rating, flagged content list with resolve/refine actions
- Route: `/packs/:packId/feedback`
- Sidebar: "Feedback" item (author+ only)
- Author indicators in GeneratedSectionViewer: subtle feedback count badges

---

## Task 3: Team Directory & "Who Owns What" Map

**Database (migration)**
- `team_members`: id, pack_id, name, email, role_title, slack_handle, github_handle, avatar_url, bio, areas_of_expertise (text[]), services_owned (text[]), is_auto_detected, created_at. RLS: pack members read; author+ write.
- `meeting_checklist`: id, pack_id, team_member_id (FK), suggested_topics (text[]), time_estimate_minutes, priority (trigger-validated), track_key, created_at. RLS: pack members read; author+ write.
- `meeting_progress`: id, user_id, pack_id, team_member_id (FK), is_met, met_at, notes. Unique(user_id, pack_id, team_member_id). RLS: users own rows.

**Hook**: `src/hooks/useTeamDirectory.ts`
- CRUD for team members (author+), meeting progress (learner), meeting checklist

**UI**
- `src/pages/TeamPage.tsx` — directory with filter by expertise/track, search, meeting progress tracking with "Mark as Met" + notes
- Route: `/packs/:packId/team`
- Sidebar: "Team" (all roles)
- Author management: add/edit/remove team members inline
- Dashboard widget: "People to Meet: X/Y"

---

## Task 4: Bookmarks, Section Navigation & Breadcrumbs

**Database (migration)**
- `bookmarks`: id, user_id, pack_id, bookmark_type (trigger-validated: module_section, glossary_term, path_step, ask_lead_question), reference_key, label, created_at. Unique(user_id, pack_id, bookmark_type, reference_key). RLS: users own rows.

**Hooks**
- `src/hooks/useBookmarks.ts` — toggleBookmark, fetchBookmarks, isBookmarked
- `src/hooks/useRecentlyViewed.ts` — localStorage-based, last 5 pages

**UI Components**
- `src/components/BookmarkButton.tsx` — toggle icon, used in SectionViewer, GlossaryPage, PathsPage, AskLeadPage
- `src/pages/BookmarksPage.tsx` — list saved items with filter by type, navigate/remove
- Route: `/packs/:packId/bookmarks`
- Sidebar: "Saved" (all roles)

**Section Navigation**
- Previous/Next buttons at bottom of each section in ModuleView
- `src/components/SectionMiniMap.tsx` — sticky sidebar showing section progress (read/current/unread), clickable

**Breadcrumbs**
- `src/components/Breadcrumbs.tsx` — auto-generated from route + pack context
- Integrated into `DashboardLayout.tsx` above main content
- Mobile: truncated to last 2 segments

**Recently Viewed**
- Dashboard widget showing last 5 visited pages (localStorage)

---

## Task 5: 30-60-90 Day Onboarding Plan

**Database (migration)**
- `onboarding_milestones`: id, pack_id, title, description, phase (trigger-validated: day_1/week_1/week_2/month_1/month_2/month_3), target_type (trigger-validated: module_completion/quiz_score/path_completion/meeting/custom), target_value (jsonb), is_required, sort_order, created_at. RLS: pack members read; admin+ write.
- `learner_milestone_progress`: id, user_id, pack_id, milestone_id (FK), status (trigger-validated: pending/in_progress/completed/overdue), completed_at. Unique(user_id, pack_id, milestone_id). RLS: users own rows; admin+ read all.
- `onboarding_schedule`: id, user_id, pack_id, start_date, expected_completion_date, created_at. Unique(user_id, pack_id). RLS: users read own; admin+ read/write all.

**Hooks**
- `src/hooks/useMilestones.ts` — CRUD milestones, fetch progress, auto-compute status from user_progress/quiz_scores/path_progress/meeting_progress
- `src/hooks/useOnboardingSchedule.ts` — schedule management

**UI**
- `src/pages/TimelinePage.tsx` — learner timeline view with phase groupings, auto-computed milestone status, on-track/behind/ahead indicator
- Route: `/packs/:packId/timeline`
- Sidebar: "My Timeline" (all roles)
- Admin: milestone management UI (add/edit/reorder milestones per phase)
- Admin: set learner start dates on Members page
- Dashboard widget: current phase + milestone progress + status

---

## Task 6: Spaced Repetition & Knowledge Checks

**Database (migration)**
- `review_schedule`: id, user_id, pack_id, module_key, next_review_date, review_count, last_reviewed_at. Unique(user_id, pack_id, module_key). RLS: users own rows.
- `knowledge_checks`: id, user_id, pack_id, module_key, check_type (trigger-validated: pre_test/review), score, total, questions_data (jsonb), created_at. RLS: users own rows.

**Library**: `src/lib/spaced-repetition.ts`
- `calculateNextReview(reviewCount, selfRating)` — returns days: 3→7→14→30, adjusted by rating

**Hooks**
- `src/hooks/useReviewSchedule.ts` — fetch due reviews, complete review, schedule after module completion
- `src/hooks/useKnowledgeChecks.ts` — pre-test and review check management

**UI**
- `src/components/ReviewSession.tsx` — key takeaway recall + 3 random quiz questions + self-rating + next review info
- Route: `/packs/:packId/review/:moduleKey` (review session) — distinct from existing ReviewPage
- `src/components/PreModuleCheck.tsx` — 5 random quiz questions, score → skip or read recommendation
- Shown when learner first opens a module (check if pre-test exists)
- `src/components/GlossaryFlashcards.tsx` — card flip UI, "I Know This"/"Need Review" flow
- Button on GlossaryPage to enter flashcard mode
- Dashboard widget: "Time to Review!" for due modules
- Settings: spaced repetition on/off, pre-test on/off, skip threshold

---

## Task 7: Stale Content Detection & Content Health Dashboard

**Database (migration)**
- `content_freshness`: id, pack_id, module_key, section_id, referenced_chunk_ids (text[]), chunk_hash_at_generation (jsonb), chunks_snapshot (jsonb), is_stale, staleness_details (jsonb), last_checked_at. Unique(pack_id, module_key, section_id). RLS: author+ read/write.

**Edge Function**: `supabase/functions/check-staleness/index.ts`
- Accepts { pack_id }, compares current chunk hashes vs stored hashes
- Returns stale count + details
- Uses service role after verifying auth + pack membership

**Integration with module generation**
- After saving a generated module, record chunk hashes in content_freshness (done in existing generation flow or via a post-save hook)

**Hooks**
- `src/hooks/useContentFreshness.ts` — fetch freshness data, trigger staleness check, refresh section/module

**UI**
- `src/pages/ContentHealthPage.tsx` — overall freshness %, stale sections list with View Diff/Refresh Section/Refresh Module actions, learner feedback summary, recommendations
- `src/components/ContentDiffViewer.tsx` — side-by-side old vs new chunk content with highlighted diffs
- Route: `/packs/:packId/health`
- Sidebar: "Content Health" (author+ only) with badge count for stale items
- Module cards (author view): freshness indicator (green/amber/red)
- Dashboard banner for authors when stale content exists

---

## Routing & Sidebar Summary

New routes added to `App.tsx`:
- `/packs/:packId/feedback` → FeedbackPage
- `/packs/:packId/team` → TeamPage
- `/packs/:packId/bookmarks` → BookmarksPage
- `/packs/:packId/timeline` → TimelinePage
- `/packs/:packId/review/:moduleKey` → ReviewSession (new, separate from existing ReviewPage)
- `/packs/:packId/health` → ContentHealthPage

New sidebar items in `AppSidebar.tsx`:
- Feedback (author+)
- Team (all roles)
- Saved (all roles)
- My Timeline (all roles)
- Content Health (author+)

## Migration Count
Six database migrations total (one per task), each creating the relevant tables with validation triggers and RLS policies.

## Edge Function
One new edge function: `check-staleness` (Task 7), registered in `supabase/config.toml`.

## Estimated Files Created/Modified
- ~18 new files (pages, hooks, components, lib)
- ~8 modified files (App.tsx, AppSidebar.tsx, DashboardLayout.tsx, ModuleView.tsx, QuizRunner.tsx, GlossaryPage.tsx, Index.tsx, config.toml)
