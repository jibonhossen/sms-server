# SMS Gateway Server - Complete Architecture Plan

## System Overview

This SMS gateway server acts as a middleware between your application servers and the SMS-Gate Android app. It provides:

- **Request Queueing**: Incoming SMS requests are saved to DB and queued for processing
- **Multi-Device Management**: Supports multiple SMS-Gate devices for high availability
- **Multi-SIM Support**: Each device has 2 SIMs with independent balance and daily limits
- **Health Monitoring**: Real-time device status via webhooks + API polling fallback
- **Balance Tracking**: Manual SMS balance entry per SIM via Next.js Dashboard
- **Daily Limits**: Per-SIM daily sending limits to avoid carrier restrictions
- **Webhook Integration**: Receives delivery status updates from SMS-Gate
- **Management Dashboard**: Next.js web interface for device and SIM management

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Your App       │────▶│  SMS Gateway     │────▶│  SMS-Gate Cloud │
│  Servers        │     │  Server (This)   │     │  API            │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────┐          ┌───────────────┐
                        │  PostgreSQL  │          │  Android      │
                        │  + Queue     │          │  Devices      │
                        └──────────────┘          └───────────────┘
                               ▲                           │
                               │                           ▼
                        ┌──────────────┐          ┌───────────────┐
                        │  Webhook     │◀─────────│  Status       │
                        │  Receiver    │          │  Updates      │
                        └──────────────┘          └───────────────┘
```

## Tech Stack

### Backend (SMS Gateway Server)
- **Runtime**: Bun v1.3.11
- **Language**: TypeScript 5
- **Database**: PostgreSQL (via Docker)
- **ORM**: Drizzle ORM
- **Queue**: Custom queue implementation using PostgreSQL
- **HTTP Server**: Bun.serve()
- **Scheduler**: Bun's built-in cron

### Frontend (Management Dashboard)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Query + Zustand

## Project Structure

### Monorepo Structure
```
/Users/jibonhossen/Desktop/sms-server/
├── docker-compose.yml           # PostgreSQL + services
├── packages/
│   ├── server/                  # SMS Gateway Server (Bun)
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database.ts      # Drizzle ORM config
│   │   │   │   ├── env.ts           # Environment validation
│   │   │   │   └── smsGate.ts       # SMS-Gate API config
│   │   │   ├── db/
│   │   │   │   ├── schema.ts        # Drizzle schema definitions
│   │   │   │   ├── migrations/      # Drizzle migrations
│   │   │   │   └── index.ts         # Database connection
│   │   │   ├── models/
│   │   │   │   ├── Message.ts       # Message entity & types
│   │   │   │   ├── Device.ts        # Device entity & types
│   │   │   │   ├── SimCard.ts       # SIM card entity & types
│   │   │   │   └── WebhookLog.ts    # Webhook event logging
│   │   │   ├── services/
│   │   │   │   ├── MessageService.ts    # Message queue & processing
│   │   │   │   ├── DeviceService.ts     # Device management
│   │   │   │   ├── SimCardService.ts    # SIM balance & limits
│   │   │   │   ├── SmsGateClient.ts     # SMS-Gate API client
│   │   │   │   └── WebhookService.ts    # Webhook handling
│   │   │   ├── queue/
│   │   │   │   └── MessageQueue.ts      # Priority queue
│   │   │   ├── scheduler/
│   │   │   │   └── HealthCheckScheduler.ts  # Bun cron jobs
│   │   │   ├── routes/
│   │   │   │   ├── messages.ts      # Message API endpoints
│   │   │   │   ├── devices.ts       # Device API endpoints
│   │   │   │   ├── sims.ts          # SIM management endpoints
│   │   │   │   └── webhooks.ts      # Webhook receiver
│   │   │   └── index.ts             # Server entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/               # Next.js Management Dashboard
│       ├── src/
│       │   ├── app/                 # Next.js App Router
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx         # Dashboard home
│       │   │   ├── devices/
│       │   │   │   ├── page.tsx     # Device list
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx # Device detail + SIMs
│       │   │   ├── sims/
│       │   │   │   └── page.tsx     # SIM management
│       │   │   └── messages/
│       │   │       └── page.tsx     # Message history
│       │   ├── components/
│       │   │   ├── devices/
│       │   │   ├── sims/
│       │   │   └── ui/
│       │   ├── lib/
│       │   │   ├── api.ts           # API client
│       │   │   └── utils.ts
│       │   └── types/
│       ├── package.json
│       └── next.config.js
│
└── package.json                 # Root workspace config
```

## Database Schema

### messages table
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),           -- Your app's message ID
    phone_numbers TEXT[] NOT NULL,      -- Array of recipient numbers
    text_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, queued, sending, sent, delivered, failed
    priority INTEGER DEFAULT 5,         -- 1-10, lower = higher priority
    
    -- Device & SIM Assignment
    device_id VARCHAR(255),             -- Assigned device for sending
    sim_card_id UUID,                   -- Assigned SIM card
    sim_number INTEGER,                 -- SIM slot used (1 or 2)
    
    sms_gate_message_id VARCHAR(255),   -- SMS-Gate's message ID
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    
    -- If failed due to SIM limits
    failed_reason VARCHAR(100),         -- daily_limit_exceeded, no_balance, etc.
    
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### devices table
```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) UNIQUE NOT NULL,  -- SMS-Gate device ID
    name VARCHAR(255),
    username VARCHAR(255) NOT NULL,      -- SMS-Gate cloud credentials
    password VARCHAR(255) NOT NULL,      -- Encrypted
    status VARCHAR(50) DEFAULT 'offline', -- online, offline, error
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP,
    last_ping_at TIMESTAMP,
    total_sent INTEGER DEFAULT 0,        -- Total across all SIMs
    total_failed INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 5,          -- Device selection priority
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### sim_cards table
```sql
CREATE TABLE sim_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sim_number INTEGER NOT NULL,         -- SIM slot: 1 or 2
    phone_number VARCHAR(50),            -- Phone number of this SIM
    name VARCHAR(255),                   -- Display name (e.g., "SIM 1 - Personal")
    
    -- Balance Management (Manual Entry via Dashboard)
    total_sms_limit INTEGER DEFAULT 0,   -- Total SMS allowed for this SIM
    sms_used INTEGER DEFAULT 0,          -- SMS already sent
    sms_remaining INTEGER DEFAULT 0,     -- Calculated: total - used
    
    -- Daily Limits
    daily_sms_limit INTEGER DEFAULT 100, -- Max SMS per day
    daily_sms_sent INTEGER DEFAULT 0,    -- SMS sent today
    daily_reset_at DATE,                 -- Last daily reset date
    
    -- Status
    is_active BOOLEAN DEFAULT true,      -- Can be used for sending
    status VARCHAR(50) DEFAULT 'unknown', -- active, paused, no_balance, error
    
    -- Stats
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(device_id, sim_number)
);
```

### sim_usage_logs table
```sql
CREATE TABLE sim_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sim_card_id UUID NOT NULL REFERENCES sim_cards(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sms_sent INTEGER DEFAULT 0,
    sms_delivered INTEGER DEFAULT 0,
    sms_failed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(sim_card_id, date)
);
```

### webhook_logs table
```sql
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Core Components

### 1. MessageService - Queue Management

**Responsibilities:**
- Accept incoming SMS requests from your app servers
- Validate and save to database
- Add to priority queue
- Process queue and assign to available devices with available SIMs
- Check SIM balance and daily limits before sending
- Handle retry logic for failed messages

**Key Methods:**
- `enqueueMessage(request: MessageRequest): Promise<Message>`
- `processQueue(): Promise<void>`
- `assignToDeviceAndSim(messageId: string): Promise<{deviceId: string, simCardId: string} | null>`
- `updateStatus(messageId: string, status: MessageStatus, metadata?: object): Promise<void>`
- `canSimSend(simCardId: string): Promise<{allowed: boolean, reason?: string}>`

### 2. DeviceService - Multi-Device Management

**Responsibilities:**
- Register and manage multiple SMS-Gate devices
- Track device health via webhooks and polling
- Select best available device for sending

**Key Methods:**
- `registerDevice(device: DeviceConfig): Promise<Device>`
- `getAvailableDevice(): Promise<Device | null>`
- `updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<void>`
- `checkDeviceHealth(deviceId: string): Promise<HealthStatus>`

### 3. SmsGateClient - SMS-Gate API Integration

**Responsibilities:**
- Send SMS via SMS-Gate Cloud API
- Handle authentication
- Parse responses and errors

**API Endpoints Used:**
- `POST https://api.sms-gate.app/3rdparty/v1/messages` - Send SMS
- `GET https://api.sms-gate.app/3rdparty/v1/webhooks` - List webhooks
- `POST https://api.sms-gate.app/3rdparty/v1/webhooks` - Register webhook

### 4. WebhookService - Event Handling

**Responsibilities:**
- Receive webhooks from SMS-Gate devices
- Process delivery status updates
- Update message status in database
- Log all webhook events

**Handled Events:**
- `sms:sent` - Message sent from device
- `sms:delivered` - Message delivered to recipient
- `sms:failed` - Message failed to send
- `system:ping` - Device health check

### 5. SimCardService - SIM Balance & Limits Management

**Responsibilities:**
- Manage SIM card registration (2 SIMs per device)
- Track and update SMS balance (manual entry from dashboard)
- Enforce daily SMS limits per SIM
- Reset daily counters at midnight
- Select best available SIM for sending

**Key Methods:**
- `registerSimCards(deviceId: string, sims: SimConfig[]): Promise<SimCard[]>`
- `updateBalance(simCardId: string, totalLimit: number): Promise<void>`
- `updateDailyLimit(simCardId: string, dailyLimit: number): Promise<void>`
- `incrementUsage(simCardId: string, status: 'sent' | 'delivered' | 'failed'): Promise<void>`
- `getAvailableSim(deviceId?: string): Promise<SimCard | null>`
- `checkAndResetDailyLimits(): Promise<void>`
- `canSend(simCardId: string): Promise<{allowed: boolean, reason?: string}>`

### 6. HealthCheckScheduler - Background Jobs (Bun Cron)

**Responsibilities:**
- Poll device status every 5 minutes using Bun.cron()
- Mark devices offline if no ping received
- Reset daily SIM limits at midnight
- Retry failed messages
- Log health metrics

**Cron Jobs:**
- `*/5 * * * *` - Device health check polling
- `0 0 * * *` - Daily SIM limit reset
- `* * * * *` - Queue processor

## API Endpoints

### For Your App Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/messages` | Send SMS (queued) |
| GET | `/api/v1/messages/:id` | Get message status |
| GET | `/api/v1/messages` | List messages |

### For Device Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/devices` | Register new device |
| GET | `/api/v1/devices` | List all devices |
| GET | `/api/v1/devices/:id` | Get device status |
| PATCH | `/api/v1/devices/:id` | Update device |
| DELETE | `/api/v1/devices/:id` | Remove device |

### For SIM Management (Dashboard API)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/devices/:id/sims` | List SIMs for device |
| GET | `/api/v1/sims/:id` | Get SIM details |
| PATCH | `/api/v1/sims/:id/balance` | Update total SMS balance |
| PATCH | `/api/v1/sims/:id/daily-limit` | Update daily limit |
| PATCH | `/api/v1/sims/:id/status` | Enable/disable SIM |
| GET | `/api/v1/sims/:id/usage` | Get usage statistics |

### Webhook Receiver (from SMS-Gate)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/sms-gate` | Receive all SMS-Gate events |

## Message Flow

```
1. Your App Server → POST /api/v1/messages
   ↓
2. MessageService.validate() → Save to DB (status: pending)
   ↓
3. MessageQueue.add(message) → Priority queue
   ↓
4. QueueProcessor picks message
   ↓
5. SimCardService.getAvailableSim() → Select SIM with balance & daily quota
   ↓
6. SimCardService.canSend(simId) → Check balance & daily limit
   ↓
7. SmsGateClient.sendSMS(device, message, simNumber)
   ↓
8. Update DB: status → sending, store sms_gate_message_id, sim_card_id
   ↓
9. SimCardService.incrementUsage(simId, 'sent')
   ↓
10. SMS-Gate Cloud → Android Device → SMS sent via specified SIM
   ↓
11. Webhook: sms:sent → WebhookService → Update DB: status → sent
   ↓
12. Webhook: sms:delivered → Update DB: status → delivered
    ↓
    SimCardService.incrementUsage(simId, 'delivered')
   
[If failed]
   ↓
13. Webhook: sms:failed → Update DB: status → failed, error_message
    ↓
    SimCardService.incrementUsage(simId, 'failed')
    ↓
    If retryable → Requeue message
    If daily limit hit → Mark SIM paused, try other SIM
```

## Docker Configuration

### docker-compose.yml
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: sms-gateway-db
    environment:
      POSTGRES_USER: sms_gateway
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: sms_gateway
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sms_gateway"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build:
      context: ./packages/server
      dockerfile: Dockerfile
    container_name: sms-gateway-server
    environment:
      DATABASE_URL: postgresql://sms_gateway:your_secure_password@postgres:5432/sms_gateway
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  dashboard:
    build:
      context: ./packages/dashboard
      dockerfile: Dockerfile
    container_name: sms-gateway-dashboard
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
    ports:
      - "3001:3000"
    depends_on:
      - server
    restart: unless-stopped

volumes:
  postgres_data:
```

## Configuration (Environment Variables)

### Server (.env)
```env
# Server
PORT=3000
NODE_ENV=production

# Database (Docker PostgreSQL)
DATABASE_URL=postgresql://sms_gateway:your_secure_password@localhost:5432/sms_gateway

# SMS-Gate
SMS_GATE_CLOUD_URL=https://api.sms-gate.app/3rdparty/v1

# Security
API_KEY_SECRET=your-secret-key-for-app-servers
WEBHOOK_SECRET=webhook-verification-secret

# Queue
QUEUE_PROCESS_INTERVAL_MS=1000
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_MS=60000

# Health Check (Bun Cron)
HEALTH_CHECK_CRON=*/5 * * * *
DAILY_RESET_CRON=0 0 * * *
DEVICE_OFFLINE_THRESHOLD_MS=600000  # 10 minutes

# SIM Defaults
DEFAULT_DAILY_SMS_LIMIT=100
```

### Dashboard (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
API_KEY=your-secret-key-for-app-servers
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. Set up monorepo structure with Bun workspaces
2. Docker Compose configuration for PostgreSQL
3. Drizzle ORM setup with schema definitions
4. Environment configuration for both packages

### Phase 2: Server - Database Layer (Drizzle)
1. Drizzle schema: devices, sim_cards, messages, webhook_logs, sim_usage_logs
2. Database migrations setup
3. Repository pattern with Drizzle
4. Seed data for testing

### Phase 3: Server - SMS-Gate Integration
1. SmsGateClient with SIM support (simNumber parameter)
2. Device registration with auto SIM card creation
3. Message sending with SIM selection

### Phase 4: Server - SIM Management Service
1. SimCardService implementation
2. Balance tracking (manual entry support)
3. Daily limit enforcement
4. Daily reset cron job (Bun.cron)

### Phase 5: Server - Queue & Message Processing
1. MessageQueue with Drizzle
2. Queue processor with SIM selection logic
3. Retry logic with SIM fallback
4. Usage tracking on send/deliver/fail

### Phase 6: Server - Webhook & Health Monitoring
1. Webhook receiver with SIM event handling
2. Bun.cron for device health polling
3. Bun.cron for daily limit reset
4. Device status tracking

### Phase 7: Server - API Endpoints
1. Message endpoints (send, status, list)
2. Device management endpoints
3. SIM management endpoints (for dashboard)
4. Authentication middleware

### Phase 8: Dashboard - Setup & Layout
1. Next.js project setup with shadcn/ui
2. Layout with navigation sidebar
3. API client configuration
4. Authentication setup

### Phase 9: Dashboard - Device Management
1. Device list page
2. Device detail page
3. Add/edit device forms
4. Device status display

### Phase 10: Dashboard - SIM Management
1. SIM cards list per device
2. SIM detail/edit page
3. Balance update form (manual entry)
4. Daily limit configuration
5. SIM usage statistics charts

### Phase 11: Dashboard - Message Monitoring
1. Message history page
2. Message status filtering
3. Failed message retry UI
4. Real-time status updates

### Phase 12: Testing & Deployment
1. Unit tests for server services
2. API integration tests
3. Dashboard E2E tests
4. Docker deployment verification

## Dependencies

### Server (packages/server/package.json)
```json
{
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "postgres": "^3.4.0",
    "zod": "^3.22.0",
    "pino": "^8.0.0",
    "pino-pretty": "^10.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

### Dashboard (packages/dashboard/package.json)
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    "axios": "^1.6.0",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "tailwindcss-animate": "^1.0.0",
    "lucide-react": "^0.300.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.0",
    "postcss": "^8",
    "tailwindcss": "^3.4.0",
    "typescript": "^5"
  }
}
```

### Root (package.json)
```json
{
  "name": "sms-gateway",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "bun run --cwd packages/server dev & bun run --cwd packages/dashboard dev",
    "build": "bun run --cwd packages/server build && bun run --cwd packages/dashboard build",
    "db:generate": "bun run --cwd packages/server db:generate",
    "db:migrate": "bun run --cwd packages/server db:migrate",
    "db:studio": "bun run --cwd packages/server db:studio",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  }
}
```

## Key Design Decisions

1. **Database**: PostgreSQL via Docker for easy local development and deployment. Drizzle ORM for type-safe database operations.

2. **Queue Implementation**: Using PostgreSQL as queue storage with Drizzle ORM for durability. Messages processed by Bun.cron scheduler.

3. **SIM Management**: Each device has exactly 2 SIMs. Balance is manually entered via dashboard. Daily limits reset automatically at midnight via Bun.cron.

4. **SIM Selection Algorithm**: 
   - Check SIM1: if has balance and daily quota available → use SIM1
   - Check SIM2: if has balance and daily quota available → use SIM2
   - If both SIMs on device exhausted → try next device
   - Priority weighting for device selection

5. **Health Monitoring**: Hybrid approach - webhooks for real-time updates, Bun.cron polling every 5 minutes as fallback.

6. **Daily Limit Reset**: Bun.cron job at midnight resets `daily_sms_sent` to 0 for all SIMs.

7. **Balance Tracking**: Manual entry via Next.js dashboard. System tracks `sms_used` and calculates `sms_remaining = total_sms_limit - sms_used`.

8. **Dashboard**: Separate Next.js app for device/SIM management. Communicates with server via REST API.

9. **Retry Strategy**: 
   - If SIM daily limit exceeded → mark SIM paused, retry with other SIM
   - If SIM has no balance → mark SIM paused, retry with other SIM
   - If device offline → retry with other device
   - Max 3 retries with exponential backoff

## Security Considerations

1. API key authentication for your app servers
2. Webhook signature verification from SMS-Gate
3. Encrypted device credentials in database
4. Rate limiting on message endpoints
5. Input validation on all endpoints
