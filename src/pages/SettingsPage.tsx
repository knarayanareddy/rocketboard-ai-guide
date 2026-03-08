import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleResetProgress = async () => {
    if (!user) return;
    const { error: e1 } = await supabase.from("user_progress").delete().eq("user_id", user.id);
    const { error: e2 } = await supabase.from("quiz_scores").delete().eq("user_id", user.id);
    if (e1 || e2) {
      toast.error("Failed to reset progress");
    } else {
      queryClient.invalidateQueries({ queryKey: ["user_progress"] });
      queryClient.invalidateQueries({ queryKey: ["quiz_scores"] });
      toast.success("Progress reset successfully");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-card-foreground mb-2">Reset Progress</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Clear all module progress and quiz scores. This cannot be undone.
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
