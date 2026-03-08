import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Trash2, User, Layers, BookText, GraduationCap, Globe, GitBranch, Settings2, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAudiencePrefs, GlossaryDensity, ExperienceLevel } from "@/hooks/useAudiencePrefs";
import { useGenerationPrefs, TargetReadingLevel } from "@/hooks/useGenerationPrefs";
import { usePack } from "@/hooks/usePack";
import type { Audience, Depth } from "@/data/onboarding-data";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  { key: "new", label: "New (< 1 year)", desc: "Just starting out, need extra guidance" },
  { key: "mid", label: "Mid (1-5 years)", desc: "Some experience, familiar with basics" },
  { key: "senior", label: "Senior (5+ years)", desc: "Experienced, focus on architecture & patterns" },
];

const READING_LEVEL_OPTIONS: { key: TargetReadingLevel; label: string; desc: string }[] = [
  { key: "plain", label: "Plain", desc: "Simple, easy-to-read language" },
  { key: "standard", label: "Standard", desc: "Balanced technical writing" },
  { key: "technical", label: "Technical", desc: "Dense, precise, expert-oriented" },
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

const PROFILE_FIELDS = [
  { key: "audience", label: "Audience" },
  { key: "depth", label: "Content Depth" },
  { key: "role", label: "Role" },
  { key: "experience", label: "Experience Level" },
  { key: "language", label: "Output Language" },
  { key: "glossary", label: "Glossary Density" },
] as const;

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { audience, depth, glossaryDensity, learnerRole, experienceLevel, outputLanguage, mermaidEnabled, updatePrefs } = useAudiencePrefs();
  const { targetReadingLevel, maxSectionsHint, packLimits, isAuthorPlus, updatePrefs: updateGenPrefs, updatePackLimits } = useGenerationPrefs();
  const { currentPackId } = usePack();
  const [roleInput, setRoleInput] = useState(learnerRole || "");
  const [sectionsInput, setSectionsInput] = useState(maxSectionsHint);
  const [moduleWordsInput, setModuleWordsInput] = useState(packLimits.maxModuleWords);
  const [quizQuestionsInput, setQuizQuestionsInput] = useState(packLimits.maxQuizQuestions);
  const [takeawaysInput, setTakeawaysInput] = useState(packLimits.maxKeyTakeaways);

  const profileCompleteness = useMemo(() => {
    const filled: string[] = [];
    const missing: string[] = [];
    // audience always has a default, count as filled if not default
    filled.push("Audience"); // always set
    if (depth !== "standard") filled.push("Content Depth"); else missing.push("Content Depth");
    if (learnerRole) filled.push("Role"); else missing.push("Role");
    if (experienceLevel) filled.push("Experience Level"); else missing.push("Experience Level");
    if (outputLanguage !== "en") filled.push("Output Language"); else missing.push("Output Language");
    if (glossaryDensity !== "standard") filled.push("Glossary Density"); else missing.push("Glossary Density");
    return { filled, missing, total: 6, count: filled.length };
  }, [audience, depth, learnerRole, experienceLevel, outputLanguage, glossaryDensity]);

  // Reset counts query
  const resetCountsQuery = useQuery({
    queryKey: ["reset_counts", currentPackId, user?.id],
    queryFn: async () => {
      if (!user || !currentPackId) return { sections: 0, quizzes: 0, notes: 0, paths: 0, askLead: 0, chat: 0 };
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        supabase.from("user_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
        supabase.from("quiz_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
        supabase.from("learner_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
        supabase.from("path_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId).eq("is_checked", true),
        supabase.from("ask_lead_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId).eq("is_asked", true),
        supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
      ]);
      return {
        sections: r1.count || 0,
        quizzes: r2.count || 0,
        notes: r3.count || 0,
        paths: r4.count || 0,
        askLead: r5.count || 0,
        chat: r6.count || 0,
      };
    },
    enabled: !!user && !!currentPackId,
  });

  const resetCounts = resetCountsQuery.data || { sections: 0, quizzes: 0, notes: 0, paths: 0, askLead: 0, chat: 0 };
  const totalResetItems = resetCounts.sections + resetCounts.quizzes + resetCounts.notes + resetCounts.paths + resetCounts.askLead + resetCounts.chat;

  const handleResetProgress = async () => {
    if (!user || !currentPackId) return;
    const results = await Promise.all([
      supabase.from("user_progress").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("quiz_scores").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("learner_notes").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("path_progress").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("ask_lead_progress").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("chat_messages").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("learner_state").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
    ]);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      toast.error("Failed to reset some progress data");
    } else {
      // Invalidate all relevant caches
      queryClient.invalidateQueries();
      toast.success("All progress reset successfully");
    }
  };

  const saveAll = (overrides: Partial<{ audience: Audience; depth: Depth; glossary_density: GlossaryDensity; learner_role: string | null; experience_level: ExperienceLevel | null; output_language: string; mermaid_enabled: boolean }>) => {
    updatePrefs.mutate({
      audience: overrides.audience ?? audience,
      depth: overrides.depth ?? depth,
      glossary_density: overrides.glossary_density ?? glossaryDensity,
      learner_role: overrides.learner_role !== undefined ? overrides.learner_role : learnerRole,
      experience_level: overrides.experience_level !== undefined ? overrides.experience_level : experienceLevel,
      output_language: overrides.output_language ?? outputLanguage,
      mermaid_enabled: overrides.mermaid_enabled !== undefined ? overrides.mermaid_enabled : mermaidEnabled,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

          {/* Profile Completeness */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Profile Completeness</h2>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <Progress value={(profileCompleteness.count / profileCompleteness.total) * 100} className="flex-1 h-2" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap cursor-help">
                    {profileCompleteness.count}/{profileCompleteness.total} complete
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {profileCompleteness.missing.length > 0 ? (
                    <div className="text-xs">
                      <p className="font-medium mb-1">Missing fields:</p>
                      <ul className="list-disc pl-3">
                        {profileCompleteness.missing.map((f) => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs">All fields configured!</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

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
                    placeholder="e.g., Frontend Developer, SRE, etc."
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

          {/* Generation Preferences */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Generation Preferences</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Control how AI generates content for you.
            </p>

            <div className="space-y-5">
              {/* Target Reading Level */}
              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 block">Target Reading Level</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {READING_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => updateGenPrefs.mutate({ target_reading_level: opt.key })}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        targetReadingLevel === opt.key
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

              {/* Max Sections Hint */}
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1 block">Max Sections per Module</label>
                <p className="text-xs text-muted-foreground mb-2">Suggested number of sections per module (1–15)</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={15}
                    value={sectionsInput}
                    onChange={(e) => setSectionsInput(Number(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const v = Math.max(1, Math.min(15, sectionsInput));
                      updateGenPrefs.mutate({ max_sections_hint: v });
                    }}
                    disabled={sectionsInput === maxSectionsHint}
                  >
                    Save
                  </Button>
                </div>
              </div>

              {/* Mermaid Diagrams */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  <div>
                    <span className="text-sm font-medium text-card-foreground">Enable Mermaid Diagrams</span>
                    <p className="text-xs text-muted-foreground">Allow AI to include diagrams in content</p>
                  </div>
                </div>
                <Switch
                  checked={mermaidEnabled}
                  onCheckedChange={(checked) => saveAll({ mermaid_enabled: checked })}
                />
              </div>
            </div>
          </div>

          {/* Content Limits (author+ only) */}
          {isAuthorPlus && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-card-foreground">Content Limits</h2>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Author+</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Pack-level limits that apply to all generated content.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1 block">Max Module Words</label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={200} max={5000} value={moduleWordsInput} onChange={(e) => setModuleWordsInput(Number(e.target.value))} className="w-28" />
                    <Button size="sm" variant="outline" onClick={() => updatePackLimits.mutate({ max_module_words: moduleWordsInput })} disabled={moduleWordsInput === packLimits.maxModuleWords}>Save</Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1 block">Max Quiz Questions</label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={20} value={quizQuestionsInput} onChange={(e) => setQuizQuestionsInput(Number(e.target.value))} className="w-28" />
                    <Button size="sm" variant="outline" onClick={() => updatePackLimits.mutate({ max_quiz_questions: quizQuestionsInput })} disabled={quizQuestionsInput === packLimits.maxQuizQuestions}>Save</Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1 block">Max Key Takeaways</label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={15} value={takeawaysInput} onChange={(e) => setTakeawaysInput(Number(e.target.value))} className="w-28" />
                    <Button size="sm" variant="outline" onClick={() => updatePackLimits.mutate({ max_key_takeaways: takeawaysInput })} disabled={takeawaysInput === packLimits.maxKeyTakeaways}>Save</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
