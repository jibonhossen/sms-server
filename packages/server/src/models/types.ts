// Device Status
export type DeviceStatus = 'online' | 'offline' | 'error';

// SIM Card Status
export type SimCardStatus = 'active' | 'paused' | 'no_balance' | 'error' | 'unknown';

// Message Status
export type MessageStatus = 
  | 'pending' 
  | 'queued' 
  | 'sending' 
  | 'sent' 
  | 'delivered' 
  | 'failed';

// Failed Reason
export type FailedReason = 
  | 'daily_limit_exceeded' 
  | 'no_balance' 
  | 'device_offline'
  | 'sim_error'
  | 'api_error'
  | 'unknown';

// Webhook Event Types
export type WebhookEventType = 
  | 'sms:received'
  | 'sms:data-received'
  | 'mms:received'
  | 'sms:sent'
  | 'sms:delivered'
  | 'sms:failed'
  | 'system:ping';

// Health Check from Ping
export interface HealthCheck {
  status: 'pass' | 'fail';
  version?: string;
  releaseId?: number;
  checks?: {
    [key: string]: {
      description: string;
      observedUnit: string;
      observedValue: number | boolean | string;
      status: 'pass' | 'fail';
    };
  };
}

// SMS-Gate Webhook Payload
export interface SmsGateWebhookPayload {
  deviceId: string;
  event: WebhookEventType;
  id: string;
  payload: {
    messageId?: string;
    message?: string;
    sender?: string;
    recipient?: string;
    phoneNumber?: string;
    simNumber?: number;
    receivedAt?: string;
    sentAt?: string;
    deliveredAt?: string;
    failedAt?: string;
    reason?: string;
    partsCount?: number;
    health?: HealthCheck;
  };
  webhookId: string;
}

// Send Message Request
export interface SendMessageRequest {
  externalId?: string;
  phoneNumbers: string[];
  textContent: string;
  priority?: number;
  deviceId?: string;
  simNumber?: number;
}

// Device Config
export interface DeviceConfig {
  deviceId: string;
  name?: string;
  username: string;
  password: string;
  priority?: number;
}

// SIM Config
export interface SimConfig {
  simNumber: number;
  phoneNumber?: string;
  name?: string;
  totalSmsLimit?: number;
  dailySmsLimit?: number;
}

// Health Status
export interface HealthStatus {
  isHealthy: boolean;
  lastSeen?: Date;
  reason?: string;
}
