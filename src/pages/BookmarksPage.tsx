import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBookmarks, BookmarkType } from "@/hooks/useBookmarks";
import { useNavigate } from "react-router-dom";
import { usePack } from "@/hooks/usePack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, BookOpen, BookText, Route, MessageSquareMore, Trash2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const TYPE_META: Record<BookmarkType, { label: string; icon: typeof BookOpen; color: string }> = {
  module_section: { label: "Module Section", icon: BookOpen, color: "text-primary" },
  glossary_term: { label: "Glossary Term", icon: BookText, color: "text-accent-foreground" },
  path_step: { label: "Path Step", icon: Route, color: "text-accent-foreground" },
  ask_lead_question: { label: "Ask Lead Question", icon: MessageSquareMore, color: "text-accent-foreground" },
};

export default function BookmarksPage() {
  const { bookmarks, isLoading, removeBookmark } = useBookmarks();
  const { currentPackId } = usePack();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<BookmarkType | "all">("all");

  const filtered = useMemo(() =>
    filter === "all" ? bookmarks : bookmarks.filter(b => b.bookmark_type === filter),
    [bookmarks, filter]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookmarks) counts[b.bookmark_type] = (counts[b.bookmark_type] ?? 0) + 1;
    return counts;
  }, [bookmarks]);

  const handleNavigate = (b: typeof bookmarks[0]) => {
    const prefix = `/packs/${currentPackId}`;
    switch (b.bookmark_type) {
      case "module_section": {
        const [moduleKey] = b.reference_key.split(":");
        navigate(`${prefix}/modules/${moduleKey}`);
        break;
      }
      case "glossary_term":
        navigate(`${prefix}/glossary`);
        break;
      case "path_step":
        navigate(`${prefix}/paths`);
        break;
      case "ask_lead_question":
        navigate(`${prefix}/ask-lead`);
        break;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-primary" /> Saved Items
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{bookmarks.length} bookmarked items</p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All ({bookmarks.length})
          </Button>
          {(Object.keys(TYPE_META) as BookmarkType[]).map(type => (
            <Button key={type} variant={filter === type ? "default" : "outline"} size="sm" onClick={() => setFilter(type)}>
              {TYPE_META[type].label} ({typeCounts[type] ?? 0})
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No bookmarks yet. Save items from modules, glossary, paths, or Ask Lead.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b, i) => {
              const meta = TYPE_META[b.bookmark_type as BookmarkType];
              const Icon = meta?.icon ?? BookOpen;
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => handleNavigate(b)}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${meta?.color ?? "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{b.label ?? b.reference_key}</p>
                    <span className="text-[10px] text-muted-foreground">{meta?.label ?? b.bookmark_type}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground shrink-0"
                    onClick={(e) => { e.stopPropagation(); removeBookmark.mutate(b.id, { onSuccess: () => toast.success("Removed") }); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
