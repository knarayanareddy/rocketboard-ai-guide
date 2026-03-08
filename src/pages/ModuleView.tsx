import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { modules as staticModules, Track, TRACKS } from "@/data/onboarding-data";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionViewer } from "@/components/SectionViewer";
import { QuizRunner } from "@/components/QuizRunner";
import { TrackBadge } from "@/components/TrackBadge";
import { ProtectedAction } from "@/components/ProtectedAction";
import { CitationBadge } from "@/components/CitationBadge";
import { NotesPanel } from "@/components/NotesPanel";
import { ArrowLeft, Filter, BookOpen, BrainCircuit, Lightbulb, Star, Lock, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProgress } from "@/hooks/useProgress";
import { useNotes } from "@/hooks/useNotes";
import { useLearnerState } from "@/hooks/useLearnerState";
import { useRole } from "@/hooks/useRole";
import { ModuleChatPanel } from "@/components/ModuleChatPanel";
import { useGeneratedModules, GeneratedModuleRow, GeneratedSection } from "@/hooks/useGeneratedModules";
import { usePack } from "@/hooks/usePack";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";

function GeneratedSectionViewer({ section, index, isRead, onMarkRead, savedNote, onSaveNote, onDeleteNote }: {
  section: GeneratedSection;
  index: number;
  isRead: boolean;
  onMarkRead?: () => void;
  savedNote?: string;
  onSaveNote?: (content: string) => void;
  onDeleteNote?: () => void;
}) {
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
        </div>
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

      {section.learning_objectives && section.learning_objectives.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {section.learning_objectives.map((obj, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
              🎯 {obj}
            </span>
          ))}
        </div>
      )}

      <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground leading-relaxed [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>pre]:my-2">
        <ReactMarkdown>{section.markdown}</ReactMarkdown>
      </div>

      {section.citations && section.citations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/50">
          {section.citations.map((c) => (
            <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
          ))}
        </div>
      )}

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

export default function ModuleView() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { currentPackId } = usePack();

  // Static module lookup
  const staticMod = staticModules.find((m) => m.id === moduleId);

  // Generated module lookup
  const { fetchModule } = useGeneratedModules();
  const { data: generatedMod, isLoading: genLoading } = fetchModule(moduleId || "");

  const isGenerated = !!generatedMod;
  const moduleData = generatedMod?.module_data;

  const { getReadSectionsForModule, toggleSection, saveQuizScore, getModuleProgress } = useProgress();
  const { getNoteForSection, saveNote, deleteNote } = useNotes(moduleId || "");
  const { updateLastOpened } = useLearnerState();
  const { hasPackPermission } = useRole();

  const [activeTrack, setActiveTrack] = useState<Track | "all">("all");
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    if (moduleId) updateLastOpened.mutate({ moduleId });
  }, [moduleId]);

  const readSections = getReadSectionsForModule(moduleId || "");

  // Determine sections count for progress
  const totalSections = isGenerated
    ? (moduleData?.sections?.length || 0)
    : (staticMod?.sections?.length || 0);

  // Static module filtered sections
  const filteredStaticSections = useMemo(() => {
    if (!staticMod) return [];
    if (activeTrack === "all") return staticMod.sections;
    return staticMod.sections.filter((s) => s.tracks.includes(activeTrack));
  }, [staticMod, activeTrack]);

  // Module not found
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
    const quizLen = staticMod?.quiz?.length || 0;
    if (quizLen > 0) saveQuizScore.mutate({ moduleId, score, total: quizLen });
  };

  // Get display title/description
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
            onClick={() => navigate("/")}
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
                {!canInteract && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Read Only
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{description}</p>
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
          </div>
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
                {TRACKS.map((t) => (
                  <button key={t.key} onClick={() => setActiveTrack(t.key)} className={`transition-opacity ${activeTrack !== "all" && activeTrack !== t.key ? "opacity-40" : ""}`}>
                    <TrackBadge track={t.key} />
                  </button>
                ))}
              </div>

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
      </div>
    </DashboardLayout>
  );
}
