import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Replenishment from "@/pages/Replenishment";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import ApiMonitoring from "./pages/ApiMonitoring";
import Debug from "./pages/Debug";
import AbcAnalysis from "./pages/AbcAnalysis";
import AbcClassReport from "./pages/AbcClassReport";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      {/* Rotas Públicas - Autenticação */}
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      
      {/* Rotas Protegidas - Requerem autenticação */}
      <Route path={"/"}>
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path={"/products"}>
        <ProtectedRoute>
          <Products />
        </ProtectedRoute>
      </Route>
      <Route path={"/orders"}>
        <ProtectedRoute>
          <Orders />
        </ProtectedRoute>
      </Route>
      <Route path={"/alerts"}>
        <ProtectedRoute>
          <Alerts />
        </ProtectedRoute>
      </Route>
      <Route path={"/settings"}>
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>
      <Route path={"/api-monitoring"}>
        <ProtectedRoute>
          <ApiMonitoring />
        </ProtectedRoute>
      </Route>
      <Route path={"/debug"}>
        <ProtectedRoute>
          <Debug />
        </ProtectedRoute>
      </Route>
      <Route path={"/analise-abc"}>
        <ProtectedRoute>
          <AbcAnalysis />
        </ProtectedRoute>
      </Route>
      <Route path={"/abc"}>
        <ProtectedRoute>
          <AbcAnalysis />
        </ProtectedRoute>
      </Route>
      <Route path={"/abc/class/:class"}>
        <ProtectedRoute>
          <AbcClassReport />
        </ProtectedRoute>
      </Route>
      <Route path={"/replenishment"}>
        <ProtectedRoute>
          <Replenishment />
        </ProtectedRoute>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
