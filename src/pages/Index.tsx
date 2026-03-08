import { useNavigate } from "react-router-dom";
import { modules as staticModules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { ProgressChart } from "@/components/ProgressChart";
import { StatsStrip } from "@/components/StatsStrip";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Rocket, Play, Package, Sparkles, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useProgress } from "@/hooks/useProgress";
import { useLearnerState } from "@/hooks/useLearnerState";
import { usePack } from "@/hooks/usePack";
import { IngestionStatus } from "@/components/IngestionStatus";
import { useGeneratedModules, GeneratedModuleRow } from "@/hooks/useGeneratedModules";
import { useMemo } from "react";
import { TrackBadge } from "@/components/TrackBadge";
import { Badge } from "@/components/ui/badge";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 } as const,
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 20 } },
};

const difficultyColor: Record<string, string> = {
  beginner: "text-green-500 bg-green-500/10",
  intermediate: "text-yellow-500 bg-yellow-500/10",
  advanced: "text-red-500 bg-red-500/10",
};

function GeneratedModuleCard({ mod, index, progress, onClick }: {
  mod: GeneratedModuleRow;
  index: number;
  progress: number;
  onClick: () => void;
}) {
  const isComplete = progress === 100;
  return (
    <motion.div
      variants={item}
      className="cursor-pointer group"
      onClick={onClick}
    >
      <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all relative overflow-hidden">
        {/* Progress bar at top */}
        <div className="absolute top-0 left-0 h-1 bg-muted w-full">
          <div
            className="h-full gradient-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-start justify-between mt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors text-sm">
                {mod.title}
              </h3>
              {mod.difficulty && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${difficultyColor[mod.difficulty] || ""}`}>
                  {mod.difficulty}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{progress}%</span>
            {isComplete ? (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
        </div>

        {mod.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{mod.description}</p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {mod.estimated_minutes && (
            <span className="text-[10px] text-muted-foreground">~{mod.estimated_minutes} min</span>
          )}
          {mod.track_key && <TrackBadge track={mod.track_key} />}
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary/70 border-primary/20">
            <Sparkles className="w-2 h-2 mr-0.5" /> AI Generated
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const { getModuleProgress, totalSectionsRead, totalSections: staticTotalSections, completedModules: staticCompletedModules, progressData } = useProgress();
  const { lastOpenedModuleId } = useLearnerState();
  const { currentPack } = usePack();
  const { modules: generatedModules, modulesLoading } = useGeneratedModules();

  // Determine data source: if any generated modules exist, use them exclusively
  const useGenerated = generatedModules.length > 0;

  // Compute dynamic progress stats for generated modules
  const genStats = useMemo(() => {
    if (!useGenerated) return null;

    const moduleProgresses = generatedModules.map((mod) => {
      const sectionCount = (mod.module_data?.sections?.length) || 0;
      const readCount = progressData.filter((p) => p.module_id === mod.module_key).length;
      const pct = sectionCount > 0 ? Math.round((readCount / sectionCount) * 100) : (readCount > 0 ? 50 : 0);
      return { mod, sectionCount, readCount, pct };
    });

    const totalSections = moduleProgresses.reduce((a, m) => a + m.sectionCount, 0);
    const totalRead = moduleProgresses.reduce((a, m) => a + m.readCount, 0);
    const completedModules = moduleProgresses.filter((m) => m.pct === 100).length;
    const avgProgress = moduleProgresses.length > 0
      ? Math.round(moduleProgresses.reduce((a, m) => a + m.pct, 0) / moduleProgresses.length)
      : 0;

    return { moduleProgresses, totalSections, totalRead, completedModules, avgProgress };
  }, [useGenerated, generatedModules, progressData]);

  // Unified getters
  const getGenModuleProgress = (moduleKey: string): number => {
    if (!genStats) return 0;
    const found = genStats.moduleProgresses.find((m) => m.mod.module_key === moduleKey);
    return found?.pct || 0;
  };

  const effectiveGetProgress = useGenerated ? getGenModuleProgress : getModuleProgress;
  const effectiveTotalSections = useGenerated ? (genStats?.totalSections || 0) : staticTotalSections;
  const effectiveTotalRead = useGenerated ? (genStats?.totalRead || 0) : totalSectionsRead;
  const effectiveCompleted = useGenerated ? (genStats?.completedModules || 0) : staticCompletedModules;
  const effectiveModuleCount = useGenerated ? generatedModules.length : staticModules.length;

  const avgProgress = useGenerated
    ? (genStats?.avgProgress || 0)
    : Math.round(staticModules.reduce((a, m) => a + getModuleProgress(m.id), 0) / staticModules.length);

  // Chart data
  const chartData = useMemo(() => {
    if (useGenerated) {
      return generatedModules.map((mod) => ({
        module: mod.title.length > 14 ? mod.title.slice(0, 14) + "…" : mod.title,
        progress: getGenModuleProgress(mod.module_key),
        fullMark: 100,
      }));
    }
    return staticModules.map((mod) => ({
      module: mod.title.length > 14 ? mod.title.slice(0, 14) + "…" : mod.title,
      progress: getModuleProgress(mod.id),
      fullMark: 100,
    }));
  }, [useGenerated, generatedModules, genStats, staticModules, progressData]);

  // Resume module logic
  const resumeTarget = useMemo(() => {
    if (useGenerated) {
      const last = lastOpenedModuleId
        ? generatedModules.find((m) => m.module_key === lastOpenedModuleId)
        : null;
      if (last && getGenModuleProgress(last.module_key) < 100) return { id: last.module_key, title: last.title, progress: getGenModuleProgress(last.module_key) };
      const next = generatedModules.find((m) => getGenModuleProgress(m.module_key) < 100);
      if (next) return { id: next.module_key, title: next.title, progress: getGenModuleProgress(next.module_key) };
      return null;
    }
    const lastModule = lastOpenedModuleId ? staticModules.find((m) => m.id === lastOpenedModuleId) : null;
    const nextIncomplete = staticModules.find((m) => getModuleProgress(m.id) < 100);
    const resumeModule = lastModule && getModuleProgress(lastModule.id) < 100 ? lastModule : nextIncomplete;
    if (resumeModule) return { id: resumeModule.id, title: resumeModule.title, progress: getModuleProgress(resumeModule.id) };
    return null;
  }, [useGenerated, generatedModules, lastOpenedModuleId, genStats, progressData]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 200, damping: 18 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <motion.div
              animate={{ rotate: [0, -10, 10, -5, 0] }}
              transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
            >
              <Rocket className="w-7 h-7 text-primary" />
            </motion.div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to <span className="gradient-text">RocketBoard</span>
            </h1>
          </div>

          {currentPack && (
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Pack: <span className="font-medium text-foreground">{currentPack.title}</span>
              </span>
              {useGenerated && (
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary/70 border-primary/20">
                  <Sparkles className="w-2 h-2 mr-0.5" /> AI-Generated Content
                </Badge>
              )}
            </div>
          )}

          <p className="text-muted-foreground max-w-xl">
            Your onboarding launchpad. Complete modules, take notes, pass quizzes, and get up to speed with the codebase, workflows, and infrastructure.
          </p>

          {resumeTarget && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              onClick={() => navigate(`/modules/${resumeTarget.id}`)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <Play className="w-4 h-4" />
              Continue: {resumeTarget.title} ({resumeTarget.progress}%)
            </motion.button>
          )}
        </motion.div>

        {/* Ingestion Status */}
        <div className="mb-6">
          <IngestionStatus />
        </div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <StatsStrip
            completedModules={effectiveCompleted}
            totalSectionsRead={effectiveTotalRead}
            totalSections={effectiveTotalSections}
            totalModules={effectiveModuleCount}
          />
        </motion.div>

        {/* Progress bar + chart row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, type: "spring" as const }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Overall Progress</span>
                <span className="text-sm font-mono text-primary">{avgProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full gradient-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${avgProgress}%` }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {effectiveCompleted} of {effectiveModuleCount} modules completed
              </p>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, type: "spring" as const }}
          >
            <ProgressChart chartData={chartData} />
          </motion.div>
        </div>

        {/* Module grid */}
        {modulesLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">Loading modules...</div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {useGenerated
              ? generatedModules.map((mod, i) => (
                  <GeneratedModuleCard
                    key={mod.module_key}
                    mod={mod}
                    index={i}
                    progress={getGenModuleProgress(mod.module_key)}
                    onClick={() => navigate(`/modules/${mod.module_key}`)}
                  />
                ))
              : staticModules.map((mod, i) => (
                  <motion.div key={mod.id} variants={item}>
                    <ModuleCard
                      module={mod}
                      index={i}
                      progress={getModuleProgress(mod.id)}
                      onClick={() => navigate(`/modules/${mod.id}`)}
                    />
                  </motion.div>
                ))}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Index;
