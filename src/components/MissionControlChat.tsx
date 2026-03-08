import { useState, useRef, useEffect, useCallback } from "react";
import { Compass, Send, X, Bot, User, Loader2, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { ContradictionInline } from "@/components/ContradictionCallout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask, AIError } from "@/lib/ai-client";
import { buildGlobalChatEnvelope } from "@/lib/envelope-builder";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";

type Msg = { role: "user" | "assistant"; content: string };

interface ChatResponse {
  response_markdown: string;
  referenced_spans?: { span_id: string; path: string; chunk_id: string }[];
  unverified_claims?: { claim: string; reason: string }[];
  contradictions?: any[];
  suggested_search_queries?: string[];
  warnings?: string[];
}

const SUGGESTED_QUESTIONS = [
  "What features does this platform have?",
  "How do I get started with onboarding?",
  "What modules are available?",
  "How does the AI generation work?",
];

export function MissionControlChat() {
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

  // Load chat history
  useEffect(() => {
    if (!isOpen || !user || historyLoaded) return;
    (async () => {
      const q = supabase
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", user.id)
        .eq("module_id", "__mission_control__")
        .order("created_at", { ascending: true });

      const { data } = currentPackId
        ? await q.eq("pack_id", currentPackId)
        : await q;

      if (data && data.length > 0) {
        setMessages(data.map((d) => ({ role: d.role as "user" | "assistant", content: d.content })));
      }
      setHistoryLoaded(true);
    })();
  }, [isOpen, user, historyLoaded, currentPackId]);

  // Reset on pack change
  useEffect(() => {
    setMessages([]);
    setHistoryLoaded(false);
    setLastResponse(null);
    setLastError(null);
  }, [currentPackId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, lastError, scrollToBottom]);

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id).eq("module_id", "__mission_control__");
    setMessages([]);
    setLastResponse(null);
    setLastError(null);
    toast.success("Mission Control history cleared");
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

    if (user) {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        module_id: "__mission_control__",
        role: "user",
        content: text,
        pack_id: currentPackId || null,
      });
    }

    try {
      const spans = currentPackId ? await fetchEvidenceSpans(currentPackId, text) : [];

      const envelope = buildGlobalChatEnvelope({
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
        query: text,
      });

      const result = await sendAITask(envelope);
      const responseMarkdown = result.response_markdown || "No response received.";

      setMessages((prev) => [...prev, { role: "assistant", content: responseMarkdown }]);
      setLastResponse(result as ChatResponse);

      if (user) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          module_id: "__mission_control__",
          role: "assistant",
          content: responseMarkdown,
          pack_id: currentPackId || null,
        });
      }
    } catch (e: any) {
      if (e instanceof AIError) {
        setLastError(e);
      } else {
        setLastError(new AIError({
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
      {/* FAB — bottom-left to avoid collision with module-level Rocket */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="fixed bottom-6 left-20 z-50">
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="rounded-full h-14 w-14 shadow-lg bg-accent text-accent-foreground border border-border hover:bg-accent/80"
              title="Mission Control — General Assistant"
            >
              <Compass className="w-6 h-6" />
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
            className="fixed bottom-6 left-20 z-50 w-[380px] h-[560px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-accent/30">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm text-foreground">🧭 Mission Control</span>
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
                  <Compass className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">Mission Control</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Ask about the platform, features, onboarding flow, or anything about{" "}
                    <strong className="text-foreground">{currentPack?.title || "your pack"}</strong>
                  </p>
                  <div className="space-y-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-muted-foreground"
                      >
                        🧭 {q}
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
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-1">
                      <Compass className="w-3.5 h-3.5 text-primary" />
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

              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Compass className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}

              {lastError && !isLoading && (
                <div className="ml-8">
                  <AIErrorDisplay error={lastError} compact onRetry={send} onSearchQuery={(q) => setInput(q)} />
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

                  {lastResponse.contradictions && lastResponse.contradictions.length > 0 && (
                    <ContradictionInline contradictions={lastResponse.contradictions} />
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
                  placeholder="Ask Mission Control..."
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
