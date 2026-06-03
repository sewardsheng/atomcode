import { Hono } from "hono";
import { sentry } from "@sentry/hono/bun";
import * as Sentry from "@sentry/hono/bun";
import { HTTPException } from "hono/http-exception";

import sessions from "./routes/sessions";
import chat from "./routes/chat";

const app = new Hono();

app.use(
    sentry(app, {
        dsn: "https://e763c620e1a28af4a0cd7a01ce2b5375@o4511490338193408.ingest.us.sentry.io/4511490348744704",
        tracesSampleRate: 1.0,
        enableLogs: true,
        sendDefaultPii: true,
    }),
);

app.get("/debug-sentry", () => {
    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
        action: 'test_error_endpoint',
    });
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);
    throw new Error("My first Sentry error!");
});

app.onError((error, c) => {
    if (error instanceof HTTPException) {
        Sentry.logger.warn("handle HTTPException", {
            status: error.status,
            message: error.message || "Request failed",
            path: c.req.path,
            method: c.req.method,
        });

        return c.json({
            error: error.message || "Request failed",
        }, error.status);
    };

    return c.json({ error: "Internal server error" }, 500);
});

const routes = app.route("/sessions", sessions).route("/chat", chat);

export type AppType = typeof routes;

// idleTimeout 必须设置高一些，否则LLM 工具调用可能无法完成
export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };