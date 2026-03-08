import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { askLeadQuestions, AskLeadQuestion } from "@/data/ask-lead-data";
import { TrackBadge } from "@/components/TrackBadge";
import { TRACKS, Track } from "@/data/onboarding-data";
import { MessageSquareMore, CheckCircle2, Circle } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "team", label: "🏠 Team" },
  { key: "technical", label: "⚙️ Technical" },
  { key: "process", label: "📋 Process" },
  { key: "culture", label: "🤝 Culture" },
] as const;

export default function AskLeadPage() {
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [trackFilter, setTrackFilter] = useState<Track | "all">("all");

  const toggleAsked = (id: string) => {
    setAsked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = askLeadQuestions.filter((q) => {
    const matchCat = categoryFilter === "all" || q.category === categoryFilter;
    const matchTrack = trackFilter === "all" || !q.track_key || q.track_key === trackFilter;
    return matchCat && matchTrack;
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquareMore className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Ask Your Lead</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            High-signal questions to ask your team lead during your first 1:1s. Check them off as you go.
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategoryFilter(c.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === c.key ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTrackFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                trackFilter === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
              }`}
            >
              All Tracks
            </button>
            {TRACKS.map((t) => (
              <button key={t.key} onClick={() => setTrackFilter(t.key)} className={`transition-opacity ${trackFilter !== "all" && trackFilter !== t.key ? "opacity-40" : ""}`}>
                <TrackBadge track={t.key} />
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-4">
          {asked.size}/{askLeadQuestions.length} questions asked
        </div>

        <div className="space-y-3">
          {filtered.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`bg-card border rounded-xl p-5 transition-all ${asked.has(q.id) ? "border-primary/20 bg-card/50" : "border-border"}`}
            >
              <div className="flex items-start gap-3">
                <button onClick={() => toggleAsked(q.id)} className="mt-0.5 shrink-0">
                  {asked.has(q.id) ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${asked.has(q.id) ? "text-muted-foreground" : "text-card-foreground"}`}>
                    {q.question}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{q.why_it_matters}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{q.category}</span>
                    {q.track_key && <TrackBadge track={q.track_key} />}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No questions match your filters.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
