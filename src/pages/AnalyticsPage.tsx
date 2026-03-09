import { DashboardLayout } from "@/components/DashboardLayout";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, Users, BookOpen, CheckCircle2, Trophy, Zap, Target, Award,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

function MetricCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { hasPackPermission } = useRole();
  const { metrics, metricsLoading, leaderboard, moduleEngagement } = useAnalytics();

  if (!hasPackPermission("admin")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Admin access required to view analytics.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (metricsLoading || !metrics) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        </div>
      </DashboardLayout>
    );
  }

  const chartData = moduleEngagement.map(m => ({
    name: m.title.length > 20 ? m.title.slice(0, 18) + "…" : m.title,
    reads: m.sectionsRead,
    quizzes: m.quizzesTaken,
    score: m.avgScore,
  }));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Pack engagement & learner performance</p>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Users} label="Members" value={metrics.totalMembers} />
          <MetricCard icon={BookOpen} label="Published Modules" value={metrics.totalModules} />
          <MetricCard icon={CheckCircle2} label="Sections Read" value={metrics.totalSectionsRead} />
          <MetricCard icon={Target} label="Quizzes Taken" value={metrics.totalQuizzesTaken} sub={`Avg: ${metrics.avgQuizScore}%`} />
          <MetricCard icon={Zap} label="Total XP Earned" value={metrics.totalXpEarned} />
          <MetricCard icon={Users} label="Active Learners" value={metrics.activeLearners} />
        </div>

        {/* Module Engagement Chart */}
        {chartData.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Module Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="reads" fill="hsl(var(--primary))" name="Sections Read" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="quizzes" fill="hsl(var(--primary) / 0.5)" name="Quizzes" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" /> Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No XP activity yet.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={entry.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {i < 3 ? (
                        <Award className={`w-4 h-4 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-400" : "text-amber-600"}`} />
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{entry.displayName}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {entry.xp} XP
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
