import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useModulePlan, ModulePlanData, DetectedSignal, ModulePlanEntry, PlanTrack } from "@/hooks/useModulePlan";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, Clock, BookOpen, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const confidenceColors: Record<string, string> = {
  high: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-red-500/15 text-red-400 border-red-500/30",
};

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/15 text-red-400 border-red-500/30",
};

function SignalCard({ signal }: { signal: DetectedSignal }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <code className="text-xs font-mono text-primary">{signal.signal_key}</code>
          <Badge variant="outline" className={`text-[10px] ${confidenceColors[signal.confidence] || ""}`}>
            {signal.confidence}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{signal.explanation}</p>
        {signal.citations?.length > 0 && (
          <div className="flex gap-1 mt-2">
            {signal.citations.map((c) => (
              <span key={c.span_id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.span_id}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrackCard({ track }: { track: PlanTrack }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{track.track_key}</Badge>
          <span className="font-medium text-sm text-foreground">{track.title}</span>
        </div>
        <p className="text-sm text-muted-foreground">{track.description}</p>
      </CardContent>
    </Card>
  );
}

function ModuleCard({ mod, index }: { mod: ModulePlanEntry; index: number }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground w-6">{index + 1}.</span>
            <span className="font-medium text-sm text-foreground">{mod.title}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge variant="outline" className={`text-[10px] ${difficultyColors[mod.difficulty] || ""}`}>
              {mod.difficulty}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
              <Clock className="w-2.5 h-2.5 mr-0.5" />
              {mod.estimated_minutes}m
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-2">{mod.description}</p>
        <p className="text-xs text-muted-foreground/70 italic mb-2">{mod.rationale}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {mod.track_key && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              {mod.track_key}
            </Badge>
          )}
          {mod.citations?.map((c) => (
            <span key={c.span_id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.span_id}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlanPage() {
  const { currentPack } = usePack();
  const { hasPackPermission } = useRole();
  const { plan, planLoading, generatePlan, savePlan, approvePlan } = useModulePlan();
  const [livePlan, setLivePlan] = useState<ModulePlanData | null>(null);
  const navigate = useNavigate();

  if (!hasPackPermission("author")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You need author access to view module plans.</p>
        </div>
      </DashboardLayout>
    );
  }

  const displayPlan = livePlan || (plan?.plan_data as ModulePlanData | undefined) || null;
  const isSaved = !!plan && !livePlan;
  const isApproved = plan?.status === "approved" || plan?.status === "generating" || plan?.status === "completed";

  const handleGenerate = async () => {
    try {
      const result = await generatePlan.mutateAsync();
      setLivePlan(result);
      toast.success("Module plan generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate plan");
    }
  };

  const handleSave = async () => {
    if (!livePlan) return;
    try {
      await savePlan.mutateAsync(livePlan);
      setLivePlan(null);
      toast.success("Plan saved as draft");
    } catch (e: any) {
      toast.error(e.message || "Failed to save plan");
    }
  };

  const handleApprove = async () => {
    if (!plan?.id) return;
    try {
      await approvePlan.mutateAsync(plan.id);
      toast.success("Plan approved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to approve plan");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Module Plan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated onboarding plan for <strong>{currentPack?.title || "this pack"}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {displayPlan && livePlan && (
              <Button onClick={handleSave} disabled={savePlan.isPending} variant="outline" size="sm">
                {savePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Draft
              </Button>
            )}
            {isSaved && !isApproved && (
              <Button onClick={handleApprove} disabled={approvePlan.isPending} variant="outline" size="sm">
                {approvePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Approve Plan
              </Button>
            )}
            {isApproved && (
              <Button variant="outline" size="sm" disabled>
                <ArrowRight className="w-4 h-4 mr-1" />
                Generate All Modules (coming soon)
              </Button>
            )}
            <Button onClick={handleGenerate} disabled={generatePlan.isPending} size="sm">
              {generatePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {displayPlan ? "Regenerate Plan" : "Generate Plan"}
            </Button>
          </div>
        </div>

        {/* Status */}
        {plan && !livePlan && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              plan.status === "approved" ? "bg-green-500/15 text-green-400 border-green-500/30" :
              plan.status === "draft" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
              "bg-muted text-muted-foreground border-border"
            }>
              {plan.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Created {new Date(plan.created_at).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Loading */}
        {generatePlan.isPending && (
          <Card className="border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Analyzing evidence spans and planning modules...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">This may take 15-30 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!displayPlan && !generatePlan.isPending && !planLoading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No module plan yet</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Generate an AI-powered plan that analyzes your pack's sources and proposes a structured set of onboarding modules.
              </p>
              <Button onClick={handleGenerate} disabled={generatePlan.isPending}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Module Plan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Plan Results */}
        {displayPlan && !generatePlan.isPending && (
          <>
            {/* Warnings */}
            {displayPlan.warnings?.length > 0 && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">Warnings</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {displayPlan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Detected Signals */}
            {displayPlan.detected_signals?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Detected Signals
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayPlan.detected_signals.map((s) => <SignalCard key={s.signal_key} signal={s} />)}
                </div>
              </div>
            )}

            {/* Proposed Tracks */}
            {displayPlan.tracks?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Proposed Tracks</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayPlan.tracks.map((t) => <TrackCard key={t.track_key} track={t} />)}
                </div>
              </div>
            )}

            {/* Module Plan */}
            {displayPlan.module_plan?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Module Plan ({displayPlan.module_plan.length} modules)
                </h2>
                <div className="space-y-3">
                  {displayPlan.module_plan.map((mod, i) => <ModuleCard key={mod.module_key} mod={mod} index={i} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
