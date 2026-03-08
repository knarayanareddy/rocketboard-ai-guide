import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { modules, Track, TRACKS } from "@/data/onboarding-data";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionViewer } from "@/components/SectionViewer";
import { QuizRunner } from "@/components/QuizRunner";
import { TrackBadge } from "@/components/TrackBadge";
import { ArrowLeft, Filter, BookOpen, BrainCircuit, Lightbulb, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProgress } from "@/hooks/useProgress";
import { useNotes } from "@/hooks/useNotes";
import { useLearnerState } from "@/hooks/useLearnerState";
import { useEffect } from "react";

export default function ModuleView() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const mod = modules.find((m) => m.id === moduleId);
  const { getReadSectionsForModule, toggleSection, saveQuizScore, getModuleProgress } = useProgress();
  const { getNoteForSection, saveNote, deleteNote } = useNotes(moduleId || "");
  const { updateLastOpened } = useLearnerState();

  const [activeTrack, setActiveTrack] = useState<Track | "all">("all");

  // Track last opened module
  useEffect(() => {
    if (moduleId) {
      updateLastOpened.mutate({ moduleId });
    }
  }, [moduleId]);

  const readSections = getReadSectionsForModule(moduleId || "");

  const filteredSections = useMemo(() => {
    if (!mod) return [];
    if (activeTrack === "all") return mod.sections;
    return mod.sections.filter((s) => s.tracks.includes(activeTrack));
  }, [mod, activeTrack]);

  if (!mod) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Module not found.
        </div>
      </DashboardLayout>
    );
  }

  const handleToggleRead = (sectionId: string) => {
    toggleSection.mutate({ moduleId: mod.id, sectionId });
  };

  const handleQuizComplete = (score: number) => {
    saveQuizScore.mutate({ moduleId: mod.id, score, total: mod.quiz.length });
  };

  const progress = getModuleProgress(mod.id);

  const difficultyColor = {
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
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-start gap-4 mb-2">
            <span className="text-4xl">{mod.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{mod.title}</h1>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyColor[mod.difficulty]}`}>
                  {mod.difficulty}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{mod.description}</p>
            </div>
          </div>

          {/* Key Takeaways */}
          {mod.key_takeaways.length > 0 && (
            <div className="mt-4 bg-primary/5 border border-primary/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Key Takeaways</span>
              </div>
              <ul className="space-y-1">
                {mod.key_takeaways.map((t, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground">
                {readSections.size}/{mod.sections.length} sections read
              </span>
              <span className="text-xs font-mono text-primary">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full gradient-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="bg-muted border border-border mb-6">
            <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-card">
              <BookOpen className="w-4 h-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-2 data-[state=active]:bg-card">
              <BrainCircuit className="w-4 h-4" />
              Quiz ({mod.quiz.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => setActiveTrack("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTrack === "all"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground border border-transparent hover:border-border"
                }`}
              >
                All Tracks
              </button>
              {TRACKS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTrack(t.key)}
                  className={`transition-opacity ${activeTrack !== "all" && activeTrack !== t.key ? "opacity-40" : ""}`}
                >
                  <TrackBadge track={t.key} />
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredSections.map((section, i) => (
                <SectionViewer
                  key={section.id}
                  section={section}
                  index={i}
                  isRead={readSections.has(section.id)}
                  onMarkRead={() => handleToggleRead(section.id)}
                  savedNote={getNoteForSection(section.id)}
                  onSaveNote={(content) => saveNote.mutate({ sectionId: section.id, content })}
                  onDeleteNote={() => deleteNote.mutate({ sectionId: section.id })}
                />
              ))}
              {filteredSections.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No sections for this track in this module.
                </div>
              )}
            </div>

            {/* Endcap - Reflection & Quiz Prep */}
            {readSections.size === mod.sections.length && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 bg-card border border-primary/20 rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Module Complete — Reflection</h3>
                </div>

                {mod.endcap.reflection_prompts.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reflect on what you learned:</p>
                    <ul className="space-y-2">
                      {mod.endcap.reflection_prompts.map((p, i) => (
                        <li key={i} className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                          💭 {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <p className="text-sm text-foreground font-medium mb-2">Ready for the quiz?</p>
                  <p className="text-xs text-muted-foreground">{mod.endcap.ready_for_quiz_markdown}</p>
                  {mod.endcap.quiz_objectives.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {mod.endcap.quiz_objectives.map((obj, i) => (
                        <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
                          📝 {obj}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="quiz">
            <div className="bg-card border border-border rounded-xl p-8">
              <QuizRunner questions={mod.quiz} onComplete={handleQuizComplete} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
