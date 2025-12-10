import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { webhookEndpoint } from "../server/_core/webhookEndpoint";
import path from "path";

const app = express();

// Serve static files from dist/client
const clientPath = path.join(__dirname, "../dist/client");
app.use(express.static(clientPath));

// Webhook endpoint (MUST be before body parser to capture raw body)
app.use(webhookEndpoint);

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// OAuth callback under /api/oauth/callback
registerOAuthRoutes(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      console.error(`[tRPC Error] ${path}:`, error);
    },
  })
);

// SPA fallback - serve index.html for all non-API routes
app.get("*", (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith("/api/")) {
    return next();
  }
  
  // Serve index.html for all other routes (SPA)
  res.sendFile(path.join(clientPath, "index.html"));
});

// Global error handler - ensure all errors return JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express Error]:', err);
  
  // If headers already sent, delegate to default error handler
  if (res.headersSent) {
    return next(err);
  }
  
  // Always return JSON for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal Server Error',
        code: err.code || 'INTERNAL_SERVER_ERROR',
      },
    });
  }
  
  // For non-API routes, pass to next handler
  next(err);
});

export default app;
