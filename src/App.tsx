import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { GlobalSearch } from "@/components/GlobalSearch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PackProvider } from "@/hooks/usePack";
import { ThemeProvider } from "@/hooks/useTheme";
import { useUserOrgs } from "@/hooks/useUserOrgs";
import { usePacks } from "@/hooks/usePacks";
import { useAcceptInvites } from "@/hooks/useAcceptInvites";
import Index from "./pages/Index";
import Modules from "./pages/Modules";
import ModuleView from "./pages/ModuleView";
import SettingsPage from "./pages/SettingsPage";
import AuthPage from "./pages/AuthPage";
import GlossaryPage from "./pages/GlossaryPage";
import PathsPage from "./pages/PathsPage";
import AskLeadPage from "./pages/AskLeadPage";
import PacksPage from "./pages/PacksPage";
import CreatePackPage from "./pages/CreatePackPage";
import PackMembersPage from "./pages/PackMembersPage";
import SourcesPage from "./pages/SourcesPage";
import PlanPage from "./pages/PlanPage";
import TemplatesPage from "./pages/TemplatesPage";
import TemplateDetailPage from "./pages/TemplateDetailPage";
import OnboardingWizard from "./pages/OnboardingWizard";
import ReviewPage from "./pages/ReviewPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import FeedbackPage from "./pages/FeedbackPage";
import TeamPage from "./pages/TeamPage";
import BookmarksPage from "./pages/BookmarksPage";
import TimelinePage from "./pages/TimelinePage";
import ContentHealthPage from "./pages/ContentHealthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Root route resolver: redirect based on org/pack membership */
function RootRedirect() {
  const { hasOrgs, isLoading: orgsLoading } = useUserOrgs();
  const { packs, isLoading: packsLoading } = usePacks();

  if (orgsLoading || packsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
      </div>
    );
  }

  if (!hasOrgs) return <Navigate to="/onboarding" replace />;
  if (packs.length === 0) return <Navigate to="/packs/new" replace />;
  if (packs.length === 1) return <Navigate to={`/packs/${packs[0].id}`} replace />;
  return <Navigate to="/packs" replace />;
}

/** Accept pending invites on auth */
function InviteAcceptor({ children }: { children: React.ReactNode }) {
  useAcceptInvites();
  return <>{children}</>;
}

function GlobalSearchShortcut() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PackProvider>
        <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <GlobalSearchShortcut />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><InviteAcceptor><OnboardingWizard /></InviteAcceptor></ProtectedRoute>} />

              {/* Root redirect */}
              <Route path="/" element={<ProtectedRoute><InviteAcceptor><RootRedirect /></InviteAcceptor></ProtectedRoute>} />

              {/* Pack list & creation */}
              <Route path="/packs" element={<ProtectedRoute><InviteAcceptor><PacksPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/new" element={<ProtectedRoute><InviteAcceptor><CreatePackPage /></InviteAcceptor></ProtectedRoute>} />

              {/* Pack-scoped routes */}
              <Route path="/packs/:packId" element={<ProtectedRoute><InviteAcceptor><Index /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/modules" element={<ProtectedRoute><InviteAcceptor><Modules /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/modules/:moduleId" element={<ProtectedRoute><InviteAcceptor><ModuleView /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/glossary" element={<ProtectedRoute><InviteAcceptor><GlossaryPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/paths" element={<ProtectedRoute><InviteAcceptor><PathsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/ask-lead" element={<ProtectedRoute><InviteAcceptor><AskLeadPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/sources" element={<ProtectedRoute><InviteAcceptor><SourcesPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/plan" element={<ProtectedRoute><InviteAcceptor><PlanPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/members" element={<ProtectedRoute><InviteAcceptor><PackMembersPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/review" element={<ProtectedRoute><InviteAcceptor><ReviewPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/analytics" element={<ProtectedRoute><InviteAcceptor><AnalyticsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/feedback" element={<ProtectedRoute><InviteAcceptor><FeedbackPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/team" element={<ProtectedRoute><InviteAcceptor><TeamPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/bookmarks" element={<ProtectedRoute><InviteAcceptor><BookmarksPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/timeline" element={<ProtectedRoute><InviteAcceptor><TimelinePage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/health" element={<ProtectedRoute><InviteAcceptor><ContentHealthPage /></InviteAcceptor></ProtectedRoute>} />

              {/* Global routes */}
              <Route path="/settings" element={<ProtectedRoute><InviteAcceptor><SettingsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><InviteAcceptor><TemplatesPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/templates/:templateId" element={<ProtectedRoute><InviteAcceptor><TemplateDetailPage /></InviteAcceptor></ProtectedRoute>} />

              {/* Legacy flat routes — redirect to current pack */}
              <Route path="/modules" element={<ProtectedRoute><LegacyRedirect path="modules" /></ProtectedRoute>} />
              <Route path="/modules/:moduleId" element={<ProtectedRoute><LegacyRedirect path="modules" /></ProtectedRoute>} />
              <Route path="/glossary" element={<ProtectedRoute><LegacyRedirect path="glossary" /></ProtectedRoute>} />
              <Route path="/paths" element={<ProtectedRoute><LegacyRedirect path="paths" /></ProtectedRoute>} />
              <Route path="/ask-lead" element={<ProtectedRoute><LegacyRedirect path="ask-lead" /></ProtectedRoute>} />
              <Route path="/sources" element={<ProtectedRoute><LegacyRedirect path="sources" /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><LegacyRedirect path="plan" /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </ThemeProvider>
      </PackProvider>
    </AuthProvider>
  </QueryClientProvider>
);

/** Redirect old flat routes to pack-scoped equivalents */
function LegacyRedirect({ path }: { path: string }) {
  const { packs, isLoading } = usePacks();
  if (isLoading) return null;
  const savedPackId = localStorage.getItem("rocketboard_current_pack");
  const packId = savedPackId || packs[0]?.id;
  if (!packId) return <Navigate to="/packs" replace />;
  return <Navigate to={`/packs/${packId}/${path}`} replace />;
}

export default App;
