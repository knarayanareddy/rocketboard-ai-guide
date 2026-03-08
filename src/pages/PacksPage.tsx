import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { usePacks } from "@/hooks/usePacks";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { ProtectedAction } from "@/components/ProtectedAction";
import { Package, ArrowRight, Globe, Hash, Users } from "lucide-react";
import { motion } from "framer-motion";

export default function PacksPage() {
  const navigate = useNavigate();
  const { packs, isLoading } = usePacks();
  const { setPack } = usePack();
  const { hasPackPermission } = useRole();

  const handleSelect = (pack: any) => {
    setPack(pack);
    navigate("/");
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Your Packs</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Select an onboarding pack to start learning. Each pack contains modules, quizzes, and resources.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No packs available. Contact your organization admin to get access.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {packs.map((pack, i) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="w-full text-left bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-lg transition-all group">
                  <button
                    onClick={() => handleSelect(pack)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>

                    <h3 className="font-semibold text-foreground mb-1">{pack.title}</h3>
                    {pack.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{pack.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        v{pack.pack_version}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {pack.language_mode}
                      </span>
                    </div>
                  </button>

                  <ProtectedAction requiredLevel="admin">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/packs/${pack.id}/members`);
                      }}
                      className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Users className="w-3 h-3" />
                      Manage Members
                    </button>
                  </ProtectedAction>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
