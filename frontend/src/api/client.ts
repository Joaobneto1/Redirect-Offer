const BASE = "";

async function request<T>(
  path: string,
  opts?: RequestInit & { params?: Record<string, string> }
): Promise<T> {
  const { params, ...init } = opts ?? {};
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  overview: () => request<{
    products: number;
    groups: number;
    checkouts: number;
    smartLinks: number;
    activeCheckouts: number;
  }>(`${BASE}/api/overview`),

  products: {
    list: () =>
      request<
        Array<{
          id: string;
          name: string;
          createdAt: string;
          _count: { groups: number };
        }>
      >(`${BASE}/api/products`),
    get: (id: string) =>
      request<{
        id: string;
        name: string;
        createdAt: string;
        groups: Array<{
          id: string;
          name: string;
          rotationStrategy: string;
          _count: { checkouts: number; smartLinks: number };
        }>;
      }>(`${BASE}/api/products/${id}`),
    create: (body: { name: string }) =>
      request<{ id: string; name: string }>(`${BASE}/api/products`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: { name?: string }) =>
      request<{ id: string; name: string }>(`${BASE}/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<void>(`${BASE}/api/products/${id}`, { method: "DELETE" }),
  },

  groups: {
    list: (productId?: string) =>
      request<
        Array<{
          id: string;
          productId: string;
          name: string;
          rotationStrategy: string;
          product: { id: string; name: string };
          _count: { checkouts: number; smartLinks: number };
        }>
      >(`${BASE}/api/groups`, { params: productId ? { productId } : {} }),
    get: (id: string) =>
      request<{
        id: string;
        productId: string;
        name: string;
        rotationStrategy: string;
        product: { id: string; name: string };
        checkouts: Array<{
          id: string;
          url: string;
          priority: number;
          isActive: boolean;
          lastError: string | null;
          lastUsedAt: string | null;
          consecutiveFailures: number;
        }>;
        smartLinks: Array<{ id: string; slug: string; fallbackUrl: string | null }>;
      }>(`${BASE}/api/groups/${id}`),
    create: (body: {
      productId: string;
      name: string;
      rotationStrategy?: "round-robin" | "priority";
    }) =>
      request<{ id: string; name: string; rotationStrategy: string }>(
        `${BASE}/api/groups`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    update: (
      id: string,
      body: { name?: string; rotationStrategy?: "round-robin" | "priority" }
    ) =>
      request<{ id: string; name: string; rotationStrategy: string }>(
        `${BASE}/api/groups/${id}`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    delete: (id: string) =>
      request<void>(`${BASE}/api/groups/${id}`, { method: "DELETE" }),
  },

  checkouts: {
    list: (groupId?: string) =>
      request<
        Array<{
          id: string;
          groupId: string;
          url: string;
          priority: number;
          isActive: boolean;
          lastError: string | null;
          lastUsedAt: string | null;
          consecutiveFailures: number;
          group: { id: string; name: string };
        }>
      >(`${BASE}/api/checkouts`, { params: groupId ? { groupId } : {} }),
    create: (body: {
      groupId: string;
      url: string;
      priority?: number;
    }) =>
      request<{ id: string; url: string; priority: number }>(
        `${BASE}/api/checkouts`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    update: (
      id: string,
      body: { url?: string; priority?: number; isActive?: boolean }
    ) =>
      request<{
        id: string;
        url: string;
        priority: number;
        isActive: boolean;
      }>(`${BASE}/api/checkouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<void>(`${BASE}/api/checkouts/${id}`, { method: "DELETE" }),
    /** Roda health check sob demanda e atualiza lastError/lastCheckedAt/isActive. */
    check: (id: string) =>
      request<{ ok: boolean; error?: string; status?: number }>(
        `${BASE}/api/checkouts/${id}/check`,
        { method: "POST" }
      ),
  },

  smartLinks: {
    list: (groupId?: string) =>
      request<
        Array<{
          id: string;
          slug: string;
          groupId: string;
          fallbackUrl: string | null;
          group: {
            id: string;
            name: string;
            product: { id: string; name: string };
          };
        }>
      >(`${BASE}/api/smart-links`, { params: groupId ? { groupId } : {} }),
    get: (id: string) =>
      request<{
        id: string;
        slug: string;
        groupId: string;
        fallbackUrl: string | null;
        group: {
          id: string;
          name: string;
          product: { id: string; name: string };
          checkouts: Array<{ id: string; url: string; isActive: boolean }>;
        };
      }>(`${BASE}/api/smart-links/${id}`),
    create: (body: {
      slug: string;
      groupId: string;
      fallbackUrl?: string | null;
    }) =>
      request<{ id: string; slug: string; groupId: string; fallbackUrl: string | null }>(
        `${BASE}/api/smart-links`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    update: (
      id: string,
      body: { slug?: string; fallbackUrl?: string | null }
    ) =>
      request<{ id: string; slug: string; fallbackUrl: string | null }>(
        `${BASE}/api/smart-links/${id}`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    delete: (id: string) =>
      request<void>(`${BASE}/api/smart-links/${id}`, { method: "DELETE" }),
  },
};
