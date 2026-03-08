import { useNavigate } from "react-router-dom";
import { modules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useProgress } from "@/hooks/useProgress";

export default function Modules() {
  const navigate = useNavigate();
  const { getModuleProgress } = useProgress();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">All Modules</h1>
          <p className="text-muted-foreground text-sm">Browse and complete onboarding modules at your own pace.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {modules.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              index={i}
              progress={getModuleProgress(mod.id)}
              onClick={() => navigate(`/modules/${mod.id}`)}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
