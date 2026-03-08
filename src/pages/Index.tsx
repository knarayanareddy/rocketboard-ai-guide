import { useNavigate } from "react-router-dom";
import { modules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { ProgressChart } from "@/components/ProgressChart";
import { StatsStrip } from "@/components/StatsStrip";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Rocket, Play, Package } from "lucide-react";
import { motion } from "framer-motion";
import { useProgress } from "@/hooks/useProgress";
import { useLearnerState } from "@/hooks/useLearnerState";
import { usePack } from "@/hooks/usePack";
import { IngestionStatus } from "@/components/IngestionStatus";

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

const Index = () => {
  const navigate = useNavigate();
  const { getModuleProgress, totalSectionsRead, totalSections, completedModules } = useProgress();
  const { lastOpenedModuleId } = useLearnerState();
  const { currentPack } = usePack();

  const avgProgress = Math.round(
    modules.reduce((a, m) => a + getModuleProgress(m.id), 0) / modules.length
  );

  const lastModule = lastOpenedModuleId ? modules.find((m) => m.id === lastOpenedModuleId) : null;
  const nextIncomplete = modules.find((m) => getModuleProgress(m.id) < 100);
  const resumeModule = lastModule && getModuleProgress(lastModule.id) < 100 ? lastModule : nextIncomplete;

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

          {/* Current pack indicator */}
          {currentPack && (
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Pack: <span className="font-medium text-foreground">{currentPack.title}</span>
              </span>
            </div>
          )}

          <p className="text-muted-foreground max-w-xl">
            Your onboarding launchpad. Complete modules, take notes, pass quizzes, and get up to speed with the codebase, workflows, and infrastructure.
          </p>

          {/* Continue / Resume button */}
          {resumeModule && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              onClick={() => navigate(`/modules/${resumeModule.id}`)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <Play className="w-4 h-4" />
              Continue: {resumeModule.title} ({getModuleProgress(resumeModule.id)}%)
            </motion.button>
          )}
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <StatsStrip
            completedModules={completedModules}
            totalSectionsRead={totalSectionsRead}
            totalSections={totalSections}
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
                {completedModules} of {modules.length} modules completed
              </p>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, type: "spring" as const }}
          >
            <ProgressChart getProgress={getModuleProgress} />
          </motion.div>
        </div>

        {/* Module grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {modules.map((mod, i) => (
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
      </div>
    </DashboardLayout>
  );
};

export default Index;
