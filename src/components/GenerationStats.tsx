import { CheckCircle2, XCircle, ChevronDown, AlertTriangle, ShieldCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import type { Limits } from "@/lib/limits";
import { validateAIOutput, type ValidationResult } from "@/lib/schema-validator";

interface StatRow {
  label: string;
  actual: number;
  limit: number;
}

interface GenerationStatsProps {
  stats: StatRow[];
  className?: string;
  validationResult?: ValidationResult | null;
}

export function GenerationStats({ stats, className }: GenerationStatsProps) {
  const [open, setOpen] = useState(false);
  const exceeded = stats.filter((s) => s.actual > s.limit).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        Generation Stats
        {exceeded > 0 && (
          <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
            {exceeded} exceeded
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Metric</TableHead>
                <TableHead className="text-xs text-right">Actual</TableHead>
                <TableHead className="text-xs text-right">Limit</TableHead>
                <TableHead className="text-xs w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => {
                const ok = s.actual <= s.limit;
                return (
                  <TableRow key={s.label}>
                    <TableCell className="text-xs py-1.5">{s.label}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 font-mono">{s.actual}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 font-mono text-muted-foreground">{s.limit}</TableCell>
                    <TableCell className="py-1.5">
                      {ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Helper to build stats from module data + limits */
export function buildModuleStats(
  moduleData: {
    sections?: any[];
    key_takeaways?: any[];
    evidence_index?: any[];
  } | null,
  quizQuestions: number,
  limits: Limits,
): { label: string; actual: number; limit: number }[] {
  if (!moduleData) return [];

  const sections = moduleData.sections || [];
  const wordCount = sections.reduce(
    (acc: number, s: any) => acc + (s.markdown?.split(/\s+/).length || 0),
    0
  );
  const citationCount = sections.reduce(
    (acc: number, s: any) => acc + (s.citations?.length || 0),
    0
  );
  const takeaways = moduleData.key_takeaways?.length || 0;

  return [
    { label: "Word count", actual: wordCount, limit: limits.max_module_words },
    { label: "Sections", actual: sections.length, limit: limits.max_key_takeaways }, // sections uses max_sections_hint but that's in gen_prefs
    { label: "Citations", actual: citationCount, limit: limits.max_spans_to_cite },
    { label: "Quiz questions", actual: quizQuestions, limit: limits.max_quiz_questions },
    { label: "Key takeaways", actual: takeaways, limit: limits.max_key_takeaways },
  ];
}
