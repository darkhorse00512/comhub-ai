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

interface AgentCallHistoryItem {
  id: string;
  status: "ringing" | "active" | "ended" | "failed";
  direction: "inbound" | "outbound";
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
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
      // First check if token is expired
      try {
        const payload = JSON.parse(atob(cachedToken.split(".")[1]));
        console.log("[AUTH] Cached token found, expires:", new Date(payload.exp * 1000));

        if (payload.exp && payload.exp * 1000 <= Date.now()) {
          console.log("[AUTH] Cached token expired, clearing it");
          localStorage.removeItem("backend_token");
        } else {
          // Token not expired, but verify it's actually valid with backend
          console.log("[AUTH] Verifying cached token with backend...");
          try {
            const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${cachedToken}`,
              },
            });

            if (verifyResponse.ok) {
              console.log("[AUTH] Cached token is valid, using it");
              return cachedToken;
            } else {
              console.log("[AUTH] Cached token invalid (401), clearing it");
              localStorage.removeItem("backend_token");
            }
          } catch (verifyError) {
            console.log("[AUTH] Token verification failed, clearing it:", verifyError);
            localStorage.removeItem("backend_token");
          }
        }
      } catch (e) {
        console.log("[AUTH] Invalid cached token format, clearing it:", e);
        localStorage.removeItem("backend_token");
      }
    } else {
      console.log("[AUTH] No cached token found");
    }

    // Exchange Supabase token for backend JWT
    console.log("[AUTH] Attempting login with email:", session.user.email);
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
      console.log("[AUTH] Login failed, status:", response.status);
      const loginError = await response.json().catch(() => ({}));
      console.log("[AUTH] Login error details:", loginError);

      // Try to register if login fails
      console.log("[AUTH] Attempting registration with userId:", session.user.id);
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
        console.log("[AUTH] Registration successful!");
        if (registerData.token) {
          localStorage.setItem("backend_token", registerData.token);
          return registerData.token;
        }
      } else {
        const registerError = await registerResponse.json().catch(() => ({}));
        console.error("[AUTH] Registration failed:", registerError);
      }

      // Fallback to stored token
      console.log("[AUTH] Using fallback token from localStorage");
      return localStorage.getItem("backend_token");
    }

    const data = (await response.json()) as BackendResponse<{ token: string }>;
    console.log("[AUTH] Login successful!");
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
  console.log("[AUTH HEADERS] Token obtained:", token ? `${token.substring(0, 20)}...` : "null");
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

  async getAgentCallHistory(agentId: string): Promise<ApiResponse<AgentCallHistoryItem[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/agent/${agentId}/history`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch agent call history");
      }

      const data = await response.json();
      return {
        data: data.callSessions || [],
        error: null,
      };
    } catch (error) {
      console.error("Error fetching agent call history:", error);
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
    phoneNumber: string
  ): Promise<ApiResponse<{ callId: string; callSession: any }>> {
    try {
      if (!phoneNumber) {
        throw new Error("Phone number is required");
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/initiate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phoneNumber,
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

  // Test inbound call - simulates an inbound call for testing
  // If phoneNumber is provided, makes an actual Twilio call to that number
  async testInboundCall(phoneNumber?: string): Promise<ApiResponse<{ callSessionId: string; callSid: string; message: string }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/test-inbound`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to test inbound call");
      }

      const data = await response.json();
      return {
        data: {
          callSessionId: data.callSessionId,
          callSid: data.callSid,
          message: data.message,
        },
        error: null,
      };
    } catch (error) {
      console.error("Error testing inbound call:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Phone Numbers APIs
  async getPhoneNumbers(): Promise<ApiResponse<any[]>> {
    try {
      console.log("[PHONE NUMBERS] Fetching phone numbers...");
      const headers = await getAuthHeaders();
      console.log("[PHONE NUMBERS] Headers prepared:", headers);
      const response = await fetch(`${API_BASE_URL}/phone-numbers`, {
        method: "GET",
        headers,
      });

      console.log("[PHONE NUMBERS] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("[PHONE NUMBERS] Error response:", errorData);
        throw new Error(errorData.error || "Failed to fetch phone numbers");
      }

      const data = await response.json();
      console.log("[PHONE NUMBERS] Success:", data);
      return { data: data.data || [], error: null };
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async searchAvailableNumbers(countryCode: string, areaCode?: string, capabilities?: { voice?: boolean; sms?: boolean }): Promise<ApiResponse<any[]>> {
    try {
      console.log("[SEARCH] Searching for available numbers:", { countryCode, areaCode, capabilities });
      const headers = await getAuthHeaders();

      const params = new URLSearchParams({
        countryCode,
        ...(areaCode && { areaCode }),
        ...(capabilities && { capabilities: JSON.stringify(capabilities) }),
        limit: '10'
      });

      const response = await fetch(`${API_BASE_URL}/phone-numbers/search/available?${params}`, {
        method: "GET",
        headers,
      });

      console.log("[SEARCH] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("[SEARCH] Error response:", errorData);
        throw new Error(errorData.error || errorData.details || "Failed to search available numbers");
      }

      const data = await response.json();
      console.log("[SEARCH] Success:", data);

      // Return data with optional message about filtered numbers
      return {
        data: data.data || [],
        error: null,
        message: data.message
      } as any;
    } catch (error) {
      console.error("[SEARCH] Error searching numbers:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async purchasePhoneNumber(phoneNumber: string, countryCode?: string): Promise<ApiResponse<any>> {
    try {
      console.log("[PURCHASE] Requesting phone number purchase:", { phoneNumber, countryCode });
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/phone-numbers/purchase`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phoneNumber, countryCode }),
      });

      console.log("[PURCHASE] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("[PURCHASE] Error response:", errorData);
        throw new Error(errorData.error || errorData.details || "Failed to purchase phone number");
      }

      const data = await response.json();
      console.log("[PURCHASE] Success:", data);
      return { data: data.data, error: null };
    } catch (error) {
      console.error("[PURCHASE] Error purchasing phone number:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async importPhoneNumber(accountSid: string, authToken: string, phoneNumberSid: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/phone-numbers/import`, {
        method: "POST",
        headers,
        body: JSON.stringify({ accountSid, authToken, phoneNumberSid }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to import phone number");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error importing phone number:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async updatePhoneNumber(id: string, updates: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/phone-numbers/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update phone number");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error updating phone number:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async deletePhoneNumber(id: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/phone-numbers/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete phone number");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error deleting phone number:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Groups APIs
  async getGroups(): Promise<ApiResponse<any[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch groups");
      }

      const data = await response.json();
      return { data: data.data || [], error: null };
    } catch (error) {
      console.error("Error fetching groups:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async createGroup(name: string, description?: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create group");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error creating group:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async updateGroup(id: string, updates: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/groups/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update group");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error updating group:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async deleteGroup(id: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/groups/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete group");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error deleting group:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Agents APIs
  async getAgents(): Promise<ApiResponse<any[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch agents");
      }

      const data = await response.json();
      return { data: data.data || [], error: null };
    } catch (error) {
      console.error("Error fetching agents:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async getAgent(id: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents/${id}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch agent");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error fetching agent:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async createAgent(agent: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents`, {
        method: "POST",
        headers,
        body: JSON.stringify(agent),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create agent");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error creating agent:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async updateAgent(id: string, updates: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update agent");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error updating agent:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async deleteAgent(id: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete agent");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error deleting agent:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async cloneAgent(id: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents/${id}/clone`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to clone agent");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error cloning agent:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Account APIs
  async deleteAccount(): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/account`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete account");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error deleting account:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Settings APIs
  async getSettings(): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch settings");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error fetching settings:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async updateSettings(settings: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update settings");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error updating settings:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async getUsageStatistics(days: number = 30): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/settings/usage?days=${days}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch usage statistics");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error fetching usage statistics:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Feedback APIs
  async submitFeedback(type: string, subject: string, message: string, email?: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ type, subject, message, email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit feedback");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error submitting feedback:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async getFeedback(): Promise<ApiResponse<any[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch feedback");
      }

      const data = await response.json();
      return { data: data.data || [], error: null };
    } catch (error) {
      console.error("Error fetching feedback:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Test Call Session APIs - For saving test calls to history
  async createTestCallSession(
    agentId: string,
    direction: "inbound" | "outbound"
  ): Promise<ApiResponse<{ callSessionId: string }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/test-session`, {
        method: "POST",
        headers,
        body: JSON.stringify({ agentId, direction }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create test call session");
      }

      const data = await response.json();
      return { data: { callSessionId: data.callSessionId }, error: null };
    } catch (error) {
      console.error("Error creating test call session:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async addTestCallMessage(
    callSessionId: string,
    role: "user" | "ai",
    content: string
  ): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/${callSessionId}/test-message`, {
        method: "POST",
        headers,
        body: JSON.stringify({ role, content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add test call message");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error adding test call message:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Agent Version History APIs
  async getAgentVersions(agentId: string): Promise<ApiResponse<any[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents/${agentId}/versions`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch agent versions");
      }

      const data = await response.json();
      return { data: data.data || [], error: null };
    } catch (error) {
      console.error("Error fetching agent versions:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async restoreAgentVersion(agentId: string, versionId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/agents/${agentId}/versions/${versionId}/restore`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to restore agent version");
      }

      const data = await response.json();
      return { data: data.data, error: null };
    } catch (error) {
      console.error("Error restoring agent version:", error);
      return { data: null, error: (error as Error).message };
    }
  },

  async endTestCallSession(callSessionId: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/calls/${callSessionId}/end-test`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to end test call session");
      }

      return { data: undefined, error: null };
    } catch (error) {
      console.error("Error ending test call session:", error);
      return { data: null, error: (error as Error).message };
    }
  },
};

export type { CallHistoryItem, AgentCallHistoryItem, ApiResponse };
