// In production this must point at the deployed backend (set VITE_API_BASE_URL at build time) -
// the localhost fallback only works for local dev, where the backend runs on :4000.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  // Skip forcing JSON content-type for FormData bodies (file uploads) - the browser
  // needs to set its own multipart boundary.
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? 'Something went wrong.');
  }
  return data as T;
}
