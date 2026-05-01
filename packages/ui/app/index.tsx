import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ComparePage } from "./components/ComparePage";

const root = createRoot(document.getElementById("root")!);
root.render(window.location.pathname === "/compare" ? <ComparePage /> : <App />);
