import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { modules as staticModules } from "@/data/onboarding-data";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionViewer } from "@/components/SectionViewer";
import { QuizRunner } from "@/components/QuizRunner";
import { TrackBadge } from "@/components/TrackBadge";
import { ProtectedAction } from "@/components/ProtectedAction";
import { CitationBadge } from "@/components/CitationBadge";
import { NotesPanel } from "@/components/NotesPanel";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { ArrowLeft, Filter, BookOpen, BrainCircuit, Lightbulb, Star, Lock, Sparkles, ChevronDown, ChevronUp, RotateCcw, Loader2, Pencil, History, FileText, Wand2, Eye, EyeOff, AlertTriangle, Info, GitBranch } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProgress } from "@/hooks/useProgress";
import { useNotes } from "@/hooks/useNotes";
import { useLearnerState } from "@/hooks/useLearnerState";
import { useRole } from "@/hooks/useRole";
import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";
import { usePackTracks } from "@/hooks/usePackTracks";
import { ModuleChatPanel } from "@/components/ModuleChatPanel";
import { useGeneratedModules, GeneratedModuleRow, GeneratedSection, ChangeLogEntry } from "@/hooks/useGeneratedModules";
import { useGeneratedQuiz } from "@/hooks/useGeneratedQuiz";
import { useSimplifySection, SimplifiedSection } from "@/hooks/useSimplifySection";
import { usePack } from "@/hooks/usePack";
import { AIError } from "@/lib/ai-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { toast } from "sonner";
import { ContradictionCallout } from "@/components/ContradictionCallout";
import { GenerationStats, buildModuleStats } from "@/components/GenerationStats";
import { getEffectiveLimits } from "@/lib/limits";
import { useGenerationPrefs } from "@/hooks/useGenerationPrefs";
import { validateAIOutput } from "@/lib/schema-validator";
import { validateCitations } from "@/lib/citation-validator";

function GeneratedSectionViewer({ section, index, isRead, onMarkRead, savedNote, onSaveNote, onDeleteNote, moduleKey, trackKey }: {
  section: GeneratedSection;
  index: number;
  isRead: boolean;
  onMarkRead?: () => void;
  savedNote?: string;
  onSaveNote?: (content: string) => void;
  onDeleteNote?: () => void;
  moduleKey?: string;
  trackKey?: string | null;
}) {
  const { simplifySection, getCachedSimplification } = useSimplifySection();
  const [showSimplified, setShowSimplified] = useState(false);
  const [simplified, setSimplified] = useState<SimplifiedSection | undefined>(
    moduleKey ? getCachedSimplification(moduleKey, section.section_id) : undefined
  );
  const [simplifyError, setSimplifyError] = useState<AIError | null>(null);

  const handleSimplify = () => {
    if (simplified) {
      setShowSimplified(!showSimplified);
      return;
    }
    if (!moduleKey) return;
    setSimplifyError(null);
    simplifySection.mutate(
      {
        moduleKey,
        sectionId: section.section_id,
        originalMarkdown: section.markdown,
        trackKey,
      },
      {
        onSuccess: (result) => {
          setSimplified(result);
          setShowSimplified(true);
        },
        onError: (e) => {
          if (e instanceof AIError) {
            setSimplifyError(e);
          } else {
            toast.error(e.message);
          }
        },
      }
    );
  };

  const isSimplifying = simplifySection.isPending;
  const displayMarkdown = showSimplified && simplified ? simplified.simplified_markdown : section.markdown;
  const displayCitations = showSimplified && simplified ? simplified.citations : section.citations;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={`border rounded-xl p-6 transition-all duration-300 ${
        isRead ? "bg-card/50 border-primary/20" : "bg-card border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">§{index + 1}</span>
          <h3 className="font-semibold text-card-foreground">{section.heading}</h3>
          {section.markdown && /```mermaid/.test(section.markdown) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Contains diagram</TooltipContent>
            </Tooltip>
          )}
          {showSimplified && (
            <Badge variant="outline" className="text-[10px] bg-accent/50 text-accent-foreground border-accent">
              <Wand2 className="w-2.5 h-2.5 mr-0.5" /> Simplified
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {moduleKey && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSimplify}
                  disabled={isSimplifying}
                  className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full transition-all ${
                    showSimplified
                      ? "bg-accent/20 text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent-foreground"
                  }`}
                >
                  {isSimplifying ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : showSimplified ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {isSimplifying ? "Simplifying..." : showSimplified ? "Original" : "Simplify"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                {showSimplified
                  ? "Switch back to the original version"
                  : "Get a simplified version adapted to your audience profile"}
              </TooltipContent>
            </Tooltip>
          )}
          {onMarkRead && (
            <button
              onClick={onMarkRead}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                isRead ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isRead ? "Read" : "Mark as read"}
            </button>
          )}
        </div>
      </div>

      {section.learning_objectives && section.learning_objectives.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {section.learning_objectives.map((obj, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
              🎯 {obj}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={showSimplified ? "simplified" : "original"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground leading-relaxed [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>pre]:my-2"
        >
          <ReactMarkdown>{displayMarkdown}</ReactMarkdown>
        </motion.div>
      </AnimatePresence>

      {/* Simplify error */}
      {simplifyError && (
        <div className="mt-3">
          <AIErrorDisplay error={simplifyError} compact onRetry={handleSimplify} />
        </div>
      )}

      {displayCitations && displayCitations.length > 0 && (() => {
        const citationValidation = validateCitations(displayCitations, []);
        const citationMap = new Map(citationValidation.citations.map(c => [c.spanId, c]));
        return (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/50">
            {displayCitations.map((c) => {
              const v = citationMap.get(c.span_id);
              return (
                <CitationBadge
                  key={c.span_id}
                  spanId={c.span_id}
                  path={c.path}
                  chunkId={c.chunk_id}
                  verified={v ? v.valid : undefined}
                  verificationWarning={v?.warnings?.[0]}
                />
              );
            })}
          </div>
        );
      })()}

      {onSaveNote && onDeleteNote && (
        <NotesPanel
          sectionId={section.section_id}
          notePrompts={section.note_prompts}
          savedNote={savedNote || ""}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
        />
      )}
    </motion.div>
  );
}

function StaticTrackFilter({ activeTrack, setActiveTrack }: { activeTrack: string; setActiveTrack: (t: string) => void }) {
  const { tracks: packTracks } = usePackTracks();
  if (packTracks.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <Filter className="w-4 h-4 text-muted-foreground" />
      <button
        onClick={() => setActiveTrack("all")}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          activeTrack === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent hover:border-border"
        }`}
      >
        All Tracks
      </button>
      {packTracks.map((t) => (
        <button key={t.track_key} onClick={() => setActiveTrack(t.track_key)} className={`transition-opacity ${activeTrack !== "all" && activeTrack !== t.track_key ? "opacity-40" : ""}`}>
          <TrackBadge track={t.track_key} title={t.title} />
        </button>
      ))}
    </div>
  );
}

function AudienceMismatchBanner({ moduleAudience, moduleDepth }: { moduleAudience?: string | null; moduleDepth?: string | null }) {
  const { audience, depth } = useAudiencePrefs();
  if (!moduleAudience && !moduleDepth) return null;
  const audienceMismatch = moduleAudience && moduleAudience !== audience;
  const depthMismatch = moduleDepth && moduleDepth !== depth;
  if (!audienceMismatch && !depthMismatch) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mb-4 bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-start gap-3"
    >
      <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="text-foreground font-medium">Content may not match your preferences</p>
        <p className="text-muted-foreground text-xs mt-1">
          This module was generated for{" "}
          {moduleAudience && <span className="font-medium">{moduleAudience}</span>}
          {moduleAudience && moduleDepth && " / "}
          {moduleDepth && <span className="font-medium">{moduleDepth}</span>}
          {" "}audience. Your preference is{" "}
          <span className="font-medium">{audience}</span> / <span className="font-medium">{depth}</span>.
          Use the <Wand2 className="w-3 h-3 inline" /> Simplify button on each section to adapt it.
        </p>
      </div>
    </motion.div>
  );
}

export default function ModuleView() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { currentPackId } = usePack();

  const staticMod = staticModules.find((m) => m.id === moduleId);

  const { fetchModule, fetchRevisionHistory, refineModule } = useGeneratedModules();
  const { data: generatedMod, isLoading: genLoading } = fetchModule(moduleId || "");
  const { data: revisionHistory } = fetchRevisionHistory(moduleId || "");

  const isGenerated = !!generatedMod;
  const moduleData = generatedMod?.module_data;

  const { quiz: generatedQuiz, quizLoading, generateQuiz } = useGeneratedQuiz(moduleId || "");

  const { getReadSectionsForModule, toggleSection, saveQuizScore, getModuleProgress } = useProgress();
  const { getNoteForSection, saveNote, deleteNote } = useNotes(moduleId || "");
  const { updateLastOpened } = useLearnerState();
  const { hasPackPermission } = useRole();
  const { packLimits } = useGenerationPrefs();
  const effectiveLimits = getEffectiveLimits({ max_module_words: packLimits.maxModuleWords, max_quiz_questions: packLimits.maxQuizQuestions, max_key_takeaways: packLimits.maxKeyTakeaways });

  const [activeTrack, setActiveTrack] = useState<string>("all");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [changeLogOpen, setChangeLogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (moduleId) updateLastOpened.mutate({ moduleId });
  }, [moduleId]);

  const readSections = getReadSectionsForModule(moduleId || "");

  const totalSections = isGenerated
    ? (moduleData?.sections?.length || 0)
    : (staticMod?.sections?.length || 0);

  const filteredStaticSections = useMemo(() => {
    if (!staticMod) return [];
    if (activeTrack === "all") return staticMod.sections;
    return staticMod.sections.filter((s) => s.tracks.includes(activeTrack as any));
  }, [staticMod, activeTrack]);

  if (!staticMod && !genLoading && !generatedMod) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Module not found.</div>
      </DashboardLayout>
    );
  }

  if (genLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading module...</div>
      </DashboardLayout>
    );
  }

  const canInteract = hasPackPermission("learner");

  const handleToggleRead = (sectionId: string) => {
    if (!canInteract || !moduleId) return;
    toggleSection.mutate({ moduleId, sectionId });
  };

  const handleQuizComplete = (score: number) => {
    if (!canInteract || !moduleId) return;
    const quizLen = generatedQuiz?.quiz_data?.questions?.length || staticMod?.quiz?.length || 0;
    if (quizLen > 0) saveQuizScore.mutate({ moduleId, score, total: quizLen });
  };

  const handleGenerateQuiz = () => {
    if (!moduleId) return;
    generateQuiz.mutate(
      { moduleData: moduleData || undefined, trackKey: moduleData?.track_key },
      { onSuccess: () => toast.success("Quiz generated!"), onError: (e) => toast.error(e.message) }
    );
  };

  const handleRefine = () => {
    if (!moduleId || !moduleData || !generatedMod) return;
    refineModule.mutate(
      {
        moduleKey: moduleId,
        authorInstruction: refineInstruction,
        existingModuleData: moduleData,
        currentRevision: generatedMod.module_revision,
        trackKey: moduleData.track_key,
      },
      {
        onSuccess: (result) => {
          setRefineOpen(false);
          setRefineInstruction("");
          setChangeLog(result.changeLog);
          setChangeLogOpen(true);
          toast.success(`Module refined to Rev. ${result.row.module_revision}`);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const title = isGenerated ? moduleData!.title : staticMod!.title;
  const description = isGenerated ? moduleData!.description : staticMod!.description;
  const difficulty = isGenerated ? moduleData!.difficulty : staticMod!.difficulty;
  const keyTakeaways = isGenerated ? (moduleData!.key_takeaways || []) : staticMod!.key_takeaways;
  const progress = getModuleProgress(moduleId || "");

  const difficultyColor: Record<string, string> = {
    beginner: "text-green-500 bg-green-500/10",
    intermediate: "text-yellow-500 bg-yellow-500/10",
    advanced: "text-red-500 bg-red-500/10",
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate(`/packs/${currentPackId}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>

          <div className="flex items-start gap-4 mb-2">
            {!isGenerated && staticMod && <span className="text-4xl">{staticMod.icon}</span>}
            {isGenerated && (
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                {difficulty && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyColor[difficulty] || ""}`}>
                    {difficulty}
                  </span>
                )}
                {isGenerated && (
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Generated
                  </Badge>
                )}
                {isGenerated && generatedMod && (
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                    Rev. {generatedMod.module_revision}
                  </Badge>
                )}
                {!canInteract && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Read Only
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{description}</p>

              {/* Author actions for generated modules */}
              {isGenerated && hasPackPermission("author") && (
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => setRefineOpen(true)}>
                    <Pencil className="w-3 h-3" /> Refine Module
                  </Button>
                  {(revisionHistory?.length || 0) > 1 && (
                    <Button size="sm" variant="ghost" className="gap-2 text-xs" onClick={() => setHistoryOpen(true)}>
                      <History className="w-3 h-3" /> {revisionHistory?.length} Revisions
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Key Takeaways */}
          {keyTakeaways.length > 0 && (
            <div className="mt-4 bg-primary/5 border border-primary/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Key Takeaways</span>
              </div>
              <ul className="space-y-1">
                {keyTakeaways.map((t, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground">
                {readSections.size}/{totalSections} sections read
              </span>
              <span className="text-xs font-mono text-primary">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </motion.div>

        {/* Generated module content */}
        {isGenerated && moduleData ? (
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="bg-muted border border-border mb-6">
              <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-card">
                <BookOpen className="w-4 h-4" /> Content
              </TabsTrigger>
              <TabsTrigger value="quiz" className="gap-2 data-[state=active]:bg-card" disabled={!canInteract}>
                <BrainCircuit className="w-4 h-4" /> Quiz
                {!canInteract && <Lock className="w-3 h-3 ml-1" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              {/* Audience mismatch banner */}
              <AudienceMismatchBanner moduleAudience={moduleData?.audience} moduleDepth={moduleData?.depth} />
              {/* Contradictions callout */}
              {generatedMod?.contradictions && generatedMod.contradictions.length > 0 && (
                <div className="space-y-3 mb-6">
                  {generatedMod.contradictions.map((c: any, i: number) => (
                    <ContradictionCallout key={i} contradiction={c} index={i} />
                  ))}
                </div>
              )}
              <div className="space-y-4">
                {moduleData.sections.map((section, i) => (
                  <GeneratedSectionViewer
                    key={section.section_id}
                    section={section}
                    index={i}
                    isRead={readSections.has(section.section_id)}
                    onMarkRead={canInteract ? () => handleToggleRead(section.section_id) : undefined}
                    savedNote={getNoteForSection(section.section_id)}
                    onSaveNote={canInteract ? (content) => saveNote.mutate({ sectionId: section.section_id, content }) : undefined}
                    onDeleteNote={canInteract ? () => deleteNote.mutate({ sectionId: section.section_id }) : undefined}
                    moduleKey={moduleId}
                    trackKey={moduleData.track_key}
                  />
                ))}

                {/* Endcap */}
                {readSections.size === moduleData.sections.length && moduleData.endcap && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 bg-card border border-primary/20 rounded-xl p-6"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Module Complete — Reflection</h3>
                    </div>

                    {moduleData.endcap.reflection_prompts?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reflect on what you learned:</p>
                        <ol className="space-y-2 list-decimal list-inside">
                          {moduleData.endcap.reflection_prompts.map((p, i) => (
                            <li key={i} className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">💭 {p}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="border-t border-border pt-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none mb-3">
                        <ReactMarkdown>{moduleData.endcap.ready_for_quiz_markdown || "You're ready for the quiz!"}</ReactMarkdown>
                      </div>
                      {moduleData.endcap.quiz_objectives?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {moduleData.endcap.quiz_objectives.map((obj, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">📝 {obj}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Evidence Index */}
                {moduleData.evidence_index && moduleData.evidence_index.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => setEvidenceOpen(!evidenceOpen)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {evidenceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Sources ({moduleData.evidence_index.length} topics)
                    </button>
                    {evidenceOpen && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-2">
                        {moduleData.evidence_index.map((entry, i) => (
                          <div key={i} className="bg-muted/50 rounded-lg p-3">
                            <span className="text-xs font-medium text-foreground">{entry.topic}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {entry.citations.map((c) => (
                                <CitationBadge key={c.span_id} spanId={c.span_id} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Generation Stats (author+ only) */}
                {isGenerated && hasPackPermission("author") && moduleData && (
                  <GenerationStats
                    stats={buildModuleStats(
                      moduleData,
                      generatedQuiz?.quiz_data?.questions?.length || 0,
                      effectiveLimits,
                    )}
                    validationResult={(() => {
                      const raw = generatedMod?.module_data;
                      return raw ? validateAIOutput("generate_module", raw) : null;
                    })()}
                    className="mt-4"
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="quiz">
              <ProtectedAction requiredLevel="learner" fallback={
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">You need learner access or higher to take quizzes.</p>
                </div>
              }>
                <div className="bg-card border border-border rounded-xl p-8">
                  {hasPackPermission("author") && (
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                      <div className="text-xs text-muted-foreground">
                        {generatedQuiz ? (
                          <>Generated {new Date(generatedQuiz.created_at).toLocaleDateString()}</>
                        ) : (
                          <>No generated quiz yet</>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateQuiz}
                        disabled={generateQuiz.isPending}
                        className="gap-2 text-xs"
                      >
                        {generateQuiz.isPending ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                        ) : (
                          <><RotateCcw className="w-3 h-3" /> {generatedQuiz ? "Regenerate Quiz" : "Generate Quiz"}</>
                        )}
                      </Button>
                    </div>
                  )}

                  {quizLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading quiz...</div>
                  ) : generatedQuiz?.quiz_data?.questions?.length ? (
                    <QuizRunner
                      generatedQuestions={generatedQuiz.quiz_data.questions}
                      onComplete={handleQuizComplete}
                      hasContradictions={!!generatedMod?.contradictions?.length}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No quiz available for this module yet.</p>
                      {hasPackPermission("author") && (
                        <Button size="sm" className="mt-3 gap-2" onClick={handleGenerateQuiz} disabled={generateQuiz.isPending}>
                          <Sparkles className="w-3 h-3" /> Generate Quiz
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ProtectedAction>
            </TabsContent>
          </Tabs>
        ) : staticMod ? (
          /* Static module content */
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="bg-muted border border-border mb-6">
              <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-card">
                <BookOpen className="w-4 h-4" /> Content
              </TabsTrigger>
              <TabsTrigger value="quiz" className="gap-2 data-[state=active]:bg-card" disabled={!canInteract}>
                <BrainCircuit className="w-4 h-4" /> Quiz ({staticMod.quiz.length})
                {!canInteract && <Lock className="w-3 h-3 ml-1" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <StaticTrackFilter activeTrack={activeTrack} setActiveTrack={setActiveTrack} />

              <div className="space-y-4">
                {filteredStaticSections.map((section, i) => (
                  <SectionViewer
                    key={section.id}
                    section={section}
                    index={i}
                    isRead={readSections.has(section.id)}
                    onMarkRead={canInteract ? () => handleToggleRead(section.id) : undefined}
                    savedNote={getNoteForSection(section.id)}
                    onSaveNote={canInteract ? (content) => saveNote.mutate({ sectionId: section.id, content }) : undefined}
                    onDeleteNote={canInteract ? () => deleteNote.mutate({ sectionId: section.id }) : undefined}
                  />
                ))}
                {filteredStaticSections.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">No sections for this track in this module.</div>
                )}
              </div>

              {readSections.size === staticMod.sections.length && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-card border border-primary/20 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Module Complete — Reflection</h3>
                  </div>
                  {staticMod.endcap.reflection_prompts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reflect on what you learned:</p>
                      <ul className="space-y-2">
                        {staticMod.endcap.reflection_prompts.map((p, i) => (
                          <li key={i} className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">💭 {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-foreground font-medium mb-2">Ready for the quiz?</p>
                    <p className="text-xs text-muted-foreground">{staticMod.endcap.ready_for_quiz_markdown}</p>
                    {staticMod.endcap.quiz_objectives.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {staticMod.endcap.quiz_objectives.map((obj, i) => (
                          <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">📝 {obj}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="quiz">
              <ProtectedAction requiredLevel="learner" fallback={
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">You need learner access or higher to take quizzes.</p>
                </div>
              }>
                <div className="bg-card border border-border rounded-xl p-8">
                  <QuizRunner questions={staticMod.quiz} onComplete={handleQuizComplete} />
                </div>
              </ProtectedAction>
            </TabsContent>
          </Tabs>
        ) : null}

        {/* Chat panel */}
        <ProtectedAction requiredLevel="learner">
          <ModuleChatPanel
            moduleId={moduleId || ""}
            moduleContext={{
              title,
              description: description || "",
              keyTakeaways,
              sections: isGenerated
                ? (moduleData?.sections || []).map((s) => ({ title: s.heading, content: s.markdown }))
                : (staticMod?.sections || []).map((s) => ({ title: s.title, content: s.content })),
            }}
          />
        </ProtectedAction>

        {/* Refine Module Dialog */}
        <Dialog open={refineOpen} onOpenChange={setRefineOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Refine Module
              </DialogTitle>
              <DialogDescription>
                Describe what you'd like to change. The AI will update the module and document all changes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">What would you like to change?</label>
                <Textarea
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="e.g., Add more detail to the deployment section, simplify the authentication explanation, add a section about error handling..."
                  rows={4}
                  className="resize-none"
                />
              </div>
              {generatedMod && (
                <p className="text-xs text-muted-foreground">
                  Current revision: <span className="font-mono font-medium">Rev. {generatedMod.module_revision}</span> • Next will be Rev. {generatedMod.module_revision + 1}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRefineOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleRefine}
                  disabled={!refineInstruction.trim() || refineModule.isPending}
                  className="gap-2"
                >
                  {refineModule.isPending ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Refining...</>
                  ) : (
                    <><Sparkles className="w-3 h-3" /> Refine</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Log Dialog */}
        <Dialog open={changeLogOpen} onOpenChange={setChangeLogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Refinement Change Log
              </DialogTitle>
              <DialogDescription>
                Summary of changes made during refinement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {changeLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes documented.</p>
              ) : (
                changeLog.map((entry, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">{entry.change}</p>
                    <p className="text-xs text-muted-foreground">{entry.reason}</p>
                    {entry.citations && entry.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {entry.citations.map((c) => (
                          <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Revision History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-4 h-4" /> Revision History
              </DialogTitle>
              <DialogDescription>
                All revisions of this module.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(revisionHistory || []).map((rev) => (
                <div
                  key={rev.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    rev.module_revision === generatedMod?.module_revision
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">Rev. {rev.module_revision}</Badge>
                      {rev.module_revision === generatedMod?.module_revision && (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-0">Current</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rev.title}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
