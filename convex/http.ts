import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { registerWebhooks } from "./webhooks";
import { registerAsk } from "./ask";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });
registerWebhooks(http);
registerAsk(http);

export default http;
