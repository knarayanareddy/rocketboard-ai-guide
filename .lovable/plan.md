

# Task Assessment & Implementation Plan

## Status of All Tasks

| Task | Status | Evidence |
|------|--------|----------|
| **Task 2: Mobile Responsive Design** | **~85% Done** | MobileTopBar, DashboardLayout mobile support, full-screen chat panels all exist. Minor gaps: StatsStrip uses `sm:` instead of `md:` breakpoint, PackMembersPage lacks mobile card layout, some minor touch target and overflow improvements needed |
| **Task 3: Export Progress as PDF** | **Done** | `src/lib/export-progress.ts` and `src/components/ExportProgressButton.tsx` fully implemented with jspdf |
| **Task 4: Email Notifications** | **Not Done** | No `send-email` edge function, no `email-templates.ts`, no `notification_preferences` table. Only the `notifications` table and bell UI exist |
| **Task 5: Bulk Source Import** | **Not Done** | No `BulkImportModal` component exists |
| **Task 6: Analytics Dashboard** | **Not Done** | No analytics page, no `useAnalytics` hook, no analytics components |
| **Task 7: Gamification System** | **Not Done** | DB tables exist (`learner_xp`, `learner_badges`, `learner_streaks`) but no UI hooks (`useXP`, `useBadges`, `useStreak`) or components (`XPPopup`, leaderboard, profile modal) |
| **Task 8: Slack Integration** | **Not Done** | DB table `slack_integrations` exists but no edge functions, no UI settings, no message templates |
| **Task 9: SSO / OAuth Login** | **Not Done** | No OAuth buttons on AuthPage, no `signInWithOAuth` calls |
| **Task 10: PWA with Offline Mode** | **Not Done** | No manifest.json, no service worker, no VitePWA plugin, no offline store |

## Implementation Order

Tasks 2 and 3 are done. I will implement the remaining tasks in order: **Task 4 → 5 → 6 → 7 → 8 → 9 → 10**, plus the minor Task 2 refinements.

Due to the scale of this work (7+ major features), I will implement them incrementally across multiple messages. Here is the plan for what to tackle first:

### First: Complete Task 2 Remaining Items
- Update `StatsStrip.tsx` breakpoint from `sm:grid-cols-3` to `md:grid-cols-3`
- Add mobile card layout to `PackMembersPage.tsx` (replace table with cards on mobile)
- Minor touch target improvements

### Then: Task 4 — Email Notifications
1. **Database**: Create `notification_preferences` table with RLS
2. **Edge Function**: Create `supabase/functions/send-email/index.ts` (Resend-based)
3. **Templates**: Create `src/lib/email-templates.ts` with invite, content published, milestone, weekly digest templates
4. **Settings UI**: Add notification toggles to Settings page
5. **Triggers**: Wire up email sends after invite creation and module publish actions

### Then: Task 5 — Bulk Source Import
1. Create `src/components/BulkImportModal.tsx` with form-based and config file methods
2. Add to Sources page (author+ only)
3. Batch ingestion with progress tracking
4. Duplicate detection

### Then: Task 6 — Analytics Dashboard
1. Create `/packs/:packId/analytics` route
2. Create `src/hooks/useAnalytics.ts`
3. Build analytics components (metrics, leaderboard, charts, heatmap, insights)
4. Add nav item (admin+ only)

### Then: Task 7 — Gamification
1. Create `src/lib/xp-rules.ts` and `src/lib/badges.ts`
2. Create `src/hooks/useXP.ts`, `useBadges.ts`, `useStreak.ts`
3. Create XP popup, badge unlock modal, leaderboard
4. Integrate XP awards into existing progress actions
5. Add profile modal and sidebar XP display

### Then: Task 8 — Slack Integration
1. Create `send-slack-message` edge function
2. Create `src/lib/slack-message-templates.ts`
3. Create `src/hooks/useSlackIntegration.ts`
4. Add Slack settings UI to pack settings (webhook-based)

### Then: Task 9 — SSO/OAuth
1. Add Google and GitHub OAuth buttons to AuthPage
2. Handle OAuth profile data and avatar
3. Create `src/components/UserAvatar.tsx`
4. Add provider availability config

### Finally: Task 10 — PWA with Offline Mode
1. Create manifest.json and PWA icons
2. Install and configure vite-plugin-pwa
3. Create offline store with IndexedDB
4. Add offline fallback to data hooks
5. Create offline indicator component

---

This is a large body of work. Shall I proceed with completing Task 2 refinements and then Task 4 (Email Notifications) first?

