import { env } from "@/config/env";
import { createClient } from "@/lib/supabase/server";

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

async function fetchServerApi<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const fullUrl = `${env.API_URL}${url}`;

  let token = undefined;
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch (err) {
    console.warn("[API] Failed to get Supabase session on server", err);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(fullUrl, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.message ?? `Request failed (${response.status})`;
    console.error(
      `[Server API] ${method} ${url} → ${response.status}: ${message}`,
    );
    throw new ApiError(response.status, message);
  }

  return response.json();
}

/**
 * Server-only API client. Use this strictly within Server Components
 * or Server Actions to make authenticated requests.
 */
export const serverApi = {
  get<T>(url: string, options?: RequestInit): Promise<T> {
    return fetchServerApi<T>(url, { ...options, method: "GET" });
  },
  post<T>(url: string, body?: unknown, options?: RequestInit): Promise<T> {
    return fetchServerApi<T>(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(url: string, options?: RequestInit): Promise<T> {
    return fetchServerApi<T>(url, { ...options, method: "DELETE" });
  },
};
