import "./styles.css";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { App } from "./App";

declare const HANCE_VERSION: string | undefined;

const isDev = process.env.NODE_ENV !== "production";

declare const SENTRY_DSN: string | undefined;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: typeof HANCE_VERSION !== "undefined" ? `hance@${HANCE_VERSION}` : "hance@dev",
    environment: isDev ? "development" : "production",
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration(),
      Sentry.httpClientIntegration({ failedRequestStatusCodes: [[400, 599]] }),
    ],
    replaysSessionSampleRate: isDev ? 1.0 : 0.1,
    replaysOnErrorSampleRate: isDev ? 1.0 : 0.5,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
