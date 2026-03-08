import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CitationBadgeProps {
  spanId: string;
  path?: string;
  chunkId?: string;
  startLine?: number;
  endLine?: number;
  verified?: boolean; // true = verified, false = flagged, undefined = unknown/default
  verificationWarning?: string;
}

export function CitationBadge({ spanId, path, chunkId, startLine, endLine, verified, verificationWarning }: CitationBadgeProps) {
  const tooltipContent = [
    path && `Path: ${path}`,
    chunkId && `Chunk: ${chunkId}`,
    startLine != null && endLine != null && `Lines: ${startLine}-${endLine}`,
    verified === false && (verificationWarning || "⚠ Unverified citation"),
  ]
    .filter(Boolean)
    .join("\n");

  const isFlagged = verified === false;
  const isVerified = verified === true;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-help transition-colors",
            isVerified && "bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20 dark:text-green-400",
            isFlagged && "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 hover:bg-yellow-500/20 dark:text-yellow-400",
            !isVerified && !isFlagged && "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
          )}
        >
          {isFlagged ? <AlertTriangle className="w-2.5 h-2.5" /> : <ExternalLink className="w-2.5 h-2.5" />}
          {spanId}
        </span>
      </TooltipTrigger>
      {tooltipContent && (
        <TooltipContent side="top" className="max-w-xs text-xs whitespace-pre-line">
          {tooltipContent}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
