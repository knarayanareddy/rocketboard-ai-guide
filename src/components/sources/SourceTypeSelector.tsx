import { Github, FileText, Database, Cloud, FolderOpen, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SourceType = 
  | "github_repo" 
  | "document" 
  | "confluence" 
  | "notion" 
  | "google_drive" 
  | "sharepoint"
  | "openapi_spec"
  | "postman_collection"
  | "jira"
  | "linear"
  | "figma"
  | "slack_channel"
  | "loom_video";

interface SourceTypeOption {
  type: SourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  available: boolean;
}

const SOURCE_TYPES: SourceTypeOption[] = [
  {
    type: "github_repo",
    label: "GitHub",
    description: "Repository",
    icon: <Github className="w-6 h-6" />,
    color: "bg-gray-800 text-white",
    available: true,
  },
  {
    type: "confluence",
    label: "Confluence",
    description: "Wiki pages",
    icon: <Cloud className="w-6 h-6" />,
    color: "bg-blue-600 text-white",
    available: true,
  },
  {
    type: "notion",
    label: "Notion",
    description: "Pages & databases",
    icon: <FileText className="w-6 h-6" />,
    color: "bg-gray-900 text-white",
    available: true,
  },
  {
    type: "google_drive",
    label: "Google Drive",
    description: "Docs & files",
    icon: <FolderOpen className="w-6 h-6" />,
    color: "bg-yellow-500 text-gray-900",
    available: true,
  },
  {
    type: "sharepoint",
    label: "SharePoint",
    description: "Documents",
    icon: <Share2 className="w-6 h-6" />,
    color: "bg-blue-500 text-white",
    available: true,
  },
  {
    type: "document",
    label: "Document",
    description: "Paste content",
    icon: <Database className="w-6 h-6" />,
    color: "bg-primary text-primary-foreground",
    available: true,
  },
];

interface SourceTypeSelectorProps {
  onSelect: (type: SourceType) => void;
}

export function SourceTypeSelector({ onSelect }: SourceTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {SOURCE_TYPES.map((option, i) => (
        <motion.button
          key={option.type}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => option.available && onSelect(option.type)}
          disabled={!option.available}
          className={cn(
            "relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all",
            option.available
              ? "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              : "border-border/50 opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-2", option.color)}>
            {option.icon}
          </div>
          <span className="text-sm font-medium text-foreground">{option.label}</span>
          <span className="text-xs text-muted-foreground">{option.description}</span>
          {!option.available && (
            <span className="absolute top-2 right-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">
              Soon
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}

export function getSourceTypeIcon(type: string) {
  switch (type) {
    case "github_repo":
      return <Github className="w-4 h-4" />;
    case "confluence":
      return <Cloud className="w-4 h-4 text-blue-500" />;
    case "notion":
      return <FileText className="w-4 h-4" />;
    case "google_drive":
      return <FolderOpen className="w-4 h-4 text-yellow-500" />;
    case "sharepoint":
      return <Share2 className="w-4 h-4 text-blue-400" />;
    case "document":
      return <Database className="w-4 h-4" />;
    default:
      return <Database className="w-4 h-4" />;
  }
}

export function getSourceTypeLabel(type: string) {
  switch (type) {
    case "github_repo":
      return "GitHub Repository";
    case "confluence":
      return "Confluence";
    case "notion":
      return "Notion";
    case "google_drive":
      return "Google Drive";
    case "sharepoint":
      return "SharePoint";
    case "document":
      return "Document";
    default:
      return type;
  }
}
