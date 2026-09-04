import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { registerWebhooks } from "./webhooks";
import { registerAsk } from "./ask";
import { upload as timelapseUpload } from "./timelapse";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });
registerWebhooks(http);
registerAsk(http);

// The wall, every hour: the scheduled screenshot lands here (token-guarded).
http.route({ path: "/timelapse/upload", method: "POST", handler: timelapseUpload });

export default http;
