import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { glossaryTerms } from "@/data/glossary-data";
import { TRACKS, Track } from "@/data/onboarding-data";
import { TrackBadge } from "@/components/TrackBadge";
import { Search, BookText } from "lucide-react";
import { motion } from "framer-motion";

export default function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<Track | "all">("all");

  const filtered = useMemo(() => {
    return glossaryTerms
      .filter((t) => {
        const matchesSearch =
          !search ||
          t.term.toLowerCase().includes(search.toLowerCase()) ||
          t.definition.toLowerCase().includes(search.toLowerCase());
        const matchesTrack = trackFilter === "all" || t.tracks.includes(trackFilter);
        return matchesSearch && matchesTrack;
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [search, trackFilter]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Glossary</h1>
          </div>
          <p className="text-sm text-muted-foreground">Key terms and definitions used across the codebase and team.</p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search terms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTrackFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                trackFilter === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
              }`}
            >
              All
            </button>
            {TRACKS.map((t) => (
              <button key={t.key} onClick={() => setTrackFilter(t.key)} className={`transition-opacity ${trackFilter !== "all" && trackFilter !== t.key ? "opacity-40" : ""}`}>
                <TrackBadge track={t.key} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((term, i) => (
            <motion.div
              key={term.term}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-card-foreground font-mono text-sm">{term.term}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{term.definition}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2 italic">{term.context}</p>
                </div>
                <div className="flex flex-wrap gap-1 shrink-0">
                  {term.tracks.map((t) => (
                    <TrackBadge key={t} track={t} />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No terms match your search.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
