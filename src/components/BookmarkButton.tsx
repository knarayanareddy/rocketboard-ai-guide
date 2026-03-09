import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookmarks, BookmarkType } from "@/hooks/useBookmarks";
import { toast } from "sonner";

interface BookmarkButtonProps {
  type: BookmarkType;
  referenceKey: string;
  label?: string;
  size?: "sm" | "icon";
}

export function BookmarkButton({ type, referenceKey, label, size = "icon" }: BookmarkButtonProps) {
  const { toggleBookmark, isBookmarked } = useBookmarks();
  const saved = isBookmarked(type, referenceKey);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark.mutate(
      { type, referenceKey, label },
      { onSuccess: () => toast.success(saved ? "Bookmark removed" : "Bookmarked") }
    );
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 w-7 p-0 ${saved ? "text-primary" : "text-muted-foreground"}`}
      onClick={handleClick}
    >
      <Bookmark className={`w-3.5 h-3.5 ${saved ? "fill-primary" : ""}`} />
    </Button>
  );
}
