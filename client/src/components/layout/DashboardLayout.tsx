import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import FeedbackModal from "@/components/FeedbackModal";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Home,
  Phone,
  BarChart3,
  Users,
  Settings,
  MessageSquare,
  LogOut,
  ChevronRight,
  BookOpen,
  Shield,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { title: "Home", icon: Home, path: "/dashboard" },
  { title: "Telephony", icon: Phone, path: "/dashboard/telephony" },
  { title: "Usage", icon: BarChart3, path: "/dashboard/usage" },
  { title: "Groups", icon: Users, path: "/dashboard/groups" },
  { title: "Settings", icon: Settings, path: "/dashboard/settings" },
  { title: "Tutorial", icon: BookOpen, path: "/dashboard/tutorial" },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, loading, signOut, isAdmin } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex gradient-hero">
        {/* Background decoration */}
        <div className="fixed inset-0 overflow-auto pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px]" />
        </div>

        {/* Sidebar */}
        <Sidebar variant="floating" collapsible="icon">
          <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-3 group-data-[collapsible=icon]:items-center">
            <Link to="/" className="flex items-center group-data-[collapsible=icon]:justify-center">
              <img src="/logo.png" alt="ComHub AI" className="flex justify-center mx-auto h-9 group-data-[collapsible=icon]:hidden" />
              <img src="/logo_col.png" alt="ComHub AI" className="h-8 w-8 hidden group-data-[collapsible=icon]:block" />
            </Link>
          </SidebarHeader>

          <SidebarSeparator />

          <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      size="lg"
                    >
                      <Link to={item.path} className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        {isActive && (
                          <ChevronRight className="ml-auto w-4 h-4 group-data-[collapsible=icon]:hidden" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {/* Feedback - opens modal instead of navigating */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Feedback"
                  size="lg"
                  onClick={() => setFeedbackOpen(true)}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="group-data-[collapsible=icon]:hidden">Feedback</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarSeparator />

          {isAdmin && (
            <SidebarMenu className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0 px-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/dashboard/admin" || location.pathname.startsWith("/dashboard/admin")}
                  tooltip="Admin"
                  size="lg"
                >
                  <Link to="/dashboard/admin" className="flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    <span className="group-data-[collapsible=icon]:hidden">Admin</span>
                    {(location.pathname === "/dashboard/admin" || location.pathname.startsWith("/dashboard/admin")) && (
                      <ChevronRight className="ml-auto w-4 h-4 group-data-[collapsible=icon]:hidden" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}

          {
            isAdmin && (
              <>
                <SidebarSeparator />
              </>
            )
          }

          <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:items-center">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-primary">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.email || "User"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 w-full justify-start gap-3 mt-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-6 relative z-10">
            {children}
          </main>
        </SidebarInset>
      </div>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </SidebarProvider>
  );
};

export default DashboardLayout;
