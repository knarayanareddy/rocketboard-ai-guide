

## Implementation Plan: Tasks 2–10

I've read all 9 tasks in detail. Given the scale (each task is substantial), I'll implement them sequentially. Here's the consolidated plan:

---

### Task 2: Mobile Responsive Design

**Files to create:**
- `src/components/MobileTopBar.tsx` — Fixed top bar with hamburger, pack title, avatar dropdown

**Files to modify:**
- `src/hooks/use-mobile.tsx` — Add `useResponsive()` returning `{ isMobile, isTablet, isDesktop }`
- `src/components/DashboardLayout.tsx` — Add MobileTopBar, mobile sidebar overlay with backdrop, top padding on mobile
- `src/components/AppSidebar.tsx` — Close sidebar on nav link click (mobile), swipe-to-close gesture
- `src/components/ModuleChatPanel.tsx` — Full-screen on mobile (inset-0 instead of fixed bottom-right)
- `src/components/MissionControlChat.tsx` — Full-screen on mobile, adjust FAB positions to avoid overlap
- `src/index.css` — Add touch utility classes (`-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`)
- Various pages — Ensure responsive grid classes are present (most already use `grid-cols-1 md:grid-cols-2`)

**Key approach:** The existing shadcn sidebar already has mobile sheet support. We'll leverage that plus add MobileTopBar. Chat panels get conditional classes based on `useIsMobile()`.

---

### Task 3: Export Progress as PDF

**Install:** `jspdf` + `jspdf-autotable` (lighter than @react-pdf/renderer)

**Files to create:**
- `src/lib/export-progress.ts` — PDF generation with cover page, module details, notes, quiz scores, paths
- `src/components/ExportProgressButton.tsx` — Fetches all data, calls PDF generator, triggers download

**Files to modify:**
- `src/pages/Index.tsx` — Add export button in stats section
- `src/pages/SettingsPage.tsx` — Add "Data Export" section

---

### Task 4: Email Notifications

**Database migrations:**
- `notification_preferences` table (user_id, email toggle booleans)
- `notifications` table (user_id, type, title, message, link, is_read)
- `notifications_log` table (tracking sent emails)

**Edge functions to create:**
- `supabase/functions/send-email/index.ts` — Generic email sender (Resend API)
- `supabase/functions/invite-email/index.ts` — Invitation-specific emails

**Files to create:**
- `src/lib/email-templates.ts` — HTML templates for each notification type
- `src/hooks/useNotifications.ts` — Fetch/mark-read with realtime subscription
- `src/components/NotificationBell.tsx` — Bell icon + dropdown in sidebar/topbar

**Files to modify:**
- `src/pages/PackMembersPage.tsx` — Call invite-email after creating invite
- `src/pages/SettingsPage.tsx` — Add notification preferences toggles

---

### Task 5: Bulk Source Import

**Install:** `js-yaml` + `@types/js-yaml`

**Files to create:**
- `src/components/BulkImportModal.tsx` — Form-based + config file import with drag-drop, validation, progress

**Files to modify:**
- `src/pages/SourcesPage.tsx` — Add "Bulk Import" button

---

### Task 6: Analytics Dashboard

**Files to create:**
- `src/pages/AnalyticsPage.tsx` — Main analytics page with all sections
- `src/hooks/useAnalytics.ts` — Fetches all learner data, computes metrics
- `src/components/analytics/AnalyticsMetricCard.tsx`
- `src/components/analytics/LearnerLeaderboard.tsx`
- `src/components/analytics/CompletionHeatmap.tsx`
- `src/components/analytics/QuizPerformanceChart.tsx`
- `src/components/analytics/EngagementInsights.tsx`
- `src/components/analytics/ProgressTimeline.tsx`

**Files to modify:**
- `src/App.tsx` — Add `/packs/:packId/analytics` route
- `src/components/AppSidebar.tsx` — Add Analytics nav item (admin+)
- `src/pages/Index.tsx` — Add admin quick stats widget

---

### Task 7: Gamification (XP, Badges, Streaks, Leaderboard)

**Database migrations:**
- `learner_xp` table
- `learner_badges` table
- `learner_streaks` table

**Files to create:**
- `src/lib/xp-rules.ts` — XP amounts and limits
- `src/lib/badges.ts` — Badge definitions and conditions
- `src/hooks/useXP.ts` — Award XP, fetch totals, leaderboard
- `src/hooks/useBadges.ts` — Check/award badges
- `src/hooks/useStreak.ts` — Track daily streaks
- `src/components/XPPopup.tsx` — Floating "+10 XP" animation
- `src/components/BadgeUnlockModal.tsx` — Celebration modal with confetti
- `src/components/ProfileModal.tsx` — XP, badges, streak display

**Files to modify:**
- `src/hooks/useProgress.ts` — Integrate XP awards on section read
- `src/components/QuizRunner.tsx` — XP on quiz complete
- `src/hooks/useNotes.ts` — XP on note save
- `src/components/AppSidebar.tsx` — Show XP + streak in footer
- `src/pages/Index.tsx` — Leaderboard section
- `src/pages/SettingsPage.tsx` — Gamification preferences

---

### Task 8: Slack Integration

**Database migration:**
- `slack_integrations` table

**Edge functions:**
- `supabase/functions/send-slack-message/index.ts`
- `supabase/functions/slack-command/index.ts`

**Files to create:**
- `src/lib/slack-message-templates.ts` — Block Kit templates
- `src/hooks/useSlackIntegration.ts`
- `src/components/SlackIntegrationSettings.tsx`

**Files to modify:**
- `src/pages/SettingsPage.tsx` or pack settings — Add Slack config section

---

### Task 9: SSO / OAuth Login

**Files to create:**
- `src/components/UserAvatar.tsx` — Avatar with image or initials fallback
- `src/components/SocialLoginButtons.tsx` — Google + GitHub OAuth buttons

**Files to modify:**
- `src/pages/AuthPage.tsx` — Add OAuth buttons above email form
- `src/components/AppSidebar.tsx` — Show user avatar
- `src/pages/PackMembersPage.tsx` — Show avatars + auth method icons

---

### Task 10: PWA with Offline Mode

**Install:** `vite-plugin-pwa` (dev), `idb`

**Files to create:**
- `public/manifest.json`
- `public/icons/` — PWA icon set (generated SVG-based placeholders)
- `src/lib/offline-store.ts` — IndexedDB wrapper for caching
- `src/hooks/useOffline.ts` — Online/offline state, sync queue
- `src/components/OfflineIndicator.tsx` — Status bar
- `src/components/InstallPrompt.tsx` — PWA install banner

**Files to modify:**
- `index.html` — Manifest link, meta tags
- `vite.config.ts` — Add VitePWA plugin
- Data hooks — Add offline fallback pattern
- `src/components/DashboardLayout.tsx` — Add OfflineIndicator
- `src/pages/SettingsPage.tsx` — Offline storage management section

---

### Implementation Order
Tasks will be implemented strictly in order (2→3→4→5→6→7→8→9→10). Each task will be completed fully before moving to the next.

