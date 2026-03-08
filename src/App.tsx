import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PackProvider } from "@/hooks/usePack";
import Index from "./pages/Index";
import Modules from "./pages/Modules";
import ModuleView from "./pages/ModuleView";
import SettingsPage from "./pages/SettingsPage";
import AuthPage from "./pages/AuthPage";
import GlossaryPage from "./pages/GlossaryPage";
import PathsPage from "./pages/PathsPage";
import AskLeadPage from "./pages/AskLeadPage";
import PacksPage from "./pages/PacksPage";
import PackMembersPage from "./pages/PackMembersPage";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PackProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/modules" element={<ProtectedRoute><Modules /></ProtectedRoute>} />
              <Route path="/modules/:moduleId" element={<ProtectedRoute><ModuleView /></ProtectedRoute>} />
              <Route path="/glossary" element={<ProtectedRoute><GlossaryPage /></ProtectedRoute>} />
              <Route path="/paths" element={<ProtectedRoute><PathsPage /></ProtectedRoute>} />
              <Route path="/ask-lead" element={<ProtectedRoute><AskLeadPage /></ProtectedRoute>} />
              <Route path="/packs" element={<ProtectedRoute><PacksPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PackProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
