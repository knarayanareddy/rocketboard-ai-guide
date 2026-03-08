import { Rocket, BookOpen, BarChart3, Settings, ChevronRight, LogOut, BookText, Route, MessageSquareMore, Package, Shield, Database, Map } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { PackSelector } from "@/components/PackSelector";
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

const navItems = [
  { title: "Dashboard", url: "/", icon: BarChart3, minLevel: "read_only" as const },
  { title: "Modules", url: "/modules", icon: BookOpen, minLevel: "read_only" as const },
  { title: "Packs", url: "/packs", icon: Package, minLevel: "read_only" as const },
  { title: "Sources", url: "/sources", icon: Database, minLevel: "author" as const },
  { title: "Glossary", url: "/glossary", icon: BookText, minLevel: "read_only" as const },
  { title: "Paths", url: "/paths", icon: Route, minLevel: "read_only" as const },
  { title: "Ask Your Lead", url: "/ask-lead", icon: MessageSquareMore, minLevel: "read_only" as const },
  { title: "Settings", url: "/settings", icon: Settings, minLevel: "admin" as const },
];

const roleBadgeColors: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  admin: "bg-red-500/15 text-red-400 border-red-500/30",
  author: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  learner: "bg-green-500/15 text-green-400 border-green-500/30",
  read_only: "bg-muted text-muted-foreground border-border",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { packAccessLevel, accessLevelLabel, hasPackPermission } = useRole();

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
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
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
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Sign out</span>}
        </button>
        {!collapsed && (
          <div className="text-xs text-sidebar-foreground/30 font-mono">
            v4.0 • RocketBoard
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
