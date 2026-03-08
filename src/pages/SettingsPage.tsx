import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, User, Layers, BookText, GraduationCap, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAudiencePrefs, GlossaryDensity, ExperienceLevel } from "@/hooks/useAudiencePrefs";
import { usePack } from "@/hooks/usePack";
import type { Audience, Depth } from "@/data/onboarding-data";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const GLOSSARY_DENSITY_OPTIONS: { key: GlossaryDensity; label: string; desc: string }[] = [
  { key: "low", label: "Low", desc: "Only essential/critical terms" },
  { key: "standard", label: "Standard", desc: "Common terms most engineers need" },
  { key: "high", label: "High", desc: "Comprehensive, includes niche terms" },
];

const EXPERIENCE_OPTIONS: { key: ExperienceLevel; label: string; desc: string }[] = [
  { key: "new", label: "New", desc: "Just starting out, need extra guidance" },
  { key: "mid", label: "Mid-Level", desc: "Some experience, familiar with basics" },
  { key: "senior", label: "Senior", desc: "Experienced, focus on architecture & patterns" },
];

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文 (简体)" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];
export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { audience, depth, glossaryDensity, learnerRole, experienceLevel, outputLanguage, updatePrefs } = useAudiencePrefs();
  const { currentPackId } = usePack();
  const [roleInput, setRoleInput] = useState(learnerRole || "");

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

  const saveAll = (overrides: Partial<{ audience: Audience; depth: Depth; glossary_density: GlossaryDensity; learner_role: string | null; experience_level: ExperienceLevel | null; output_language: string }>) => {
    updatePrefs.mutate({
      audience: overrides.audience ?? audience,
      depth: overrides.depth ?? depth,
      glossary_density: overrides.glossary_density ?? glossaryDensity,
      learner_role: overrides.learner_role !== undefined ? overrides.learner_role : learnerRole,
      experience_level: overrides.experience_level !== undefined ? overrides.experience_level : experienceLevel,
      output_language: overrides.output_language ?? outputLanguage,
    });
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
                  onClick={() => saveAll({ audience: opt.key })}
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
                  onClick={() => saveAll({ depth: opt.key })}
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

          {/* Glossary Density */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Glossary Density</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              How many glossary terms should be generated?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GLOSSARY_DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => saveAll({ glossary_density: opt.key })}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    glossaryDensity === opt.key
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

          {/* Learner Profile */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Learner Profile</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Help the AI tailor content to your role and experience.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 block">Your Role</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    placeholder="e.g. Frontend Developer, DevOps Engineer"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveAll({ learner_role: roleInput || null })}
                    disabled={roleInput === (learnerRole || "")}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 block">Experience Level</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => saveAll({ experience_level: opt.key })}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        experienceLevel === opt.key
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
            </div>
          </div>

          {/* Output Language */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Output Language</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose the language for AI-generated content and chat responses.
            </p>
            <Select
              value={outputLanguage}
              onValueChange={(val) => {
                saveAll({ output_language: val });
                if (val !== "en") {
                  toast.info("Language preference saved. Existing generated content will remain in its original language. New content and chat responses will use your selected language.");
                }
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
