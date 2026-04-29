import { getStoredToken } from "./session";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET ?? "";

type ApiOptions = RequestInit & { admin?: boolean };

async function request<T>(path: string, options?: ApiOptions): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options?.admin && ADMIN_SECRET) {
    headers["x-admin-secret"] = ADMIN_SECRET;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

export const api = {
  // Public / Meta
  getMeta: () => request("/meta"),
  getProfile: (userId: string) => request(`/profile/${userId}`), // kept for public view
  
  // Auth
  requestCode: (email: string) => request("/auth/request-code", { method: "POST", body: JSON.stringify({ email }) }),
  verifyCode: (email: string, code: string, fullName: string, inviteCode?: string) => 
    request<{ token: string, user: any, isNew: boolean }>("/auth/verify-code", { 
      method: "POST", 
      body: JSON.stringify({ email, code, fullName, inviteCode }) 
    }),

  // Onboarding
  getQuestions: () => request("/onboarding/questions"),
  saveProfile: (payload: unknown) => request("/onboarding/profile", { method: "POST", body: JSON.stringify(payload) }),
  submitSurvey: (template: string, answers: unknown) => request("/onboarding/survey", { method: "POST", body: JSON.stringify({ template, answers }) }),
  regeneratePersona: () => request("/onboarding/persona/regenerate", { method: "POST" }),

  // Matches & Workflow
  saveAvailability: (availability: string[]) => request("/workflow/availability", { method: "POST", body: JSON.stringify({ availability }) }),
  getCurrentMatch: () => request("/matches/current"),
  respondToMatch: (matchId: string, choice: "yes" | "no") => request(`/workflow/${matchId}/respond`, { method: "POST", body: JSON.stringify({ choice }) }),
  confirmSlot: (matchId: string, slot: string) => request(`/workflow/${matchId}/confirm-slot`, { method: "POST", body: JSON.stringify({ slot }) }),
  pickPlace: (matchId: string) => request(`/workflow/${matchId}/pick-place`, { method: "POST" }),
  markHappened: (matchId: string) => request(`/workflow/${matchId}/mark-happened`, { method: "POST" }),

  // Feedback
  submitFeedback: (matchId: string, template: string, answers: unknown, sentiment?: "love" | "pass" | "rematch") => 
    request(`/feedback/${matchId}/submit`, { method: "POST", body: JSON.stringify({ template, answers, sentiment }) }),

  // Memory
  getMemory: () => request("/memory/me"),
  getHistory: () => request("/memory/history"),
  getSurveys: () => request("/memory/surveys"),

  // Admin / Dev
  runMatchmaking: (useLlmJudge = true) => request("/matches/run", { method: "POST", admin: true, body: JSON.stringify({ useLlmJudge }) }),
  getAdminOverview: () => request("/admin/overview", { admin: true }),
  resetDemo: () => request("/dev/reset", { method: "POST", admin: true }),
  triggerDrop: () => request("/workflow/drop", { method: "POST", admin: true }),
  createDevUser: (payload: { email: string; fullName: string; universityId?: string; stage?: "basic" | "life" | "mind" | "social" | "complete" }) =>
    request<{ token: string; user: any }>("/dev/users", { method: "POST", admin: true, body: JSON.stringify(payload) }),
  loginAsDevUser: (payload: { userId?: string; email?: string }) =>
    request<{ token: string; user: any }>("/dev/login-as", { method: "POST", admin: true, body: JSON.stringify(payload) })
};
