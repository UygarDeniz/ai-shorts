import { env } from "@/config/env";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly userMessage: string;

  constructor(statusCode: number, userMessage: string) {
    super(userMessage);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.userMessage = userMessage;
  }
}

async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? "GET";
  const fullUrl = `${env.API_URL}${url}`;

  const response = await fetch(fullUrl, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.message ?? `Request failed (${response.status})`;

    console.error(`[API] ${method} ${url} → ${response.status}: ${message}`);

    throw new ApiError(response.status, message);
  }

  return response.json();
}

export const api = {
  get<T>(url: string, options?: RequestInit): Promise<T> {
    return fetchApi<T>(url, { ...options, method: "GET" });
  },
  post<T>(url: string, body?: unknown, options?: RequestInit): Promise<T> {
    return fetchApi<T>(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(url: string, options?: RequestInit): Promise<T> {
    return fetchApi<T>(url, { ...options, method: "DELETE" });
  },
};

/**
 * Build a full backend URL from a relative path (e.g. for video file URLs).
 * Validates the origin matches the API origin to prevent open redirects.
 */
export function getBackendUrl(path: string): string {
  const base = new URL(env.API_URL);
  const result = new URL(path, base.origin);

  if (result.origin !== base.origin) {
    throw new Error("Invalid URL: external origin detected");
  }

  return result.href;
}
