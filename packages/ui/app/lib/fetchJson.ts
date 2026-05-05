export class HttpError extends Error {
  constructor(public status: number, public statusText: string, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return res.statusText;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && typeof parsed.error === "string") {
        return parsed.error;
      }
    } catch {
      // Not JSON — fall through to raw text (truncated).
    }
    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  } catch {
    return res.statusText;
  }
}

export async function fetchJson<T = unknown>(input: RequestInfo, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new HttpError(res.status, res.statusText, `${res.status} ${res.statusText}: ${body}`);
  }
  try {
    return await res.json() as T;
  } catch (err) {
    throw new Error(`Invalid JSON response from ${typeof input === "string" ? input : input.url}: ${(err as Error).message}`);
  }
}

export async function fetchOk(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    throw new Error(`Network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new HttpError(res.status, res.statusText, `${res.status} ${res.statusText}: ${body}`);
  }
  return res;
}
