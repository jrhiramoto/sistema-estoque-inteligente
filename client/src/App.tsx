import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import ApiMonitoring from "./pages/ApiMonitoring";
import Debug from "./pages/Debug";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/products"} component={Products} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/alerts"} component={Alerts} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/api-monitoring"} component={ApiMonitoring} />
      <Route path={"/debug"} component={Debug} />
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
