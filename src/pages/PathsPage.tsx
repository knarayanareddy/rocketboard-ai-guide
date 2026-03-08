import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { day1Path, week1Path, PathStep } from "@/data/paths-data";
import { TrackBadge } from "@/components/TrackBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Clock, Rocket, Calendar } from "lucide-react";
import { motion } from "framer-motion";

function PathCard({ step, index, checked, onToggle }: { step: PathStep; index: number; checked: boolean; onToggle: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`bg-card border rounded-xl p-5 transition-all duration-300 ${checked ? "border-primary/30 bg-card/50" : "border-border"}`}
    >
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="mt-0.5 shrink-0">
          {checked ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`font-semibold text-sm ${checked ? "text-muted-foreground line-through" : "text-card-foreground"}`}>
              {step.title}
            </h3>
            {step.track_key && <TrackBadge track={step.track_key} />}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {step.time_estimate_minutes}m
            </span>
          </div>
          <ul className="space-y-1 mt-2">
            {step.steps.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-primary/50 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1">
            {step.success_criteria.map((c, i) => (
              <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                ✓ {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function PathsPage() {
  const [checkedDay1, setCheckedDay1] = useState<Set<string>>(new Set());
  const [checkedWeek1, setCheckedWeek1] = useState<Set<string>>(new Set());

  const toggleDay1 = (id: string) => {
    setCheckedDay1((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleWeek1 = (id: string) => {
    setCheckedWeek1((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const day1Progress = Math.round((checkedDay1.size / day1Path.length) * 100);
  const week1Progress = Math.round((checkedWeek1.size / week1Path.length) * 100);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Onboarding Paths</h1>
          </div>
          <p className="text-sm text-muted-foreground">Step-by-step checklists to get you productive on Day 1 and through Week 1.</p>
        </motion.div>

        <Tabs defaultValue="day1" className="w-full">
          <TabsList className="bg-muted border border-border mb-6">
            <TabsTrigger value="day1" className="gap-2 data-[state=active]:bg-card">
              <Calendar className="w-4 h-4" />
              Day 1 ({day1Progress}%)
            </TabsTrigger>
            <TabsTrigger value="week1" className="gap-2 data-[state=active]:bg-card">
              <Rocket className="w-4 h-4" />
              Week 1 ({week1Progress}%)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="day1">
            <div className="space-y-3">
              {day1Path.map((step, i) => (
                <PathCard key={step.id} step={step} index={i} checked={checkedDay1.has(step.id)} onToggle={() => toggleDay1(step.id)} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="week1">
            <div className="space-y-3">
              {week1Path.map((step, i) => (
                <PathCard key={step.id} step={step} index={i} checked={checkedWeek1.has(step.id)} onToggle={() => toggleWeek1(step.id)} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
