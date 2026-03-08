import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Trash2, User, Eye, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";
import { usePack } from "@/hooks/usePack";
import type { Audience, Depth } from "@/data/onboarding-data";

const AUDIENCE_OPTIONS: { key: Audience; label: string; desc: string }[] = [
  { key: "technical", label: "Technical", desc: "Detailed, code-oriented content" },
  { key: "non_technical", label: "Non-Technical", desc: "Business-focused, simpler language" },
  { key: "mixed", label: "Mixed", desc: "Balanced for all audiences" },
];

const DEPTH_OPTIONS: { key: Depth; label: string; desc: string }[] = [
  { key: "shallow", label: "Shallow", desc: "Quick overview, key points only" },
  { key: "standard", label: "Standard", desc: "Balanced detail for most learners" },
  { key: "deep", label: "Deep", desc: "In-depth with implementation details" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { audience, depth, updatePrefs } = useAudiencePrefs();

  const handleResetProgress = async () => {
    if (!user) return;
    const { error: e1 } = await supabase.from("user_progress").delete().eq("user_id", user.id);
    const { error: e2 } = await supabase.from("quiz_scores").delete().eq("user_id", user.id);
    const { error: e3 } = await supabase.from("learner_notes").delete().eq("user_id", user.id);
    if (e1 || e2 || e3) {
      toast.error("Failed to reset progress");
    } else {
      queryClient.invalidateQueries({ queryKey: ["user_progress"] });
      queryClient.invalidateQueries({ queryKey: ["quiz_scores"] });
      queryClient.invalidateQueries({ queryKey: ["learner_notes"] });
      toast.success("Progress reset successfully");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

          {/* Audience Profile */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Audience Profile</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your audience type to customize content tone and detail level.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => updatePrefs.mutate({ audience: opt.key, depth })}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    audience === opt.key
                      ? "border-primary/40 bg-primary/10"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Depth Preference */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Content Depth</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              How much detail do you want in module content?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => updatePrefs.mutate({ audience, depth: opt.key })}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    depth === opt.key
                      ? "border-primary/40 bg-primary/10"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Reset Progress */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-card-foreground mb-2">Reset Progress</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Clear all module progress, quiz scores, and notes. This cannot be undone.
            </p>
            <Button variant="destructive" onClick={handleResetProgress} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Reset All Progress
            </Button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
