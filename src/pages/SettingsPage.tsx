import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const handleResetProgress = () => {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith("progress-") || k.startsWith("read-")
    );
    keys.forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-card-foreground mb-2">Reset Progress</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Clear all module progress and section read states. This cannot be undone.
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
