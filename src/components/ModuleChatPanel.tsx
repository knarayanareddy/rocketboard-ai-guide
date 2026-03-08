import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send, X, Bot, User, Loader2, Trash2, AlertTriangle, ExternalLink, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask, AIError } from "@/lib/ai-client";
import { buildChatEnvelope } from "@/lib/envelope-builder";
import type { EvidenceSpan } from "@/hooks/useEvidenceSpans";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";

type Msg = { role: "user" | "assistant"; content: string };

interface ChatResponse {
  response_markdown: string;
  referenced_spans?: { span_id: string; path: string; chunk_id: string }[];
  unverified_claims?: { claim: string; reason: string }[];
  contradictions?: { description: string }[];
  suggested_search_queries?: string[];
  warnings?: string[];
}

interface ModuleContext {
  title: string;
  description: string;
  keyTakeaways: string[];
  sections: { title: string; content: string }[];
}

interface ModuleChatPanelProps {
  moduleId: string;
  moduleContext: ModuleContext;
}

async function saveMessage(userId: string, moduleId: string, role: string, content: string, packId?: string) {
  await supabase.from("chat_messages").insert({
    user_id: userId,
    module_id: moduleId,
    role,
    content,
    pack_id: packId || null,
  });
}

// Evidence spans fetched via shared helper (imported at top)

export function ModuleChatPanel({ moduleId, moduleContext }: ModuleChatPanelProps) {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [lastError, setLastError] = useState<AIError | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !user || historyLoaded) return;
    (async () => {
      const q = supabase
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", user.id)
        .eq("module_id", moduleId)
        .order("created_at", { ascending: true });
      
      const { data } = currentPackId
        ? await q.eq("pack_id", currentPackId)
        : await q;

      if (data && data.length > 0) {
        setMessages(data.map((d) => ({ role: d.role as "user" | "assistant", content: d.content })));
      }
      setHistoryLoaded(true);
    })();
  }, [isOpen, user, moduleId, historyLoaded, currentPackId]);

  useEffect(() => {
    setMessages([]);
    setHistoryLoaded(false);
    setLastResponse(null);
    setLastError(null);
  }, [moduleId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, lastResponse, lastError, scrollToBottom]);

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id).eq("module_id", moduleId);
    setMessages([]);
    setLastResponse(null);
    setLastError(null);
    toast.success("Chat history cleared");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    setLastResponse(null);
    setLastError(null);

    if (user) saveMessage(user.id, moduleId, "user", text, currentPackId);

    try {
      const spans = currentPackId ? await fetchEvidenceSpans(currentPackId, text) : [];

      const envelope = buildChatEnvelope({
        auth: {
          user_id: user?.id || null,
          org_id: currentPack?.org_id || null,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: currentPackId,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        messages: allMessages,
        evidenceSpans: spans,
        moduleKey: moduleId,
        query: text,
      });

      const result = await sendAITask(envelope);
      const responseMarkdown = result.response_markdown || "No response received.";

      setMessages((prev) => [...prev, { role: "assistant", content: responseMarkdown }]);
      setLastResponse(result as ChatResponse);

      if (user) saveMessage(user.id, moduleId, "assistant", responseMarkdown, currentPackId);
    } catch (e: any) {
      if (e instanceof AIError) {
        setLastError(e);
      } else {
        setLastError(new (await import("@/lib/ai-errors")).AIError({
          code: "network_error",
          message: e.message || "Failed to get response",
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="fixed bottom-6 right-6 z-50">
            <Button onClick={() => setIsOpen(true)} size="lg" className="rounded-full h-14 w-14 shadow-lg gradient-primary border-0" title="Rocket — Module Assistant">
              <Rocket className="w-6 h-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[560px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm text-foreground">🚀 Rocket — Module Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={clearHistory} title="Clear history">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && historyLoaded && !lastError && (
                <div className="text-center py-8">
                  <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Ask anything about <strong className="text-foreground">{moduleContext.title}</strong>
                  </p>
                  <div className="mt-4 space-y-2">
                    {["Summarize the key concepts", "What should I focus on?", "Explain the main takeaways"].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-muted-foreground"
                      >
                        💡 {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!historyLoaded && isOpen && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                        <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* AI Error inline */}
              {lastError && !isLoading && (
                <div className="ml-8">
                  <AIErrorDisplay error={lastError} compact onSearchQuery={(q) => setInput(q)} />
                </div>
              )}

              {/* Structured response extras */}
              {lastResponse && !isLoading && !lastError && (
                <div className="space-y-2 ml-8">
                  {lastResponse.referenced_spans && lastResponse.referenced_spans.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {lastResponse.referenced_spans.map((span) => (
                        <span
                          key={span.span_id}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                          title={span.path}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {span.span_id}
                        </span>
                      ))}
                    </div>
                  )}

                  {lastResponse.unverified_claims && lastResponse.unverified_claims.length > 0 && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                      <div className="flex items-center gap-1 font-medium mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        Unverified claims
                      </div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {lastResponse.unverified_claims.map((c, i) => (
                          <li key={i}>{c.claim} — <span className="opacity-75">{c.reason}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {lastResponse.contradictions && lastResponse.contradictions.length > 0 && (
                    <div className="space-y-2">
                      {lastResponse.contradictions.map((c: any, i: number) => (
                        <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                          <div className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300 mb-1">
                            <AlertTriangle className="w-3 h-3" />
                            {c.topic || "Contradiction detected"}
                          </div>
                          {c.side_a && c.side_b ? (
                            <div className="space-y-1 text-muted-foreground">
                              <p><span className="font-medium">View A:</span> {c.side_a.claim}</p>
                              <p><span className="font-medium">View B:</span> {c.side_b.claim}</p>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">{c.description || JSON.stringify(c)}</p>
                          )}
                          {c.how_to_resolve && c.how_to_resolve.length > 0 && (
                            <p className="text-muted-foreground mt-1 italic">Resolve: {c.how_to_resolve.join("; ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" className="h-9 w-9 rounded-lg" disabled={isLoading || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
