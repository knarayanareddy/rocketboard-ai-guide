import ReactMarkdown from "react-markdown";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeCallout, CalloutType } from "@/components/CodeCallout";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

// Parse custom callout syntax :::type[title]\n...\n:::
function parseCallouts(markdown: string): Array<{ type: "text" | "callout"; content: string; calloutType?: CalloutType; title?: string }> {
  const parts: Array<{ type: "text" | "callout"; content: string; calloutType?: CalloutType; title?: string }> = [];
  
  // Regex to match :::type[title]\n...\n:::
  const calloutRegex = /:::(setup|pattern|config|warning)\[([^\]]*)\]\n([\s\S]*?):::/g;
  
  let lastIndex = 0;
  let match;

  while ((match = calloutRegex.exec(markdown)) !== null) {
    // Add text before this callout
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: markdown.slice(lastIndex, match.index) });
    }
    
    // Add the callout
    parts.push({
      type: "callout",
      calloutType: match[1] as CalloutType,
      title: match[2],
      content: match[3].trim(),
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
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

export function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  const parts = parseCallouts(children);
  
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
        return (
          <ReactMarkdown key={i} components={components}>{part.content}</ReactMarkdown>
        );
      })}
    </div>
  );
}
