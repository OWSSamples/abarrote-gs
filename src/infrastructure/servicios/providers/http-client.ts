// ══════════════════════════════════════════════════════════════
// Servicios provider HTTP client
// ══════════════════════════════════════════════════════════════
//
// Shared JSON request helper for the external "servicios" providers
// (topups / bill payments). Centralises the fetch + timeout +
// response parsing boilerplate; per-provider auth headers and error
// message formatting are supplied by the caller.

export interface JsonRequestOptions {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  /** Abort timeout in milliseconds. Defaults to 15s. */
  timeoutMs?: number;
  /** Builds the thrown error message for a non-2xx response. */
  formatError?: (status: number, data: unknown) => string;
}

/**
 * Performs a JSON request with an abort timeout. Parses the JSON body
 * and, on a non-OK response, throws an `Error` built from `formatError`
 * (or a generic `HTTP <status>` message when not provided).
 */
export async function requestJson<T>(options: JsonRequestOptions): Promise<T> {
  const { method, url, headers, body, timeoutMs = 15_000, formatError } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(formatError ? formatError(response.status, data) : `HTTP ${response.status}`);
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
