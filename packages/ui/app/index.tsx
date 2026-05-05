import "./styles.css";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { App } from "./App";

declare const HANCE_VERSION: string | undefined;

const isDev = process.env.NODE_ENV !== "production";

Sentry.init({
  dsn: "https://2m6p7HSFSWpy9Wub6yrrDgCe@s2416950.eu-fsn-3.betterstackdata.com/2416950",
  release: typeof HANCE_VERSION !== "undefined" ? `hance@${HANCE_VERSION}` : "hance@dev",
  environment: isDev ? "development" : "production",
  sendDefaultPii: true,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.httpClientIntegration({ failedRequestStatusCodes: [[400, 599]] }),
  ],
  replaysSessionSampleRate: isDev ? 1.0 : 0.1,
  replaysOnErrorSampleRate: isDev ? 1.0 : 0.5,
});

createRoot(document.getElementById("root")!).render(<App />);
