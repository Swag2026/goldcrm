const BASE = import.meta.env.VITE_API_URL || "";

let token = null;
try { token = localStorage.getItem("gc_token"); } catch { /* ignore */ }
let onUnauthorized = () => {};

export const setToken = (t) => {
  token = t;
  try { t ? localStorage.setItem("gc_token", t) : localStorage.removeItem("gc_token"); } catch { /* ignore */ }
};
export const getToken = () => token;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = "GET", body, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    onUnauthorized();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join(", ") : msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return raw ? res : res.json();
}

const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.set(k, v); });
  return p.toString();
};

export const api = {
  login: (username, password) => request("/api/auth/login", { method: "POST", body: { username, password } }),
  me: () => request("/api/auth/me"),
  changePassword: (current, next) => request("/api/auth/password", { method: "POST", body: { current, new: next } }),

  customers: (params) => request(`/api/customers?${qs(params)}`),
  customer: (id) => request(`/api/customers/${id}`),
  patchCustomer: (id, body) => request(`/api/customers/${id}`, { method: "PATCH", body }),
  assign: (ids, user_id) => request("/api/customers/assign", { method: "POST", body: { ids, user_id } }),
  addFollowup: (id, body) => request(`/api/customers/${id}/followups`, { method: "POST", body }),
  patchFollowup: (id, body) => request(`/api/followups/${id}`, { method: "PATCH", body }),
  deleteFollowup: (id) => request(`/api/followups/${id}`, { method: "DELETE" }),
  exportXlsx: async (params) => {
    const res = await request(`/api/customers/export.xlsx?${qs(params)}`, { raw: true });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gold-customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  collectors: () => request("/api/collectors"),
  users: () => request("/api/users"),
  createUser: (body) => request("/api/users", { method: "POST", body }),
  patchUser: (id, body) => request(`/api/users/${id}`, { method: "PATCH", body }),

  overview: () => request("/api/overview"),
  myday: (scope) => request(`/api/myday?${qs({ scope })}`),
  sync: () => request("/api/sync", { method: "POST" }),
  kpi: (params) => request(`/api/kpi?${qs(params)}`),
};
