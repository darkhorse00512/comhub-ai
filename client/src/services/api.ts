const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

// Build full recording URL from relative path
const buildRecordingUrl = (relativePath: string | null | undefined): string | undefined => {
  if (!relativePath) return undefined;
  // If it's already a full URL, return as-is
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  // Build full URL from relative path (e.g., /api/recordings/xxx.mp3)
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${relativePath}`;
};

interface CallHistoryItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
  status: "ringing" | "active" | "ended" | "failed";
  direction: "inbound" | "outbound";
  callerNumber: string | null;
  calleeNumber: string | null;
  transcript?: string;
  recordingUrl?: string;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

interface BackendResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  callSession?: T;
  callSessions?: T[];
  messages?: T[];
  user?: T;
  token?: string;
}

// Bulk Call Types
export interface BulkCallJob {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  activeCalls?: number;
  results?: BulkCallResult[];
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface BulkCallResult {
  phoneNumber: string;
  status: 'pending' | 'calling' | 'answered' | 'completed' | 'failed' | 'no_answer' | 'busy';
  duration: number;
  error?: string;
  callSessionId?: string;
}

// Get backend JWT token from Supabase session
const getBackendToken = async (): Promise<string | null> => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token || !session.user.email) {
      // Fallback to stored token
      return localStorage.getItem("backend_token");
    }

    // Check if we have a valid cached token
    const cachedToken = localStorage.getItem("backend_token");
    if (cachedToken) {
      // Verify token is still valid by checking expiry (simple check)
      try {
        const payload = JSON.parse(atob(cachedToken.split(".")[1]));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          return cachedToken;
        }
      } catch {
        // Invalid token format, continue to get new one
      }
    }

    // Exchange Supabase token for backend JWT
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: session.user.email,
        supabaseToken: session.access_token,
      }),
    });

    if (!response.ok) {
      // Try to register if login fails
      const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: session.user.email,
          supabaseUserId: session.user.id,
        }),
      });

      if (registerResponse.ok) {
        const registerData =
          (await registerResponse.json()) as BackendResponse<{ token: string }>;
        if (registerData.token) {
          localStorage.setItem("backend_token", registerData.token);
          return registerData.token;
        }
      }

      // Fallback to stored token
      return localStorage.getItem("backend_token");
    }

    const data = (await response.json()) as BackendResponse<{ token: string }>;
    if (data.token) {
      localStorage.setItem("backend_token", data.token);
      return data.token;
    }

    // Fallback to stored token
    return localStorage.getItem("backend_token");
  } catch (error) {
    console.error("Error getting backend token:", error);
    // Fallback to stored token
    return localStorage.getItem("backend_token");
  }
};

const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getBackendToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const api = {
  async getCallHistory(): Promise<ApiResponse<CallHistoryItem[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/history`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch call history");
      }

      const data = (await response.json()) as BackendResponse<
        CallHistoryItem[]
      > & { callSessions?: CallHistoryItem[] };

      // Map recording URLs to full URLs
      const sessions = (data.callSessions || data.data || []).map((session: any) => ({
        ...session,
        recordingUrl: buildRecordingUrl(session.recordingUrl),
      }));

      return {
        data: sessions,
        error: null,
      };
    } catch (error) {
      console.error("Error fetching call history:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async getCallDetails(callId: string): Promise<ApiResponse<CallHistoryItem>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/${callId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch call details");
      }

      const data = (await response.json()) as BackendResponse<CallHistoryItem>;
      const session = data.callSession as CallHistoryItem;
      return {
        data: session ? {
          ...session,
          recordingUrl: buildRecordingUrl((session as any).recordingUrl),
        } : null,
        error: null,
      };
    } catch (error) {
      console.error("Error fetching call details:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async getCallMessages(callId: string): Promise<ApiResponse<any[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/${callId}/messages`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch call messages");
      }

      const data = (await response.json()) as BackendResponse<any[]>;
      return {
        data: data.messages || [],
        error: null,
      };
    } catch (error) {
      console.error("Error fetching call messages:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async startCall(
    phoneNumber?: string
  ): Promise<ApiResponse<{ callId: string; callSession: any }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/initiate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phoneNumber: phoneNumber || "+1234567890", // Default for AI-only calls
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.details || "Failed to start call"
        );
      }

      const data = (await response.json()) as BackendResponse<{ id: string }>;
      return {
        data: {
          callId: data.callSession?.id || "",
          callSession: data.callSession,
        },
        error: null,
      };
    } catch (error) {
      console.error("Error starting call:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async endCall(callId: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/${callId}/end`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to end call");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error ending call:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async sendMessage(
    callId: string,
    message: string
  ): Promise<ApiResponse<{ aiResponse: string; audioUrl?: string }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/${callId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send message");
      }

      const responseData = (await response.json()) as {
        success: boolean;
        aiResponse?: string;
        audioUrl?: string;
        error?: string;
      };
      return {
        data: {
          aiResponse: responseData.aiResponse || "",
          audioUrl: responseData.audioUrl,
        },
        error: null,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Bulk Calling APIs
  async createBulkCallJob(phoneNumbers: string[]): Promise<ApiResponse<BulkCallJob>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/bulk-calls/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phoneNumbers }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create bulk call job");
      }

      const data = await response.json();
      return { data: data.job, error: null };
    } catch (error) {
      console.error("Error creating bulk call job:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async startBulkCallJob(jobId: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/bulk-calls/jobs/${jobId}/start`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start bulk call job");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error starting bulk call job:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async cancelBulkCallJob(jobId: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/bulk-calls/jobs/${jobId}/cancel`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to cancel bulk call job");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error cancelling bulk call job:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async getBulkCallJobStatus(jobId: string): Promise<ApiResponse<BulkCallJob>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/bulk-calls/jobs/${jobId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get bulk call job status");
      }

      const data = await response.json();
      return { data: data.job, error: null };
    } catch (error) {
      console.error("Error getting bulk call job status:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async getUserBulkCallJobs(): Promise<ApiResponse<BulkCallJob[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/bulk-calls/jobs`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get bulk call jobs");
      }

      const data = await response.json();
      return { data: data.jobs || [], error: null };
    } catch (error) {
      console.error("Error getting bulk call jobs:", error);
      return { data: null, error: (error as Error).message };
    }
  },
};

export type { CallHistoryItem, ApiResponse };
