import { modules } from "@/data/onboarding-data";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";

interface ProgressChartProps {
  getProgress: (moduleId: string) => number;
}

export function ProgressChart({ getProgress }: ProgressChartProps) {
  const data = modules.map((mod) => ({
    module: mod.title.length > 14 ? mod.title.slice(0, 14) + "…" : mod.title,
    progress: getProgress(mod.id),
    fullMark: 100,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-semibold text-card-foreground mb-1">Progress Radar</h3>
      <p className="text-xs text-muted-foreground mb-4">Your completion across all modules</p>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="module"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "Space Grotesk" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickCount={5}
          />
          <Radar
            name="Progress"
            dataKey="progress"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "JetBrains Mono",
              color: "hsl(var(--card-foreground))",
            }}
            formatter={(value: number) => [`${value}%`, "Progress"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
