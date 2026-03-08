import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MissionControlChat } from "@/components/MissionControlChat";
import { usePackFromUrl } from "@/hooks/usePack";

function PackUrlSync() {
  // Auto-sync pack context from URL params when inside pack-scoped routes
  usePackFromUrl();
  return null;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full dark">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm shrink-0">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              <span className="text-sm font-mono text-muted-foreground">System Online</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <PackUrlSync />
            {children}
          </main>
        </div>
        <MissionControlChat />
      </div>
    </SidebarProvider>
  );
}
