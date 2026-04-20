import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import LiveMonitoring from "./pages/LiveMonitoring";
import WorkerDetails from "./pages/WorkerDetails";
import LocationZones from "./pages/LocationZones";
import AlertsCenter from "./pages/AlertsCenter";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => {
  const defaultEmployeeId = import.meta.env.VITE_EMPLOYEE_ID ?? "EMP001";

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/monitoring" element={<ProtectedRoute><LiveMonitoring /></ProtectedRoute>} />
              <Route path="/workers" element={<Navigate to={`/workers/${defaultEmployeeId}`} replace />} />
              <Route path="/workers/:id" element={<ProtectedRoute><WorkerDetails /></ProtectedRoute>} />
              <Route path="/zones" element={<ProtectedRoute><LocationZones /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute><AlertsCenter /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
