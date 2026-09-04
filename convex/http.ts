import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { registerWebhooks } from "./webhooks";
import { registerAsk } from "./ask";
import { upload as timelapseUpload } from "./timelapse";
import { snapshot as opsSnapshot } from "./ops";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });
registerWebhooks(http);
registerAsk(http);

// The wall, every hour: the scheduled screenshot lands here (token-guarded).
http.route({ path: "/timelapse/upload", method: "POST", handler: timelapseUpload });
// Ops: the sandbox snapshot id after a refresh (token-guarded).
http.route({ path: "/ops/snapshot", method: "POST", handler: opsSnapshot });

export default http;
