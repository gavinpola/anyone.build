import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { registerWebhooks } from "./webhooks";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });
registerWebhooks(http);

export default http;
