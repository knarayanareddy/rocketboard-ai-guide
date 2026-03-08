import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink } from "lucide-react";

interface CitationBadgeProps {
  spanId: string;
  path?: string;
  chunkId?: string;
  startLine?: number;
  endLine?: number;
}

export function CitationBadge({ spanId, path, chunkId, startLine, endLine }: CitationBadgeProps) {
  const tooltipContent = [
    path && `Path: ${path}`,
    chunkId && `Chunk: ${chunkId}`,
    startLine != null && endLine != null && `Lines: ${startLine}-${endLine}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 cursor-help hover:bg-primary/20 transition-colors">
          <ExternalLink className="w-2.5 h-2.5" />
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
