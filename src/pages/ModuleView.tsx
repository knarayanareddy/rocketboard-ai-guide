import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { modules, Track, TRACKS } from "@/data/onboarding-data";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionViewer } from "@/components/SectionViewer";
import { QuizRunner } from "@/components/QuizRunner";
import { TrackBadge } from "@/components/TrackBadge";
import { ArrowLeft, Filter, BookOpen, BrainCircuit } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProgress } from "@/hooks/useProgress";

export default function ModuleView() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const mod = modules.find((m) => m.id === moduleId);
  const { getReadSectionsForModule, toggleSection, saveQuizScore, getModuleProgress } = useProgress();

  const [activeTrack, setActiveTrack] = useState<Track | "all">("all");

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
              <h1 className="text-2xl font-bold text-foreground">{mod.title}</h1>
              <p className="text-muted-foreground mt-1">{mod.description}</p>
            </div>
          </div>

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
                />
              ))}
              {filteredSections.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No sections for this track in this module.
                </div>
              )}
            </div>
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
