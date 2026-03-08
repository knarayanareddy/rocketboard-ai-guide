import { useNavigate } from "react-router-dom";
import { modules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { ProgressChart } from "@/components/ProgressChart";
import { StatsStrip } from "@/components/StatsStrip";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Rocket } from "lucide-react";
import { motion } from "framer-motion";

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

  const getProgress = (moduleId: string) => {
    const stored = localStorage.getItem(`progress-${moduleId}`);
    return stored ? parseInt(stored, 10) : 0;
  };

  const avgProgress = Math.round(
    modules.reduce((a, m) => a + getProgress(m.id), 0) / modules.length
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
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
          <p className="text-muted-foreground max-w-xl">
            Your onboarding launchpad. Complete modules, pass quizzes, and get up to speed with the codebase, workflows, and infrastructure.
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <StatsStrip getProgress={getProgress} />
        </motion.div>

        {/* Progress bar + chart row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
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
                {modules.filter((m) => getProgress(m.id) === 100).length} of {modules.length} modules completed
              </p>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            <ProgressChart getProgress={getProgress} />
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
                progress={getProgress(mod.id)}
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
