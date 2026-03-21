import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useParams, Link } from "react-router-dom";
import { FileText, ArrowLeft, Settings } from "lucide-react";

export default function DocsAdminPage() {
  const { packId } = useParams<{ packId: string }>();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        <div className="flex items-center gap-4">
          <Link to={`/packs/${packId}/docs`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 data-tour="docs-admin-header" className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Docs Admin
          </h1>
        </div>
        
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-medium text-foreground mb-2">Sync Documentation</h2>
          <p className="max-w-md mx-auto mb-6">Trigger the **Titanium-Hardened** sync engine to import and parse Technical documents from the source repository. Every sync is verified by our automated integrity script with full secret redaction.</p>
          <button data-tour="docs-sync-button" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            Sync Repository Docs
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
