import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const raw = await res.text();
    let message = raw || res.statusText;
    let data: unknown = raw;

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        data = parsed;
        if (parsed && typeof parsed === "object") {
          const anyParsed = parsed as any;
          message = anyParsed.error || anyParsed.message || message;
        }
      } catch {
        // raw text fallback
      }
    }

    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    if (data && typeof data === "object" && "code" in data) {
      err.code = (data as any).code;
    }
    throw err;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const isFormData = typeof FormData !== "undefined" && data instanceof FormData;

  const headers = !data || isFormData ? undefined : { "Content-Type": "application/json" };
  const body = !data
    ? undefined
    : isFormData
      ? (data as FormData)
      : JSON.stringify(data);

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
