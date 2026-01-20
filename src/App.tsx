import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedSuperAdminRoute } from "./components/ProtectedSuperAdminRoute";
import { DashboardLayout } from "./components/DashboardLayout";
import { SuperAdminLayout } from "./layouts/SuperAdminLayout";
import Dashboard from "./pages/Dashboard";
import Connections from "./pages/Connections";
import ConnectionHealth from "./pages/ConnectionHealth";
import Contacts from "./pages/Contacts";
import ContactListView from "./pages/ContactListView";
import Campaigns from "./pages/Campaigns";
import Logs from "./pages/Logs";
import CampaignNew from "./pages/CampaignNew";
import CampaignEdit from "./pages/CampaignEdit";
import CampaignDetails from "./pages/CampaignDetails";
import CampaignLogs from "./pages/CampaignLogs";
import CampaignFollowUpReport from "./pages/CampaignFollowUpReport";
import CampaignInteractionReport from "./pages/CampaignInteractionReport";
import Settings from "./pages/Settings";
import Empresas from "./pages/Empresas";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/connections"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Connections />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/connection-health"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ConnectionHealth />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Contacts />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts/:listId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ContactListView />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Campaigns />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CampaignNew />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CampaignEdit />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CampaignDetails />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Logs />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/:id/follow-up"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CampaignFollowUpReport />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/:id/interaction-report"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CampaignInteractionReport />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Settings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/empresas"
              element={
                <ProtectedSuperAdminRoute>
                  <SuperAdminLayout>
                    <Empresas />
                  </SuperAdminLayout>
                </ProtectedSuperAdminRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
