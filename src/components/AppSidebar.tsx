import { useState, useRef, useEffect } from "react";
import { Rocket, BookOpen, BarChart3, Settings, ChevronRight, LogOut, BookText, Route, MessageSquareMore, Package, Shield, Database, Map, Layout, Globe, Plus, CheckCircle2, Search, MessageCircle, Users } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle, ThemeToggleCompact } from "@/components/ThemeToggle";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { PackSelector } from "@/components/PackSelector";
import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";
import { usePack } from "@/hooks/usePack";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const roleBadgeColors: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  admin: "bg-red-500/15 text-red-400 border-red-500/30",
  author: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  learner: "bg-green-500/15 text-green-400 border-green-500/30",
  read_only: "bg-muted text-muted-foreground border-border",
};

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { signOut, user } = useAuth();
  const { packAccessLevel, accessLevelLabel, hasPackPermission } = useRole();
  const { outputLanguage, audience, depth, glossaryDensity, learnerRole, experienceLevel, mermaidEnabled, updatePrefs } = useAudiencePrefs();
  const { currentPackId, currentPack } = usePack();
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langOpen]);

  const isEnglishOnly = currentPack?.language_mode === "english";

  // Build pack-scoped nav items dynamically
  const packPrefix = `/packs/${currentPackId}`;

  const navItems = [
    { title: "Dashboard", url: packPrefix, icon: BarChart3, minLevel: "read_only" as const, end: true },
    { title: "Modules", url: `${packPrefix}/modules`, icon: BookOpen, minLevel: "read_only" as const, end: false },
    { title: "Glossary", url: `${packPrefix}/glossary`, icon: BookText, minLevel: "read_only" as const, end: false },
    { title: "Paths", url: `${packPrefix}/paths`, icon: Route, minLevel: "read_only" as const, end: false },
    { title: "Ask Your Lead", url: `${packPrefix}/ask-lead`, icon: MessageSquareMore, minLevel: "read_only" as const, end: false },
    { title: "Team", url: `${packPrefix}/team`, icon: Users, minLevel: "read_only" as const, end: false },
    { title: "Sources", url: `${packPrefix}/sources`, icon: Database, minLevel: "author" as const, end: false },
    { title: "Plan", url: `${packPrefix}/plan`, icon: Map, minLevel: "author" as const, end: false },
    { title: "Review", url: `${packPrefix}/review`, icon: CheckCircle2, minLevel: "author" as const, end: false },
    { title: "Analytics", url: `${packPrefix}/analytics`, icon: BarChart3, minLevel: "admin" as const, end: false },
    { title: "Members", url: `${packPrefix}/members`, icon: Shield, minLevel: "admin" as const, end: false },
    { title: "Feedback", url: `${packPrefix}/feedback`, icon: MessageCircle, minLevel: "author" as const, end: false },
    { title: "Templates", url: "/templates", icon: Layout, minLevel: "admin" as const, end: false },
    { title: "Settings", url: "/settings", icon: Settings, minLevel: "read_only" as const, end: false },
  ];

  const handleLanguageChange = (code: string) => {
    if (isEnglishOnly) {
      toast.info("This pack is configured for English only.");
      setLangOpen(false);
      return;
    }
    updatePrefs.mutate({
      audience,
      depth,
      glossary_density: glossaryDensity,
      learner_role: learnerRole,
      experience_level: experienceLevel,
      output_language: code,
      mermaid_enabled: mermaidEnabled,
    });
    setLangOpen(false);
    const label = LANG_OPTIONS.find(l => l.code === code)?.label || code;
    toast.success(`Language changed to ${label}. New AI responses will use this language.`);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
          <Rocket className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-sidebar-accent-foreground">
            RocketBoard
          </span>
        )}
      </div>

      {/* Pack Selector */}
      <div className="px-3 pb-3">
        <PackSelector collapsed={collapsed} />
      </div>

      {/* Search button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="hidden sm:inline text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
            </>
          )}
        </button>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-widest">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems
                .filter((item) => hasPackPermission(item.minLevel))
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      onClick={() => { if (isMobile) setOpenMobile(false); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent min-h-[44px]"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && location.pathname === item.url && (
                        <ChevronRight className="w-3 h-3 ml-auto text-sidebar-primary" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {/* Notifications - always visible */}
        <div className="flex items-center justify-center">
          <NotificationBell />
        </div>
        
        {!collapsed && user && (
          <div className="space-y-1">
            <div className="text-xs text-sidebar-foreground/60 truncate">
              {user.email}
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColors[packAccessLevel] ?? roleBadgeColors.read_only}`}>
              <Shield className="w-2.5 h-2.5" />
              {accessLevelLabel(packAccessLevel)}
            </span>
          </div>
        )}
        {/* Theme mode toggle */}
        {collapsed ? (
          <ThemeToggleCompact />
        ) : (
          <ThemeToggle />
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Sign out</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center justify-between text-xs text-sidebar-foreground/30 font-mono">
            <span>v4.0 • RocketBoard</span>
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 text-sidebar-foreground/50 hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
              >
                <Globe className="w-3 h-3" />
                {outputLanguage.toUpperCase()}
              </button>
              {langOpen && (
                <div className="absolute bottom-full right-0 mb-1 w-36 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                  {LANG_OPTIONS.map(l => (
                    <button
                      key={l.code}
                      onClick={() => handleLanguageChange(l.code)}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-accent ${outputLanguage === l.code ? "text-primary font-medium" : "text-popover-foreground"}`}
                    >
                      {l.label} <span className="text-muted-foreground ml-1">({l.code.toUpperCase()})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
