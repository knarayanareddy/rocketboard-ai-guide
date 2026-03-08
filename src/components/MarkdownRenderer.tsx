import ReactMarkdown from "react-markdown";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  children: string;
  className?: string;
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
  return (
    <div className={className}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}