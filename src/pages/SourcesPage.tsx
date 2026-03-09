import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedAction } from "@/components/ProtectedAction";
import { IngestionStatus } from "@/components/IngestionStatus";
import { ChunkBrowser } from "@/components/ChunkBrowser";
import { BulkImportModal } from "@/components/BulkImportModal";
import { useSources } from "@/hooks/useSources";
import { useIngestion } from "@/hooks/useIngestion";
import { useRole } from "@/hooks/useRole";
import { usePack } from "@/hooks/usePack";
import { useModulePlan } from "@/hooks/useModulePlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Database,
  Plus,
  Github,
  FileText,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function SourcesPage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { currentPack, currentPackId } = usePack();
  const { hasPackPermission } = useRole();
  const { sources, isLoading, addSource, deleteSource, chunkCounts } = useSources();
  const { triggerIngestion, hasActiveJob, jobs } = useIngestion();
  const { plan } = useModulePlan();

  const [addOpen, setAddOpen] = useState(false);
  const [sourceType, setSourceType] = useState<string>("github_repo");
  const [sourceUri, setSourceUri] = useState("");
  const [label, setLabel] = useState("");
  const [docContent, setDocContent] = useState("");

  // Track previous chunk counts for re-sync diff
  const prevChunkCountsRef = useRef<Record<string, number>>({});
  const [showFirstSyncCTA, setShowFirstSyncCTA] = useState(false);

  // Celebration: detect when a job completes
  useEffect(() => {
    const completedJobs = jobs.filter(j => j.status === "completed");
    if (completedJobs.length === 0) return;

    const latestCompleted = completedJobs[0];
    const shownKey = `celebration_shown_${latestCompleted.id}`;
    if (sessionStorage.getItem(shownKey)) return;
    sessionStorage.setItem(shownKey, "true");

    // Count total chunks
    const totalChunks = Object.values(chunkCounts).reduce((a, b) => a + b, 0);

    // Re-sync diff
    const prevCounts = prevChunkCountsRef.current;
    const sourceId = latestCompleted.source_id;
    if (sourceId && prevCounts[sourceId] !== undefined) {
      const oldCount = prevCounts[sourceId];
      const newCount = chunkCounts[sourceId] || 0;
      const diff = newCount - oldCount;
      if (diff !== 0) {
        toast.info(`Re-sync complete: ${newCount} chunks (${diff > 0 ? `+${diff}` : diff} change${Math.abs(diff) > 1 ? "s" : ""})`);
      }
    }

    toast.success(`✅ Synced! ${totalChunks} knowledge chunks indexed`);

    // Check if this is the first ever sync for the pack
    const allSources = sources.filter(s => s.last_synced_at);
    const isFirst = allSources.length <= 1 && !plan;
    if (isFirst) setShowFirstSyncCTA(true);
  }, [jobs, chunkCounts, sources, plan]);

  // Store chunk counts before sync
  useEffect(() => {
    if (Object.keys(chunkCounts).length > 0) {
      prevChunkCountsRef.current = { ...chunkCounts };
    }
  }, [chunkCounts]);

  if (!hasPackPermission("author")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          You need author access or higher to manage sources.
        </div>
      </DashboardLayout>
    );
  }

  const handleAddSource = async () => {
    if (!sourceUri.trim() && sourceType !== "document") {
      toast.error("Please enter a source URI");
      return;
    }
    if (sourceType === "document" && !docContent.trim()) {
      toast.error("Please enter document content");
      return;
    }

    try {
      const source = await addSource.mutateAsync({
        sourceType,
        sourceUri: sourceType === "document" ? (label || "Untitled Document") : sourceUri,
        label: label || undefined,
      });

      // Auto-trigger ingestion
      await triggerIngestion.mutateAsync({
        sourceId: source.id,
        sourceType,
        sourceUri,
        documentContent: sourceType === "document" ? docContent : undefined,
        label: label || undefined,
      });

      setAddOpen(false);
      setSourceUri("");
      setLabel("");
      setDocContent("");
      toast.success("Source added and ingestion started");
    } catch (err: any) {
      toast.error(err.message || "Failed to add source");
    }
  };

  const handleSync = async (source: any) => {
    try {
      await triggerIngestion.mutateAsync({
        sourceId: source.id,
        sourceType: source.source_type,
        sourceUri: source.source_uri,
      });
      toast.success("Ingestion started");
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      await deleteSource.mutateAsync(sourceId);
      toast.success("Source deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const sourceTypeIcon = (type: string) => {
    switch (type) {
      case "github_repo": return <Github className="w-4 h-4" />;
      case "document": return <FileText className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate(`/packs/${packId || currentPackId}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Sources</h1>
                {currentPack && (
                  <p className="text-sm text-muted-foreground">{currentPack.title}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BulkImportModal existingUris={sources.map(s => s.source_uri)} />
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Source
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Source</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Source Type</label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github_repo">
                          <span className="flex items-center gap-2"><Github className="w-3.5 h-3.5" /> GitHub Repository</span>
                        </SelectItem>
                        <SelectItem value="document">
                          <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Document</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Label</label>
                    <Input
                      placeholder="e.g., Main API Repo"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </div>

                  {sourceType === "github_repo" && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Repository URL</label>
                      <Input
                        placeholder="https://github.com/org/repo"
                        value={sourceUri}
                        onChange={(e) => setSourceUri(e.target.value)}
                      />
                    </div>
                  )}

                  {sourceType === "document" && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Document Content</label>
                      <Textarea
                        placeholder="Paste document content here..."
                        value={docContent}
                        onChange={(e) => setDocContent(e.target.value)}
                        rows={8}
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleAddSource}
                    disabled={addSource.isPending || triggerIngestion.isPending}
                    className="w-full gap-2"
                  >
                    {(addSource.isPending || triggerIngestion.isPending) && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Add & Ingest
                  </Button>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* First Sync CTA */}
          {showFirstSyncCTA && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Great! Your sources are indexed.</p>
                      <p className="text-xs text-muted-foreground">Ready to create a learning plan?</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(`/packs/${packId || currentPackId}/plan`)}
                    className="gap-2"
                    size="sm"
                  >
                    Generate Plan <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Ingestion Status */}
          <div className="mb-6">
            <IngestionStatus />
          </div>

          {/* Sources List */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No sources yet. Add a GitHub repository or document to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source, i) => (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                        {sourceTypeIcon(source.source_type)}
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground text-sm">
                          {source.label || source.source_uri}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {source.source_type === "github_repo" ? source.source_uri : "Document"}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {chunkCounts[source.id] || 0} chunks
                          </span>
                          {source.last_synced_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Synced {new Date(source.last_synced_at).toLocaleDateString()}
                            </span>
                          )}
                          {!source.last_synced_at && (
                            <span className="text-destructive flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Never synced
                            </span>
                          )}
                          <ChunkBrowser sourceId={source.id} sourceName={source.label || source.source_uri} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSync(source)}
                        disabled={hasActiveJob || triggerIngestion.isPending}
                        title="Sync"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${triggerIngestion.isPending ? "animate-spin" : ""}`} />
                      </Button>
                      <ProtectedAction requiredLevel="admin">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(source.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </ProtectedAction>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
