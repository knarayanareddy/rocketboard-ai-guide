# QA Regression Plan: Citation Stability & Evidence UX

## Overview
This document outlines the regression testing strategy to ensure citation badges reliably load evidence previews and modals, supporting both UUID (primary key) and TEXT (stable chunk_id) identifiers.

## 1. Manual Regression Checklist

### Prerequisites
-   Local Supabase running: `supabase start`
-   Migrations applied: `supabase db reset`
-   Frontend running: `npm run dev`

### Test Case 1: Standard Citation Flow
1.  **Action**: Open a module chat and ask a question that yields results from the knowledge base.
2.  **Verify (Badge)**: Citation badge `[S1]` appears in the response.
3.  **Verify (Hover)**: Hover over `[S1]`. The preview tooltip should show code/text content immediately (no infinite spinner).
4.  **Verify (Modal)**: Click `[S1]`. The evidence modal should open, showing the full file content with line highlighting.
5.  **Verify (Original Link)**: Click "View Original" in the modal; it should open the source provider (e.g., GitHub, Notion) if a source link is available.

### Test Case 2: Multi-Source Path Normalization
1.  **Action**: In a cross-repo Pack, ask a question that returns results from multiple sources.
2.  **Verify**: The evidence modal title/breadcrumbs should be prefixed with the source slug (e.g., `rocketboard/src/main.ts`).

## 2. Negative & Edge Cases

### Case 3: UUID Identifier Fallback
*Note: This simulates the scenario where a search RPC returns a row UUID but no stable chunk_id.*
1.  **Setup**: Force a UUID into the UI by intercepting the `retrieve-spans` network response or by manually triggering a citation with a known UUID.
2.  **Action**: Click the badge.
3.  **Verify**: The UI should correctly resolve the UUID to the row `id` and load content successfully in [useEvidenceSpanContent.ts](file:///c:/first%20commit/rocketboard-ai-guide/src/hooks/useEvidenceSpanContent.ts).

### Case 4: Missing Content Graceful Failure
1.  **Action**: Click a citation badge where the underlying chunk has been deleted or is inaccessible.
2.  **Verify**: The UI should show a clear "Content missing" or "Error loading evidence" message instead of a permanent loading spinner.

## 3. Automated Testing

### Unit Testing
A unit test has been added to verify the `isUuidLike` regex used for identifer switching.

**Test File**: `src/hooks/useEvidenceSpanContent.test.ts` (or equivalent)
**Test Command**: `npm test src/hooks/useEvidenceSpanContent.test.ts`

### E2E Smoke Flow (Playwright/Cypress)
If E2E tooling is enabled, add the following flow:
```javascript
test('citation modal loads content', async ({ page }) => {
  await page.goto('/pack/test-pack/chat');
  await page.fill('textarea', 'how do I setup auth?');
  await page.keyboard.press('Enter');
  
  // Wait for citation and click
  const badge = page.locator('button:has-text("[S1]")').first();
  await badge.click();
  
  // Assert modal content
  await expect(page.locator('role=dialog')).toBeVisible();
  await expect(page.locator('pre code')).not.toBeEmpty();
});
```

---
**Last Updated**: 2026-03-26
**Owner**: RocketBoard QA Team
