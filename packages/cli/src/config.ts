import { existsSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const LOCAL_CONFIG_NAME = ".hancerc.json";
const GLOBAL_CONFIG_PATH = path.join(homedir(), ".config", "hance", "config.json");

function findLocalConfig(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, LOCAL_CONFIG_NAME);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface HanceConfig {
  [key: string]: string | number | boolean;
}

export function loadConfig(): { config: HanceConfig; source: string | null } {
  const localPath = findLocalConfig(process.cwd());

  for (const configPath of [localPath, GLOBAL_CONFIG_PATH]) {
    if (configPath && existsSync(configPath)) {
      try {
        const raw = require(configPath);
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          console.warn(`Warning: ignoring invalid config at ${configPath}`);
          continue;
        }
        return { config: raw as HanceConfig, source: configPath };
      } catch {
        console.warn(`Warning: failed to parse config at ${configPath}`);
      }
    }
  }

  return { config: {}, source: null };
}

export function configToArgv(config: HanceConfig): string[] {
  const argv: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (value === true) {
      argv.push(`--${key}`);
    } else if (value !== false && value !== undefined) {
      argv.push(`--${key}`, String(value));
    }
  }
  return argv;
}
