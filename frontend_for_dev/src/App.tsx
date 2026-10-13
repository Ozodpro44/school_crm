import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Logs = lazy(() => import("./pages/Logs"));
const Incidents = lazy(() => import("./pages/Incidents"));
const Branches = lazy(() => import("./pages/Branches"));
const Trash = lazy(() => import("./pages/Trash"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const SubscriptionPlans = lazy(() => import("./pages/SubscriptionPlans"));
const Users = lazy(() => import("./pages/Users"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const PaymentTypes = lazy(() => import("./pages/PaymentTypes"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="dev-theme">
    <TooltipProvider delayDuration={200}>
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" role="status" aria-label="Loading" /></div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
              <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
              <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>} />
              <Route path="/trash" element={<ProtectedRoute><Trash /></ProtectedRoute>} />
              <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
              <Route path="/subscription-plans" element={<ProtectedRoute><SubscriptionPlans /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/payment-types" element={<ProtectedRoute><PaymentTypes /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
