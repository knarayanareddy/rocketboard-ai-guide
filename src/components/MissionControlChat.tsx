import { Compass, Send, X, User, Loader2, Trash2, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Flag, BookOpen, MoreVertical, MessageSquarePlus, BookText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation, useNavigate } from "react-router-dom";
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
import { useTheme } from "@/hooks/useTheme";
import { useTour } from "@/hooks/useTour";
import { sendAITask, AIError } from "@/lib/ai-client";
import { buildGlobalChatEnvelope } from "@/lib/envelope-builder";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";
import { PLATFORM_KNOWLEDGE, CONTEXTUAL_SUGGESTIONS, getPageContext } from "@/data/platform-knowledge";
import { HELP_ARTICLES } from "@/data/help-content";
import { ChatReportDialog } from "@/components/ChatReportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SaveAsFaqDialog } from "@/components/SaveAsFaqDialog";
import { SaveAsGlossaryDialog } from "@/components/SaveAsGlossaryDialog";
import { trackQuestionSuggestion } from "@/hooks/useFaqSuggestions";
import type { ReferencedSection, ChatResponse } from "@/components/ModuleChatPanel";

type Msg = { role: "user" | "assistant"; content: string; response?: ChatResponse };

function getSuggestedQuestions(pathname: string): string[] {
  const ctx = getPageContext(pathname);
  const suggestions = CONTEXTUAL_SUGGESTIONS[ctx] || CONTEXTUAL_SUGGESTIONS.default;
  return suggestions.questions;
}

// ─── Sub-component: sources panel shown per-message ───
function MessageSources({
  response,
  packId,
  messages,
}: {
  response: ChatResponse;
  packId: string | null;
  messages: Msg[];
}) {
  const navigate = useNavigate();
  const hasSpans = (response.referenced_spans?.length ?? 0) > 0;
  const hasSections = (response.referenced_sections?.length ?? 0) > 0;
  const hasUnverified = (response.unverified_claims?.length ?? 0) > 0;

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [glossaryDialogOpen, setGlossaryDialogOpen] = useState(false);

  // Find the previous user message for FAQ Question context
  const assistantMsgIndex = messages.findIndex(m => m.response === response);
  const previousUserMsg = assistantMsgIndex > 0 ? messages[assistantMsgIndex - 1] : null;
  const initialFaqQuestion = previousUserMsg?.role === "user" ? previousUserMsg.content : "";

  const openSection = (sec: ReferencedSection) => {
    if (packId) {
      navigate(`/packs/${packId}/modules/${sec.module_key}#section=${sec.section_id}`);
    }
  };

  const topSection = response.referenced_sections?.[0];

  if (!hasSpans && !hasSections && !hasUnverified && !response.contradictions?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* ── Not Fully Verified ── */}
      {hasUnverified && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            Not fully verified
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-200">
            {response.unverified_claims!.map((c, i) => (
              <li key={i}>{c.claim} — <span className="opacity-75">{c.reason}</span></li>
            ))}
          </ul>
          {response.suggested_search_queries && response.suggested_search_queries.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {response.suggested_search_queries.map((q) => (
                <span key={q} className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] cursor-default">
                  🔍 {q}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Contradictions ── */}
      {response.contradictions && response.contradictions.length > 0 && (
        <ContradictionInline contradictions={response.contradictions} />
      )}

      {/* ── Top section shortcut ── */}
      {topSection && !sourcesOpen && (
        <div>
          <button
            onClick={() => openSection(topSection)}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <BookOpen className="w-2.5 h-2.5" />
            Open in module: {topSection.section_heading}
          </button>
        </div>
      )}

      {/* ── Show sources toggle ── */}
      {(hasSpans || hasSections) && (
        <div>
          <button
            onClick={() => setSourcesOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {sourcesOpen ? "Hide sources" : "Show sources"}
            {!sourcesOpen && (
              <span className="ml-1 text-primary">
                ({(response.referenced_spans?.length ?? 0) + (response.referenced_sections?.length ?? 0)})
              </span>
            )}
          </button>

          <AnimatePresence>
            {sourcesOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  {hasSpans && (
                    <div className="flex flex-wrap gap-1">
                      {response.referenced_spans!.map((span) => (
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

                  {hasSections && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium">Related sections:</p>
                      {response.referenced_sections!.map((sec) => (
                        <button
                          key={sec.section_id}
                          onClick={() => openSection(sec)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/5 text-primary border border-primary/15 hover:bg-primary/15 transition-colors"
                        >
                          <BookOpen className="w-2.5 h-2.5" />
                          {sec.module_key !== "__mission_control__" && (
                            <span className="text-muted-foreground">{sec.module_key} →</span>
                          )}
                          {sec.section_heading}
                          <ExternalLink className="w-2 h-2 ml-0.5 opacity-60" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Action Menu ── */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <MoreVertical className="w-3 h-3" /> Actions
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 text-xs">
            <DropdownMenuItem onClick={() => setFaqDialogOpen(true)} className="gap-2">
              <MessageSquarePlus className="w-3.5 h-3.5 text-blue-500" /> Save as FAQ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGlossaryDialogOpen(true)} className="gap-2">
              <BookText className="w-3.5 h-3.5 text-amber-500" /> Save as Glossary Term
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() => setReportOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-amber-500 transition-colors ml-auto"
        >
          <Flag className="w-2.5 h-2.5" />
          Report
        </button>
      </div>

      <ChatReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        messageContent={response.response_markdown}
        context={{
          pathname: location.pathname,
          pack_id: packId,
          transcript: messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
        }}
      />

      <SaveAsFaqDialog
        open={faqDialogOpen}
        onClose={() => setFaqDialogOpen(false)}
        initialQuestion={initialFaqQuestion}
        initialAnswer={messages[assistantMsgIndex]?.content || ""}
        source="chat"
      />
      <SaveAsGlossaryDialog
        open={glossaryDialogOpen}
        onClose={() => setGlossaryDialogOpen(false)}
        source="chat"
      />
    </div>
  );
}

export function MissionControlChat() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const { setMode } = useTheme();
  const { startTour } = useTour();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [lastError, setLastError] = useState<AIError | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageContext = getPageContext(location.pathname);
  const suggestedQuestions = getSuggestedQuestions(location.pathname);

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
    setLastError(null);

    if (user) {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        module_id: "__mission_control__",
        role: "user",
        content: text,
        pack_id: currentPackId || null,
      });
    if (user && currentPackId) {
      trackQuestionSuggestion(currentPackId, text);
    }

    try {
      const spans = currentPackId ? await fetchEvidenceSpans(currentPackId, text) : [];

      const platformContext = {
        platform_knowledge: PLATFORM_KNOWLEDGE,
        help_articles_summary: HELP_ARTICLES.map(a => `- ${a.title}: ${a.summary}`).join('\n'),
        current_page: location.pathname,
        current_page_context: pageContext,
        user_role: packAccessLevel,
      };

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
        platformContext,
      });

      const result = await sendAITask(envelope);
      const responseMarkdown = result.response_markdown || "No response received.";
      const typedResult = result as ChatResponse;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: responseMarkdown, response: typedResult },
      ]);

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
      {/* FAB — bottom-left */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className={`fixed z-50 ${isMobile ? "bottom-4 left-4" : "bottom-6 left-20"}`}>
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className={`rounded-full shadow-lg bg-accent text-accent-foreground border border-border hover:bg-accent/80 ${isMobile ? "h-12 w-12" : "h-14 w-14"}`}
              title="Mission Control — General Assistant"
            >
              <Compass className={isMobile ? "w-5 h-5" : "w-6 h-6"} />
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
            className={`fixed z-50 bg-card border border-border shadow-2xl flex flex-col overflow-hidden ${
              isMobile
                ? "inset-0 rounded-none"
                : "bottom-6 left-20 w-[400px] h-[580px] rounded-2xl"
            }`}
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
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
              {messages.length === 0 && historyLoaded && !lastError && (
                <div className="text-center py-8">
                  <Compass className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">Mission Control</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Ask about the platform, features, onboarding flow, or anything about{" "}
                    <strong className="text-foreground">{currentPack?.title || "your pack"}</strong>
                  </p>
                  <div className="space-y-2">
                    {suggestedQuestions.map((q) => (
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
                  <div className="flex flex-col min-w-0 max-w-[85%]">
                    <div
                      className={`rounded-xl px-3 py-2 text-sm overflow-hidden ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all [&_pre_code]:break-normal">
                          <MarkdownRenderer onAction={(slug) => {
                            if (slug === 'theme_dark') { setMode('dark'); return true; }
                            if (slug === 'theme_light') { setMode('light'); return true; }
                            if (slug === 'start_tour') { startTour('platform-overview'); return true; }
                            return false;
                          }}>
                            {msg.content}
                          </MarkdownRenderer>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {/* Per-message sources, sections, report */}
                    {msg.role === "assistant" && msg.response && (
                      <div className="ml-1 mt-1">
                        <MessageSources
                          response={msg.response}
                          packId={currentPackId ?? null}
                          messages={messages}
                        />
                      </div>
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
