import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useGeneratedModules, GeneratedModuleRow, GeneratedModuleData, ChangeLogEntry } from "@/hooks/useGeneratedModules";
import { useGeneratedGlossary } from "@/hooks/useGeneratedGlossary";
import { useGeneratedPaths } from "@/hooks/useGeneratedPaths";
import { useGeneratedAskLead } from "@/hooks/useGeneratedAskLead";
import { useModulePlan } from "@/hooks/useModulePlan";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { AIError } from "@/lib/ai-errors";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BookOpen, Sparkles, Eye, Pencil, RotateCcw, Rocket, AlertTriangle,
  CheckCircle2, Loader2, BookText, Route, MessageSquareMore, Users, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";

const statusColor: Record<string, string> = {
  draft: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  published: "bg-green-500/15 text-green-400 border-green-500/30",
};
const difficultyColor: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/15 text-red-400 border-red-500/30",
};

function ModuleReviewCard({ mod, onPreview, onRefine, onRegenerate, quizCount }: {
  mod: GeneratedModuleRow;
  onPreview: () => void;
  onRefine: () => void;
  onRegenerate: () => void;
  quizCount: number;
}) {
  const sectionCount = (mod.module_data as any)?.sections?.length || 0;
  const contradictions = Array.isArray(mod.contradictions) ? mod.contradictions.length : 0;

  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/20 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-foreground text-sm">{mod.title}</h3>
          </div>
          <Badge variant="outline" className={`text-[10px] ${statusColor[mod.status] || ""}`}>
            {mod.status}
          </Badge>
          {mod.status === "draft" && <HelpTooltip content={HELP_TOOLTIPS.generation.draftStatus} />}
        </div>

        <div className="flex flex-wrap gap-2 mb-3 text-xs text-muted-foreground">
          <span>{sectionCount} sections</span>
          <span>•</span>
          <span>Quiz: {quizCount} Qs</span>
          {mod.difficulty && (
            <>
              <span>•</span>
              <Badge variant="outline" className={`text-[10px] ${difficultyColor[mod.difficulty] || ""}`}>
                {mod.difficulty}
              </Badge>
            </>
          )}
          {mod.estimated_minutes && <><span>•</span><span>~{mod.estimated_minutes} min</span></>}
          {mod.track_key && <><span>•</span><span className="text-primary">{mod.track_key}</span></>}
        </div>

        {contradictions > 0 && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-yellow-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{contradictions} contradiction(s)</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onPreview} data-tour="preview-button">
            <Eye className="w-3 h-3" /> Preview
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onRefine} data-tour="refine-button">
            <Pencil className="w-3 h-3" /> Refine
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <RotateCcw className="w-3 h-3" /> Regenerate
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate "{mod.title}"?</AlertDialogTitle>
                <AlertDialogDescription>This will completely regenerate the module content. The current draft will be replaced.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRegenerate}>Regenerate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReviewPage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { currentPack, currentPackId } = usePack();
  const { hasPackPermission } = useRole();
  const queryClient = useQueryClient();
  const { modules: allModules, generateModule, refineModule } = useGeneratedModules();
  const { glossary } = useGeneratedGlossary();
  const { paths } = useGeneratedPaths();
  const { askLead } = useGeneratedAskLead();
  const { plan, approvePlan } = useModulePlan();

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [refineTarget, setRefineTarget] = useState<GeneratedModuleRow | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [refineError, setRefineError] = useState<AIError | null>(null);
  const [regenError, setRegenError] = useState<AIError | null>(null);

  if (!hasPackPermission("author")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Author access required.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Separate draft and published modules
  const draftModules = allModules.filter(m => m.status === "draft");
  const publishedModules = allModules.filter(m => m.status === "published");
  const hasUnpublished = draftModules.length > 0;

  const glossaryTerms = Array.isArray(glossary?.glossary_data) ? glossary.glossary_data.length : 0;
  const pathSteps = paths?.paths_data
    ? ((paths.paths_data as any).day1?.length || 0) + ((paths.paths_data as any).week1?.length || 0)
    : 0;
  const askLeadQs = Array.isArray(askLead?.questions_data) ? askLead.questions_data.length : 0;

  const handlePublish = async () => {
    if (!currentPackId) return;
    setPublishing(true);
    try {
      // Update all draft modules to published
      const { error } = await supabase
        .from("generated_modules")
        .update({ status: "published" })
        .eq("pack_id", currentPackId)
        .eq("status", "draft");
      if (error) throw error;

      // Update plan status to completed
      if (plan?.id) {
        await supabase.from("module_plans").update({ status: "completed" }).eq("id", plan.id);
      }

      queryClient.invalidateQueries({ queryKey: ["generated_modules", currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["module_plan", currentPackId] });
      setPublished(true);
      toast.success("Pack published! Learners can now access the content.");
    } catch (e: any) {
      toast.error(e.message || "Failed to publish");
    }
    setPublishing(false);
  };

  const handleRefine = async () => {
    if (!refineTarget) return;
    setRefining(true);
    setRefineError(null);
    try {
      const moduleData = refineTarget.module_data as unknown as GeneratedModuleData;
      const result = await refineModule.mutateAsync({
        moduleKey: refineTarget.module_key,
        authorInstruction: refineInstruction,
        existingModuleData: moduleData,
        currentRevision: refineTarget.module_revision,
        trackKey: refineTarget.track_key,
      });
      setChangeLog(result.changeLog);
      setRefineTarget(null);
      setRefineInstruction("");
      toast.success(`Module refined to Rev. ${result.row.module_revision}`);
    } catch (e: any) {
      if (e instanceof AIError) {
        setRefineError(e);
      } else {
        toast.error(e.message);
      }
    }
    setRefining(false);
  };

  const handleRegenerate = async (mod: GeneratedModuleRow) => {
    setRegenError(null);
    try {
      await generateModule.mutateAsync({
        moduleKey: mod.module_key,
        title: mod.title,
        description: mod.description || undefined,
        trackKey: mod.track_key,
        difficulty: mod.difficulty || undefined,
        estimatedMinutes: mod.estimated_minutes || undefined,
      });
      toast.success(`Regenerated: ${mod.title}`);
    } catch (e: any) {
      if (e instanceof AIError) {
        setRegenError(e);
      } else {
        toast.error(e.message);
      }
    }
  };

  // Published success state
  if (published) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}>
            <Rocket className="w-16 h-16 text-primary mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-foreground mb-3">🚀 Your pack is live!</h1>
            <p className="text-muted-foreground mb-8">Learners can now start onboarding with your generated content.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => navigate(`/packs/${currentPackId}`)} className="gap-2">
                <Eye className="w-4 h-4" /> View as Learner
              </Button>
              <Button variant="outline" onClick={() => navigate(`/packs/${currentPackId}/members`)} className="gap-2">
                <Users className="w-4 h-4" /> Invite Team Members
              </Button>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  const allModulesForReview = [...draftModules, ...publishedModules];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-tour="review-heading">📋 Content Review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {hasUnpublished
                ? `${draftModules.length} draft module(s) ready for review.`
                : "All content published. You can still refine and update."}
            </p>
          </div>
          {hasUnpublished && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div data-tour="publish-button" className="inline-block">
                  <Button className="gap-2 gradient-primary text-primary-foreground border-0" disabled={publishing}>
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Publish Pack
                  </Button>
                </div>
              </AlertDialogTrigger>
              <HelpTooltip content={HELP_TOOLTIPS.generation.publishPack} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish Pack</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>Publishing will make all content available to learners.</p>
                      <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                        <p>• {draftModules.length} modules (with quizzes)</p>
                        {glossaryTerms > 0 && <p>• {glossaryTerms} glossary terms</p>}
                        {pathSteps > 0 && <p>• {pathSteps} path steps (Day 1 + Week 1)</p>}
                        {askLeadQs > 0 && <p>• {askLeadQs} ask-lead questions</p>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Learners will see this content immediately. You can continue to refine after publishing.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handlePublish}>Publish →</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Published modules with unpublished changes */}
        {publishedModules.length > 0 && hasUnpublished && (
          <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{draftModules.length} module(s) have unpublished changes</span>
          </div>
        )}

        {/* Module Review */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Modules ({allModulesForReview.length})
          </h2>
          <div className="space-y-3" data-tour="review-module-card">
            {allModulesForReview.map(mod => (
              <ModuleReviewCard
                key={mod.id}
                mod={mod}
                quizCount={0} // Will be enriched later
                onPreview={() => navigate(`/packs/${currentPackId}/modules/${mod.module_key}?preview=1`)}
                onRefine={() => { setRefineTarget(mod); setRefineInstruction(""); setChangeLog([]); setRefineError(null); }}
                onRegenerate={() => handleRegenerate(mod)}
              />
            ))}

            {/* Regenerate error */}
            {regenError && (
              <AIErrorDisplay error={regenError} onRetry={() => {
                if (allModulesForReview.length > 0) handleRegenerate(allModulesForReview[0]);
              }} />
            )}
          </div>
        </div>

        {/* Supporting Content */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Supporting Content</h2>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookText className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Glossary: {glossaryTerms} terms</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate(`/packs/${currentPackId}/glossary`)}>
                    Preview
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Paths: {pathSteps} steps</span>
                </div>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate(`/packs/${currentPackId}/paths`)}>
                  Preview
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquareMore className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Ask-Lead: {askLeadQs} questions</span>
                </div>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate(`/packs/${currentPackId}/ask-lead`)}>
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Change log from last refine */}
        {changeLog.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Last Refinement Changes
              </h3>
              <ul className="space-y-2">
                {changeLog.map((entry, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-foreground">{entry.change}</span>
                    <span className="text-muted-foreground ml-2">— {entry.reason}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Refine Sheet */}
      <Sheet open={!!refineTarget} onOpenChange={(open) => { if (!open) setRefineTarget(null); }}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Refine: {refineTarget?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">Describe what you'd like to change about this module.</p>
            <Textarea
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              placeholder="e.g., Add more detail about the deployment process, simplify the introduction..."
              rows={5}
            />
            <Button onClick={handleRefine} disabled={refining || !refineInstruction.trim()} className="w-full gap-2">
              {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              {refining ? "Refining..." : "Refine Module"}
            </Button>
            {refineError && (
              <AIErrorDisplay error={refineError} onRetry={handleRefine} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
