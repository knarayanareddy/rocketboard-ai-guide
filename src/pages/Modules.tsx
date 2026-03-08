import { useNavigate } from "react-router-dom";
import { modules as staticModules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useProgress } from "@/hooks/useProgress";
import { useGeneratedModules, GeneratedModuleRow } from "@/hooks/useGeneratedModules";
import { usePack } from "@/hooks/usePack";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronRight, CheckCircle2, Sparkles, BookOpen } from "lucide-react";
import { TrackBadge } from "@/components/TrackBadge";

function GeneratedModuleCard({ mod, index, progress, onClick }: {
  mod: GeneratedModuleRow;
  index: number;
  progress: number;
  onClick: () => void;
}) {
  const isComplete = progress === 100;
  const difficultyColor = {
    beginner: "text-green-500",
    intermediate: "text-yellow-500",
    advanced: "text-red-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={onClick}
      className="group relative bg-card border border-border rounded-xl p-6 cursor-pointer transition-all duration-300 hover:border-primary/40 hover:glow-border"
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden bg-muted">
        <div className="h-full gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-start justify-between mb-4 mt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
              {mod.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{mod.estimated_minutes || 15} min</span>
              <span>•</span>
              <span>{(mod.module_data as any)?.sections?.length || 0} sections</span>
              {mod.difficulty && (
                <>
                  <span>•</span>
                  <span className={`capitalize ${difficultyColor[mod.difficulty as keyof typeof difficultyColor] || ""}`}>
                    {mod.difficulty}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
            Generated
          </Badge>
          {mod.module_revision > 1 && (
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground font-mono">
              Rev. {mod.module_revision}
            </Badge>
          )}
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {mod.description || "AI-generated module"}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {mod.track_key && <TrackBadge track={mod.track_key as any} />}
      </div>
    </motion.div>
  );
}

export default function Modules() {
  const navigate = useNavigate();
  const { getModuleProgress } = useProgress();
  const { modules: generatedModules, modulesLoading } = useGeneratedModules();
  const { currentPack } = usePack();

  const hasGenerated = generatedModules.length > 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">All Modules</h1>
          <p className="text-muted-foreground text-sm">Browse and complete onboarding modules at your own pace.</p>
        </motion.div>

        {/* Generated modules */}
        {hasGenerated && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Generated Modules</h2>
              <Badge variant="outline" className="text-[10px]">{generatedModules.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {generatedModules.map((mod, i) => (
                <GeneratedModuleCard
                  key={mod.id}
                  mod={mod}
                  index={i}
                  progress={getModuleProgress(mod.module_key)}
                  onClick={() => navigate(`/modules/${mod.module_key}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Static modules */}
        <div>
          {hasGenerated && (
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Default Modules</h2>
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Static</Badge>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {staticModules.map((mod, i) => (
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
      </div>
    </DashboardLayout>
  );
}
