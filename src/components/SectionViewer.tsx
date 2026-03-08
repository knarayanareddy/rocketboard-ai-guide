import { Section, Track } from "@/data/onboarding-data";
import { TrackBadge } from "./TrackBadge";
import { StickyNote, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface SectionViewerProps {
  section: Section;
  index: number;
  isRead: boolean;
  onMarkRead: () => void;
}

export function SectionViewer({ section, index, isRead, onMarkRead }: SectionViewerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={`border rounded-xl p-6 transition-all duration-300 ${
        isRead
          ? "bg-card/50 border-primary/20"
          : "bg-card border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
            §{index + 1}
          </span>
          <h3 className="font-semibold text-card-foreground">{section.title}</h3>
        </div>
        <button
          onClick={onMarkRead}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
            isRead
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {isRead ? "Read" : "Mark as read"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {section.tracks.map((t) => (
          <TrackBadge key={t} track={t} />
        ))}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>

      {section.notes && (
        <div className="mt-4 flex items-start gap-2 bg-accent/10 border border-accent/20 rounded-lg p-3">
          <StickyNote className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-accent font-medium">{section.notes}</p>
        </div>
      )}
    </motion.div>
  );
}
