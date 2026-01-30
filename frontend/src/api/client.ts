import { getToken, emitLogout } from "../lib/auth-storage";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { ...init, headers });
  if (res.status === 401) emitLogout();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export const api = {
  auth: {
    login: (body: { email: string; password: string }) =>
      request<{ user: AuthUser; token: string }>(`${BASE}/api/auth/login`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    register: (body: { email: string; password: string; name?: string }) =>
      request<{ user: AuthUser; token: string }>(`${BASE}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    me: () =>
      request<{ user: AuthUser }>(`${BASE}/api/auth/me`),
  },

  overview: () =>
    request<{
      campaigns: number;
      endpoints: number;
      links: number;
      activeEndpoints: number;
    }>(`${BASE}/api/overview`),

  campaigns: {
    list: () =>
      request<
        Array<{
          id: string;
          name: string;
          createdAt: string;
          _count: { endpoints: number; links: number };
        }>
      >(`${BASE}/api/campaigns`),
    get: (id: string) =>
      request<{
        id: string;
        name: string;
        createdAt: string;
        autoCheckEnabled?: boolean;
        autoCheckInterval?: number;
        endpoints: Array<{
          id: string;
          url: string;
          priority: number;
          isActive: boolean;
        }>;
        links: Array<{ id: string; slug: string; fallbackUrl: string | null }>;
      }>(`${BASE}/api/campaigns/${id}`),
    create: (body: { name: string }) =>
      request<{ id: string; name: string }>(`${BASE}/api/campaigns`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: { name?: string; autoCheckEnabled?: boolean; autoCheckInterval?: number }) =>
      request<{ id: string; name: string }>(`${BASE}/api/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<void>(`${BASE}/api/campaigns/${id}`, { method: "DELETE" }),
  },
  endpoints: {
    create: (body: { campaignId: string; url: string; priority?: number }) =>
      request<{ id: string; url: string; priority: number }>(`${BASE}/api/campaigns/endpoints`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    check: (id: string) =>
      request<{ ok: boolean; error?: string; status?: number; inactiveReason?: string; reason?: string; wasDeactivated?: boolean }>(`${BASE}/api/endpoints/${id}/check`, {
        method: "POST",
      }),
    update: (id: string, body: { url?: string; priority?: number; isActive?: boolean }) =>
      request<{ id: string; url: string; priority: number; isActive: boolean }>(`${BASE}/api/endpoints/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<void>(`${BASE}/api/endpoints/${id}`, { method: "DELETE" }),
  },

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
          lastCheckedAt: string | null;
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
    check: (id: string) =>
      request<{ ok: boolean; error?: string; status?: number; inactiveReason?: string }>(
        `${BASE}/api/checkouts/${id}/check`,
        { method: "POST" }
      ),
  },

  smartLinks: {
    list: (campaignId?: string) =>
      request<
        Array<{
          id: string;
          slug: string;
          campaignId: string;
          fallbackUrl: string | null;
          campaign: { id: string; name: string };
        }>
      >(`${BASE}/api/smart-links`, { params: campaignId ? { campaignId } : {} }),
    get: (id: string) =>
      request<{
        id: string;
        slug: string;
        campaignId: string;
        fallbackUrl: string | null;
        campaign: {
          id: string;
          name: string;
          endpoints: Array<{ id: string; url: string; isActive: boolean }>;
        };
      }>(`${BASE}/api/smart-links/${id}`),
    checkSlug: (slug: string) =>
      request<{
        available: boolean;
        error?: string;
        suggestions?: string[];
      }>(`${BASE}/api/smart-links/check-slug/${encodeURIComponent(slug)}`),
    create: (body: {
      slug: string;
      campaignId?: string;
      groupId?: string;
      fallbackUrl?: string | null;
    }) =>
      request<{ id: string; slug: string; campaignId: string; fallbackUrl: string | null }>(
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
