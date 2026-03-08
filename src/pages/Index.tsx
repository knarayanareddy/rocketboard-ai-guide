import { useNavigate } from "react-router-dom";
import { modules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Rocket, Target, Clock, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const navigate = useNavigate();

  // Simple progress simulation (in real app, this would be stored)
  const getProgress = (moduleId: string) => {
    const stored = localStorage.getItem(`progress-${moduleId}`);
    return stored ? parseInt(stored, 10) : 0;
  };

  const totalSections = modules.reduce((a, m) => a + m.sections.length, 0);
  const totalMinutes = modules.reduce((a, m) => a + m.estimatedMinutes, 0);
  const avgProgress = Math.round(
    modules.reduce((a, m) => a + getProgress(m.id), 0) / modules.length
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to <span className="gradient-text">RocketBoard</span>
            </h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Your onboarding launchpad. Complete modules, pass quizzes, and get up to speed with the codebase, workflows, and infrastructure.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: BookOpen, label: "Modules", value: modules.length, color: "text-primary" },
            { icon: Target, label: "Sections", value: totalSections, color: "text-accent" },
            { icon: Clock, label: "Est. Time", value: `${totalMinutes}m`, color: "text-track-infra" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Overall progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Overall Progress</span>
            <span className="text-sm font-mono text-primary">{avgProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full gradient-primary transition-all duration-700"
              style={{ width: `${avgProgress}%` }}
            />
          </div>
        </motion.div>

        {/* Module grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {modules.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              index={i}
              progress={getProgress(mod.id)}
              onClick={() => navigate(`/modules/${mod.id}`)}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
