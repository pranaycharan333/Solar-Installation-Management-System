/**
 * SolarOps Intelligence — API Client
 * Connects frontend to the Node.js/Express/PostgreSQL backend
 */

// In development, route API calls through Vite's same-origin proxy. This avoids
// browser-specific localhost/CORS failures between ports 5173 and 5000.
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('solarops_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `API error: ${res.status} ${res.statusText}`);
    }

    return data;
  } catch (err: any) {
    console.error(`API Request Failed: ${endpoint}`, err);
    throw err;
  }
}

export const api = {
  // Auth
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ success: boolean; token: string; user: any; message: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    googleLogin: (credential: string) =>
      request<{ success: boolean; token: string; user: any }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      }),
    getNotifications: () => request<{ success: boolean; data: any[] }>('/api/auth/notifications'),
    markNotificationsRead: () => request<{ success: boolean }>('/api/auth/notifications/read', { method: 'PATCH' }),
    register: (userData: any) =>
      request<{ success: boolean; token: string; user: any; message: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    me: () => request<{ success: boolean; user: any }>('/api/auth/me'),
    updateProfile: (data: { fullName: string; phone: string; address: string }) =>
      request<{ success: boolean; user: any; message: string }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // Projects / Installation Requests
  projects: {
    getAll: () => request<{ success: boolean; data: any[] }>('/api/projects'),
    getById: (id: number) => request<{ success: boolean; data: any }>(`/api/projects/${id}`),
    create: (data: {
      projectName: string;
      systemCapacityKw: number;
      systemType: string;
      installationAddress: string;
      notes?: string;
    }) =>
      request<{ success: boolean; message: string; data: any }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: number, data: { status?: string; progress?: number; notes?: string }) =>
      request<{ success: boolean; message: string; data: any }>(`/api/projects/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Admin Operations
  admin: {
    getMetrics: () => request<{ success: boolean; data: any }>('/api/admin/metrics'),
    getTechnicians: () => request<{ success: boolean; data: any[] }>('/api/admin/technicians'),
    getCustomers: () => request<{ success: boolean; data: any[] }>('/api/admin/customers'),
    createTechnician: (techData: {
      fullName: string;
      email: string;
      phone: string;
      skills?: string;
      certificationNumber?: string;
      temporaryPassword: string;
    }) =>
      request<{ success: boolean; message: string; technician: any }>('/api/admin/technicians', {
        method: 'POST',
        body: JSON.stringify(techData),
      }),
    updateTechnicianCredentials: (id: number, data: { email?: string; temporaryPassword?: string }) =>
      request<{ success: boolean; message: string; technician: any }>(`/api/admin/technicians/${id}/credentials`, { method: 'PATCH', body: JSON.stringify(data) }),
    setTechnicianActive: (id: number, active: boolean) =>
      request<{ success: boolean; message: string }>(`/api/admin/technicians/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    assignTechnician: (data: {
      projectId: number;
      technicianId: number;
      assignmentType: string;
      scheduledDate?: string;
      notes?: string;
    }) =>
      request<{ success: boolean; message: string; assignment: any }>('/api/admin/assign-technician', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAuditLogs: () => request<{ success: boolean; data: any[] }>('/api/admin/audit-logs'),
    getInsights: () => request<{ success: boolean; data: any }>('/api/admin/insights'),
  },

  // Site Surveys
  surveys: {
    submit: (surveyData: {
      projectId: number;
      roofType: string;
      roofAreaSqft: number;
      shadingCondition: string;
      structuralFeasibility: string;
      electricalPanelCondition: string;
      proposedCapacityKw: number;
      surveyNotes?: string;
    }) =>
      request<{ success: boolean; message: string; data: any }>('/api/surveys', {
        method: 'POST',
        body: JSON.stringify(surveyData),
      }),
    getByProject: (projectId: number) =>
      request<{ success: boolean; data: any[] }>(`/api/surveys/project/${projectId}`),
  },

  // Estimates / Quotations
  estimates: {
    create: (data: {
      projectId: number;
      items: { materialId: number; quantity: number }[];
      serviceCharge?: number;
      subsidyAmount: number;
      validityDays?: number;
      terms?: string;
    }) =>
      request<{ success: boolean; message: string; data: any }>('/api/estimates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    takeAction: (id: number, action: 'APPROVE' | 'REJECT') =>
      request<{ success: boolean; message: string; data: any }>(`/api/estimates/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    getByProject: (projectId: number) =>
      request<{ success: boolean; data: any[] }>(`/api/estimates/project/${projectId}`),
  },

  // Inventory & Materials
  inventory: {
    getAll: () => request<{ success: boolean; data: any[] }>('/api/inventory'),
    getCatalog: () => request<{ success: boolean; data: any[] }>('/api/inventory/catalog'),
    createMaterial: (data: { name: string; category: string; unit: string; unitCost: number; quantityOnHand: number }) => request<{ success: boolean; data: any }>('/api/inventory/materials', { method: 'POST', body: JSON.stringify(data) }),
    adjustStock: (data: { materialId: number; quantityChange: number; reason: string }) =>
      request<{ success: boolean; message: string; data: any }>('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Checklists
  checklists: {
    getByProject: (projectId: number) =>
      request<{ success: boolean; data: any[] }>(`/api/checklists/project/${projectId}`),
    toggle: (id: number, data?: { isCompleted?: boolean; remarks?: string }) =>
      request<{ success: boolean; message: string; data: any; projectProgress: number; projectStatus: string }>(
        `/api/checklists/${id}/toggle`,
        {
          method: 'PATCH',
          body: JSON.stringify(data || {}),
        }
      ),
  },

  // Service Desk
  services: {
    getAll: () => request<{ success: boolean; data: any[] }>('/api/services'),
    create: (ticketData: { projectId?: number; category: 'MAINTENANCE' | 'COMPLAINT'; issueDescription: string; priority: string; photoData?: string }) =>
      request<{ success: boolean; message: string; data: any }>('/api/services', {
        method: 'POST',
        body: JSON.stringify(ticketData),
      }),
    update: (id: number, data: { status?: string; resolutionNotes?: string; technicianId?: number; visualFinding?: string }) =>
      request<{ success: boolean; message: string; data: any }>(`/api/services/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getPhoto: async (id: number) => {
      const res = await fetch(`${API_BASE_URL}/api/services/${id}/photo`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error(`Could not load customer photo (${res.status})`);
      return URL.createObjectURL(await res.blob());
    },
  },

  // Warranties
  warranties: {
    getAll: () => request<{ success: boolean; data: any[] }>('/api/warranties'),
  },

  // Payments
  payments: {
    record: (data: { projectId: number; amount: number; paymentStage: string; paymentMethod?: string }) =>
      request<{ success: boolean; message: string; data: any }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getByProject: (projectId: number) =>
      request<{ success: boolean; data: any[] }>(`/api/payments/project/${projectId}`),
  },

  // AI/ML Integration
  ai: {
    getDemandForecast: () =>
        request<{ success: boolean; advisory_notice: string; data: { source: string; demo_data: boolean; reports: any[]; predictions: any[] } }>('/api/ai/forecast-demand'),
    analyzeRoof: (photoUrl: string) =>
      request<{ success: boolean; data: any }>('/api/ai/roof-analysis', {
        method: 'POST',
        body: JSON.stringify({ photoUrl }),
      }),
  },
};
