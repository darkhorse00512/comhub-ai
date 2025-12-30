import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DashboardLayout from "./components/layout/DashboardLayout";
import HomePage from "./pages/dashboard/HomePage";
import TelephonyPage from "./pages/dashboard/TelephonyPage";
import UsagePage from "./pages/dashboard/UsagePage";
import GroupsPage from "./pages/dashboard/GroupsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import FeedbackPage from "./pages/dashboard/FeedbackPage";
import CallHistory from "./pages/CallHistory";
import BulkDialer from "./pages/BulkDialer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<DashboardLayout><HomePage /></DashboardLayout>} />
            <Route path="/dashboard/telephony" element={<DashboardLayout><TelephonyPage /></DashboardLayout>} />
            <Route path="/dashboard/usage" element={<DashboardLayout><UsagePage /></DashboardLayout>} />
            <Route path="/dashboard/groups" element={<DashboardLayout><GroupsPage /></DashboardLayout>} />
            <Route path="/dashboard/settings" element={<DashboardLayout><SettingsPage /></DashboardLayout>} />
            <Route path="/dashboard/feedback" element={<DashboardLayout><FeedbackPage /></DashboardLayout>} />
            <Route path="/history" element={<CallHistory />} />
            <Route path="/bulk-dialer" element={<BulkDialer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
