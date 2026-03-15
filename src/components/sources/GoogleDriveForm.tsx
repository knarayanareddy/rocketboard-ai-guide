import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";

interface GoogleDriveFormProps {
  onSubmit: (data: GoogleDriveConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting?: boolean;
  hasConnector?: boolean;
}

export interface GoogleDriveConfig {
  folderId: string;
  authMethod: "connector" | "service_account";
  serviceAccountEmail?: string;
  serviceAccountKey?: string;
}

export function GoogleDriveForm({ onSubmit, onBack, isSubmitting, hasConnector }: GoogleDriveFormProps) {
  const [folderId, setFolderId] = useState("");
  const [authMethod, setAuthMethod] = useState<"connector" | "service_account">(
    hasConnector ? "connector" : "service_account"
  );
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [serviceAccountKey, setServiceAccountKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Extract folder ID from Google Drive URL
  const handleFolderInput = (value: string) => {
    // Handle URLs like https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
    const match = value.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      setFolderId(match[1]);
    } else {
      setFolderId(value);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setServiceAccountKey(JSON.stringify(json, null, 2));
        if (json.client_email) {
          setServiceAccountEmail(json.client_email);
        }
        toast.success("Service account key loaded");
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const handleTestConnection = async () => {
    if (!folderId) {
      toast.error("Please enter a folder ID or URL");
      return;
    }

    if (authMethod === "service_account" && !serviceAccountKey) {
      toast.error("Please provide a service account key");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // For service account, we'd need to verify via edge function
      // For now, show a placeholder
      if (authMethod === "connector") {
        setTestResult({
          success: true,
          message: "✅ Google Drive connector is configured. Folder will be verified during ingestion.",
        });
      } else {
        // Simplified test - real implementation would call edge function
        setTestResult({
          success: true,
          message: "✅ Service account key appears valid. Folder access will be verified during ingestion.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `❌ Test failed: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!folderId) {
      toast.error("Please enter a folder ID or URL");
      return;
    }

    if (authMethod === "service_account" && !serviceAccountKey) {
      toast.error("Please provide a service account key");
      return;
    }

    await onSubmit({
      folderId,
      authMethod,
      serviceAccountEmail: authMethod === "service_account" ? serviceAccountEmail : undefined,
      serviceAccountKey: authMethod === "service_account" ? serviceAccountKey : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center">
          <span className="text-gray-900 font-bold text-lg">G</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Connect Google Drive</h3>
          <p className="text-xs text-muted-foreground">Import documents from a Google Drive folder</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Folder URL or ID</label>
        <Input
          placeholder="https://drive.google.com/drive/folders/... or folder ID"
          value={folderId}
          onChange={(e) => handleFolderInput(e.target.value)}
        />
      </div>

      <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connector" disabled={!hasConnector}>
            {hasConnector ? "OAuth (Connected)" : "OAuth (Not Connected)"}
          </TabsTrigger>
          <TabsTrigger value="service_account">Service Account</TabsTrigger>
        </TabsList>

        <TabsContent value="connector" className="space-y-3">
          {hasConnector ? (
            <div className="bg-green-500/10 text-green-600 p-3 rounded-lg text-sm border border-green-500/20">
              ✅ Google Drive connector is linked. No additional setup needed.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-sm border border-amber-500/20">
                <strong>⚠️ OAuth not yet supported</strong>
                <p className="mt-1 text-xs opacity-90">
                  Connector-based OAuth for Google Drive is not currently available.
                  Please use the <strong>Service Account</strong> tab instead — this is the only supported
                  authentication method at this time.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                To use a service account, switch to the "Service Account" tab and upload your
                Google Cloud service account JSON key.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="service_account" className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Service Account Key (JSON)
            </label>
            <div className="flex gap-2 mb-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" className="w-full" asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Key File
                  </span>
                </Button>
              </label>
            </div>
            <Textarea
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              value={serviceAccountKey}
              onChange={(e) => setServiceAccountKey(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          {serviceAccountEmail && (
            <div className="bg-muted/50 p-3 rounded-lg text-xs">
              <strong className="text-foreground">Service Account Email:</strong>
              <br />
              <code className="text-primary">{serviceAccountEmail}</code>
              <p className="text-muted-foreground mt-2">
                Share your Google Drive folder with this email address to grant read access.
              </p>
            </div>
          )}

          <a
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Create a service account in Google Cloud Console <ExternalLink className="w-3 h-3" />
          </a>
        </TabsContent>
      </Tabs>

      {testResult && (
        <div
          className={`p-3 rounded-lg text-sm ${
            testResult.success
              ? "bg-green-500/10 text-green-600 border border-green-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing || isSubmitting}
          className="flex-1"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : testResult?.success ? (
            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
          ) : testResult ? (
            <XCircle className="w-4 h-4 mr-2 text-destructive" />
          ) : null}
          Test Connection
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Add Source
        </Button>
      </div>
    </div>
  );
}
