import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGitHubOAuthRoutes } from "../githubOAuth";
import { registerDiscordOAuthRoutes } from "../discordOAuth";
import { registerStorageProxy } from "./storageProxy";
import { registerOpenAiGateway, registerPlaygroundGateway } from "../openaiGateway";
import { registerAnthropicMessagesGateway } from "../anthropicGateway";
import { isRequestPayloadTooLarge, requestPayloadTooLargeResponse, TOKENFORGE_JSON_BODY_LIMIT } from "../requestPayload";
import { appRouter } from "../routers";
import { clearLegacyAdministratorRoles, ensureCatalogue } from "../db";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Claude Code sends complete tool and conversation histories. Keep a generous
  // but bounded request size so valid long-running sessions do not fail locally.
  app.use(express.json({ limit: TOKENFORGE_JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ limit: TOKENFORGE_JSON_BODY_LIMIT, extended: true }));
  app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isRequestPayloadTooLarge(error)) return next(error);
    return res.status(413).json(requestPayloadTooLargeResponse(req.path));
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGitHubOAuthRoutes(app);
  registerDiscordOAuthRoutes(app);
  registerOpenAiGateway(app);
  registerAnthropicMessagesGateway(app);
  registerPlaygroundGateway(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  try {
    await Promise.all([ensureCatalogue(), clearLegacyAdministratorRoles()]);
  } catch (error) {
    console.error("[TokenForge] Startup access and catalogue warmup failed; requests will retry catalogue initialization on demand", error);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
