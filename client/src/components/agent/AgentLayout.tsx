import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Outlet, useOutletContext } from "react-router-dom";
import {
  Bot,
  Settings,
  PhoneOutgoing,
  Phone,
  MessageCircle,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

export interface Agent {
  id: string;
  name: string;
  description: string;
  config: any;
}

export interface AgentContextType {
  agent: Agent;
  setAgent: (agent: Agent) => void;
}

export function useAgentContext() {
  return useOutletContext<AgentContextType>();
}

const menuItems = [
  { id: "studio", label: "Studio", icon: Bot, path: "studio" },
  { id: "configure", label: "Configure", icon: Settings, path: "configure" },
  { id: "outbound", label: "Outbound", icon: PhoneOutgoing, path: "outbound" },
  { id: "calls", label: "Calls", icon: Phone, path: "calls" },
  { id: "chats", label: "Chats", icon: MessageCircle, path: "chats" },
  { id: "analytics", label: "Analytics", icon: BarChart3, path: "analytics" },
  { id: "feedback", label: "Feedback", icon: MessageSquare, path: "feedback" },
];

const AgentLayout = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine active menu item from URL
  const pathSegments = location.pathname.split("/");
  const activeItem = pathSegments[pathSegments.length - 1] || "studio";
  const isStudio = activeItem === "studio";

  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  const fetchAgent = async () => {
    if (!agentId) return;

    setLoading(true);
    const response = await api.getAgent(agentId);
    if (response.error) {
      toast({
        title: "Error loading agent",
        description: response.error,
        variant: "destructive",
      });
      navigate("/dashboard/agents");
    } else {
      setAgent(response.data);
    }
    setLoading(false);
  };

  const handleMenuItemClick = (itemPath: string) => {
    navigate(`/dashboard/agents/${agentId}/${itemPath}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background flex">
      {/* Left Sidebar Menu */}
      <div className="w-16 bg-secondary border-r border-border flex flex-col items-center py-4 gap-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.path;
          return (
            <button
              key={item.id}
              onClick={() => handleMenuItemClick(item.path)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary-foreground/10"
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar - hidden for studio (it has its own) */}
        {!isStudio && (
          <div className="h-16 border-b border-border flex items-center px-6 bg-background/95 backdrop-blur-sm z-10">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard/agents")}
                className="mr-2"
              >
                <svg width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.275 8.025H6.675C6.225 8.025 6.025 7.475 6.325 7.175L11.125 2.375C11.425 2.075 11.425 1.625 11.125 1.325L10.025 0.225C9.725 -0.075 9.275 -0.075 8.975 0.225L0.225 9.025C-0.075 9.325 -0.075 9.775 0.225 10.075L8.975 18.825C9.275 19.125 9.725 19.125 10.025 18.825L11.075 17.775C11.375 17.475 11.375 17.025 11.075 16.725L6.275 11.925C5.975 11.575 6.175 11.025 6.625 11.025H23.225C23.625 11.025 23.975 10.725 23.975 10.325V8.825C23.975 8.425 23.675 8.025 23.275 8.025Z" fill="white"/>
                </svg>
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {agent.name}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page Content - Outlet renders the matched child route */}
        <div className="flex-1 flex overflow-auto">
          <Outlet context={{ agent, setAgent } satisfies AgentContextType} />
        </div>
      </div>
    </div>
  );
};

export default AgentLayout;
