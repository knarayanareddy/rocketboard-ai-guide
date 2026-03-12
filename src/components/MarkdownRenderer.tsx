import ReactMarkdown from "react-markdown";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeCallout, CalloutType } from "@/components/CodeCallout";
import type { Components } from "react-markdown";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Sparkles } from "lucide-react";

interface MarkdownRendererProps {
  children: string;
  className?: string;
  onAction?: (slug: string) => boolean | void;
}

// Parse custom callout syntax :::type[title]\n...\n::: and [ACTION: slug(label)]
type Part = { 
  type: "text" | "callout" | "action" | "ui_action"; 
  content: string; 
  calloutType?: CalloutType; 
  title?: string;
  actionSlug?: string;
};

function parseMarkdown(markdown: string): Part[] {
  const parts: Part[] = [];
  
  // Combined regex for callouts and actions
  // Callouts: :::type[title]\n...\n:::
  // Actions: [ACTION: slug(label)] or [UI_ACTION: slug(label)]
  const combinedRegex = /(?::::(setup|pattern|config|warning)\[([^\]]*)\]\n([\s\S]*?):::)|(?:\[(ACTION|UI_ACTION): ([^(\]]+)(?:\(([^)]+)\))?\])/g;
  
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: markdown.slice(lastIndex, match.index) });
    }
    
    if (match[1]) {
      // Callout match
      parts.push({
        type: "callout",
        calloutType: match[1] as CalloutType,
        title: match[2],
        content: match[3].trim(),
      });
    } else if (match[4]) {
      // Action or UI_ACTION match
      parts.push({
        type: match[4] === "UI_ACTION" ? "ui_action" : "action",
        actionSlug: match[5],
        content: match[6] || "Take Action",
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < markdown.length) {
    parts.push({ type: "text", content: markdown.slice(lastIndex) });
  }
  
  return parts.length > 0 ? parts : [{ type: "text", content: markdown }];
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const content = String(children).replace(/\n$/, "");

    if (lang === "mermaid") {
      return <MermaidDiagram code={content} />;
    }

    // Inline code (no language class and no newlines typically)
    if (!className) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    // Block code
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export function MarkdownRenderer({ children, className, onAction }: MarkdownRendererProps) {
  const parts = parseMarkdown(children);
  const navigate = useNavigate();
  const { packId } = useParams();

  const handleAction = (slug: string) => {
    // Check if parent wants to handle it
    if (onAction && onAction(slug) === true) return;

    if (!packId) return;

    switch (slug) {
      case 'connect_github':
        navigate(`/packs/${packId}/sources?action=open_github_modal`);
        break;
      case 'generate_plan':
        navigate(`/packs/${packId}/plan?action=start_generation`);
        break;
      case 'open_sandbox':
        navigate(`/packs/${packId}/sandbox`);
        break;
      case 'navigate_plan':
        navigate(`/packs/${packId}/plan`);
        break;
      case 'navigate_sources':
        navigate(`/packs/${packId}/sources`);
        break;
      case 'open_help':
        navigate(`/help`);
        break;
      default:
        console.warn(`Unknown action slug: ${slug}`);
    }
  };
  
  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.type === "callout" && part.calloutType) {
          return (
            <CodeCallout key={i} type={part.calloutType} title={part.title || ""}>
              <ReactMarkdown components={components}>{part.content}</ReactMarkdown>
            </CodeCallout>
          );
        }
        if ((part.type === "action" || part.type === "ui_action") && part.actionSlug) {
          return (
            <div key={i} className="my-4">
              <Button 
                onClick={() => handleAction(part.actionSlug!)}
                className={`gap-2 border-0 shadow-lg transition-all font-semibold ${
                  part.type === "ui_action" 
                    ? "bg-accent text-accent-foreground hover:bg-accent/80" 
                    : "gradient-primary text-primary-foreground hover:shadow-primary/20"
                }`}
              >
                {part.type === "ui_action" ? <Sparkles className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 fill-current" />}
                {part.content}
              </Button>
            </div>
          );
        }
        return (
          <ReactMarkdown key={i} components={components}>{part.content}</ReactMarkdown>
        );
      })}
    </div>
  );
}
