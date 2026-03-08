

## AI Chat Panel for Module Content

### Overview
Add a floating chat panel on each module page where learners can ask questions about the current module's content. The AI will have full context of the module's sections, key takeaways, and learning objectives.

### Architecture

```text
┌─────────────────────────────────────┐
│  ModuleView (existing)              │
│  ┌───────────────────────────────┐  │
│  │ Content / Quiz tabs           │  │
│  └───────────────────────────────┘  │
│                                     │
│              [💬 Ask AI] ← FAB btn  │
│              ┌──────────────┐       │
│              │ Chat Sheet   │       │
│              │ (slide-up)   │       │
│              │ streaming AI │       │
│              └──────────────┘       │
└─────────────────────────────────────┘

Client ──POST──► Edge Function (chat) ──► Lovable AI Gateway
                 (injects module content as system prompt)
```

### Implementation Steps

**1. Edge Function: `supabase/functions/module-chat/index.ts`**
- Accepts `{ messages, moduleContext }` where `moduleContext` contains module title, sections content, key takeaways
- Builds a system prompt: "You are a helpful onboarding assistant. Answer questions based on the following module content: ..."
- Streams response from Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Handles 429/402 errors gracefully
- Update `supabase/config.toml` with `verify_jwt = false` for this function

**2. Component: `src/components/ModuleChatPanel.tsx`**
- Sheet/drawer that slides up from a floating action button
- Message list with user/assistant bubbles, rendered with markdown
- Input bar at the bottom with send button
- Streaming token-by-token display for assistant responses
- Loading indicator while streaming
- Module context passed as prop (title + sections content)

**3. Integration in `ModuleView.tsx`**
- Add the `ModuleChatPanel` component, passing the current module data
- Floating button fixed at bottom-right of the module view

**4. Dependencies**
- Add `react-markdown` for rendering AI responses with proper formatting

### Technical Details

- The system prompt will include all section titles and content from the current module so the AI can answer contextually
- Conversation is ephemeral (in-memory state only, no database persistence) to keep it simple
- SSE streaming with line-by-line parsing per the gateway best practices
- LOVABLE_API_KEY is already available as a secret

