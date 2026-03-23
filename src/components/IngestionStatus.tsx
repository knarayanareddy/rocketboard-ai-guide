import { Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { useIngestion } from "@/hooks/useIngestion";

export function IngestionStatus() {
  const { jobs, hasActiveJob, cancelIngestion } = useIngestion();

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "processing");
  const recentCompleted = jobs.filter((j) => j.status === "completed").slice(0, 3);
  const recentFailed = jobs.filter((j) => j.status === "failed").slice(0, 2);

  if (!hasActiveJob && recentCompleted.length === 0 && recentFailed.length === 0) return null;

  return (
    <div className="space-y-2">
      {activeJobs.map((job) => {
        const progress = job.total_chunks > 0
          ? Math.min(100, Math.round((job.processed_chunks / job.total_chunks) * 100))
          : 0;

        return (
          <div key={job.id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              {job.status === "processing" ? (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground capitalize">{job.status}</span>
              <button
                onClick={() => cancelIngestion.mutate(job.id)}
                disabled={cancelIngestion.isPending}
                className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-destructive/30 text-destructive/80 hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                {cancelIngestion.isPending ? "Stopping..." : "Stop"}
              </button>
              <span className="text-xs text-muted-foreground ml-auto">
                {Math.min(job.processed_chunks, job.total_chunks)}/{job.total_chunks} chunks
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full gradient-primary transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}

      {recentFailed.map((job) => (
        <div key={job.id} className="flex items-center gap-2 text-xs bg-destructive/10 text-destructive rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Ingestion failed{job.error_message ? `: ${job.error_message}` : ""}</span>
        </div>
      ))}
    </div>
  );
}
