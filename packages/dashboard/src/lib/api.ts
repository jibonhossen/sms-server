import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'your-secret-key-change-in-production';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
});

// Device types
export interface Device {
  id: string;
  deviceId: string;
  name: string | null;
  username: string;
  status: string;
  isActive: boolean;
  lastSeenAt: string | null;
  lastPingAt: string | null;
  totalSent: number;
  totalFailed: number;
  priority: number;
  // Health data
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  appVersion: string | null;
  connectionStatus: boolean | null;
  failedMessagesHour: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceRequest {
  deviceId: string;
  name?: string;
  username: string;
  password: string;
  priority?: number;
}

// SIM Card types
export interface SimCard {
  id: string;
  deviceId: string;
  simNumber: number;
  phoneNumber: string | null;
  name: string | null;
  totalSmsLimit: number;
  smsUsed: number;
  smsRemaining: number;
  dailySmsLimit: number;
  dailySmsSent: number;
  isActive: boolean;
  status: string;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
}

export interface UpdateBalanceRequest {
  totalLimit: number;
}

export interface UpdateDailyLimitRequest {
  dailyLimit: number;
}

export interface UpdateSimStatusRequest {
  isActive: boolean;
}

// Message types
export interface Message {
  id: string;
  externalId: string | null;
  phoneNumbers: string[];
  textContent: string;
  status: string;
  priority: number;
  deviceId: string | null;
  simCardId: string | null;
  simNumber: number | null;
  retryCount: number;
  errorMessage: string | null;
  failedReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface SendMessageRequest {
  externalId?: string;
  phoneNumbers: string[];
  textContent: string;
  priority?: number;
}

// API functions
export const deviceApi = {
  getAll: () => api.get<{ success: boolean; data: Device[] }>('/devices'),
  getById: (id: string) => api.get<{ success: boolean; data: Device }>(`/devices/${id}`),
  create: (data: CreateDeviceRequest) => api.post<{ success: boolean; data: Device }>('/devices', data),
  update: (id: string, data: Partial<Device>) => api.patch<{ success: boolean; data: Device }>(`/devices/${id}`, data),
  delete: (id: string) => api.delete(`/devices/${id}`),
  getSims: (id: string) => api.get<{ success: boolean; data: SimCard[] }>(`/devices/${id}/sims`),
};

export const simApi = {
  getById: (id: string) => api.get<{ success: boolean; data: SimCard }>(`/sims/${id}`),
  updateBalance: (id: string, data: UpdateBalanceRequest) => 
    api.patch<{ success: boolean; data: SimCard }>(`/sims/${id}/balance`, data),
  updateDailyLimit: (id: string, data: UpdateDailyLimitRequest) => 
    api.patch<{ success: boolean; data: SimCard }>(`/sims/${id}/daily-limit`, data),
  updateStatus: (id: string, data: UpdateSimStatusRequest) => 
    api.patch<{ success: boolean; data: SimCard }>(`/sims/${id}/status`, data),
  getUsage: (id: string, days?: number) => 
    api.get<{ success: boolean; data: unknown[] }>(`/sims/${id}/usage`, { params: { days } }),
};

export const messageApi = {
  getAll: (limit?: number, offset?: number) => 
    api.get<{ success: boolean; data: Message[] }>('/messages', { params: { limit, offset } }),
  getById: (id: string) => api.get<{ success: boolean; data: Message }>(`/messages/${id}`),
  send: (data: SendMessageRequest) => api.post<{ success: boolean; data: Message }>('/messages', data),
};

// Webhook types
export interface Webhook {
  id: string;
  deviceId: string;
  webhookId: string;
  url: string;
  event: string;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface WebhookEvent {
  value: string;
  label: string;
  description: string;
}

export interface CreateWebhookRequest {
  url: string;
  event: string;
}

// Webhook API
export const webhookApi = {
  getByDevice: (deviceId: string) => 
    api.get<{ success: boolean; data: Webhook[] }>(`/devices/${deviceId}/webhooks`),
  create: (deviceId: string, data: CreateWebhookRequest) => 
    api.post<{ success: boolean; data: Webhook }>(`/devices/${deviceId}/webhooks`, data),
  delete: (webhookId: string) => 
    api.delete(`/webhooks/${webhookId}`),
  toggleStatus: (webhookId: string, isActive: boolean) => 
    api.patch<{ success: boolean }>(`/webhooks/${webhookId}/status`, { isActive }),
  getEvents: () => 
    api.get<{ success: boolean; data: WebhookEvent[] }>('/webhooks/events'),
};
