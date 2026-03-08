

## Phase 3: Inline Plan Editing & Curation

### Overview
Transform the read-only PlanPage into an interactive plan editor with inline editing, drag-and-drop reordering, add/remove modules, per-module track and template assignment, and save/approve workflow.

### New Dependency
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for drag-and-drop reordering

### No Database Changes Required
All editing happens in local state (`livePlan`). The existing `savePlan` and `approvePlan` mutations already persist to `module_plans`. The `ModulePlanEntry` interface gets an optional `template_id` field added in the TypeScript type only.

### File Changes

**1. `src/hooks/useModulePlan.ts`**
- Add optional `template_id?: string` to `ModulePlanEntry` interface
- Add an `updatePlan` mutation that updates an existing `module_plans` row's `plan_data` (for "Save Draft" on an already-saved plan, vs inserting a new one)

**2. `src/pages/PlanPage.tsx` — Full rewrite of the plan display section**

Replace the static `PlanModuleCard` and module list with an interactive editor:

- **State management**: `livePlan` becomes the single editable copy. When plan loads from DB, initialize `livePlan` from it. Track `isDirty` by comparing to saved version.

- **Inline editing** (`EditablePlanModuleCard` component):
  - Title: renders as text; click transforms to `<Input>`, blur/Enter commits to `livePlan` state
  - Description: same pattern with `<Textarea>`
  - Difficulty badge: click opens a small `<Select>` dropdown (beginner/intermediate/advanced)
  - Estimated minutes: click opens `<Input type="number">`
  - Track dropdown: `<Select>` with pack tracks from `usePackTracks()` + "No track"
  - Template dropdown: `<Select>` with templates from `useTemplates()` + "No template"; shows template title as chip when assigned
  - Remove button (X) top-right: shows confirmation via `AlertDialog`, removes from array, shows undo toast with 5s timeout
  - Drag handle: `GripVertical` icon on the left, wired to `@dnd-kit/sortable`
  - Visual cues: dashed borders on hover for editable fields, pencil icon

- **Drag-and-drop** (`@dnd-kit`):
  - Wrap module list in `DndContext` + `SortableContext` (vertical list strategy)
  - Each card uses `useSortable` hook, drag handle via `listeners` on the grip icon
  - `onDragEnd` reorders the `livePlan.module_plan` array

- **Add Module**:
  - Button below the list opens an inline collapsible form (not a modal)
  - Fields: title (required), description (required), difficulty select, estimated minutes, track select
  - On submit: generates `module_key` as `mod-custom-${Date.now()}`, appends to `livePlan.module_plan`

- **Save / Approve actions** (header bar):
  - "Save Draft": if plan exists in DB, update its `plan_data`; if new, insert. Clears dirty state.
  - "Approve Plan": saves first, then sets status to `approved`
  - "Regenerate Plan": if dirty, shows `AlertDialog` with Cancel / Save & Regenerate / Discard & Regenerate options

- **Disabled editing when approved**: If plan status is `approved`/`generating`/`completed`, all inline editing is disabled. Cards revert to read-only display.

**3. Component structure** (all within `PlanPage.tsx` or extracted to a small helper):

```text
PlanPage
├── Header (title, Save Draft, Approve, Regenerate buttons)
├── CascadeProgress (existing, unchanged)
├── Warnings card (existing)
├── Signals section (existing)
├── Tracks section (existing)
└── Module Plan section
    ├── DndContext + SortableContext
    │   └── EditablePlanModuleCard[] (sortable, inline-editable)
    ├── AddModuleForm (collapsible inline form)
    └── "Add Module" button
```

### Key Behaviors
- All edits are local until "Save Draft" is clicked
- Undo on remove: store removed module + index, restore on undo within 5s
- The `livePlan` state initializes from DB plan data when it loads (or from fresh AI generation)
- Per-module `template_id` is passed through to `useCascadeGeneration` when generating (existing `buildGenerateModuleEnvelope` already accepts template data)
- Pack tracks fetched via existing `usePackTracks()` hook
- Templates fetched via existing `useTemplates()` hook

### Estimated scope
- ~1 new dependency install (`@dnd-kit/*`)
- ~2 files modified (`useModulePlan.ts`, `PlanPage.tsx`)
- PlanPage grows significantly but stays as one file with extracted sub-components

