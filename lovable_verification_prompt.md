# Lovable Task: Verify Ingestion Stability and Monitor Runtime Limits

## Context
We have recently implemented granular phase tracking and ingestion stabilization logic in `ingest-source/index.ts`. We have also added a migration `20260427010000_ingestion_phase_tracking.sql` to track the following phases: `fetch_tree`, `fetch_files`, `chunking`, `upsert_chunks`, `build_symbol_graph`, `atomic_swap`, `completed`.

## Objective
Confirm whether the ingestion pipeline is now reaching completion or if it is still stalling due to Supabase Edge runtime limits (CPU, Memory, or Wall Clock time).

## Steps to Execute

### 1. Finalize Deployment
- Apply the migration: `supabase/migrations/20260427010000_ingestion_phase_tracking.sql`.
- Deploy the updated edge function: `supabase/functions/ingest-source/index.ts`.

### 2. Trigger Ingestion Run
- In the RocketBoard Sources tab, trigger a fresh "Re-Sync" for the affected GitHub repository.

### 3. Monitor Logs for Runtime Limits
- Go to the Supabase Dashboard -> Functions -> `ingest-source` -> Logs.
- Search for the following error strings to determine if the isolate is being terminated prematurely:
  - `CPU Time exceeded`
  - `WORKER_LIMIT`
  - `546` (Deno exit code for OOM or limits)
  - `Shutdown`
  - `Memory limit exceeded`
  - `wall clock time limit reached`

### 4. Direct Database Correlation
- Run the following SQL to find the `jobId` and its current status:
  ```sql
  SELECT id, status, phase, current_file, current_file_index, elapsed_ms, last_heartbeat_at
  FROM public.ingestion_jobs
  ORDER BY created_at DESC
  LIMIT 5;
  ```
- Correlate any "CPU Time exceeded" log entries with the specific `jobId`.

## Deliverables
1. **Log Snippet**: Extract the exact log lines around any failure (ensure IDs are redacted if necessary).
2. **Diagnosis**: Determine if the isolate terminated (CPU/Memory/Wall Clock) and identify the exact `phase` where it stalled (e.g., `chunking`, `upsert_chunks`).
3. **Success Report**: If the job completes (`status='completed'`), provide the final `elapsed_ms` and ensure `pack_active_generation` was updated to the new `jobId`.
