# Event-Driven Notification Engine

A production-grade, multi-channel notification microservice built with **NestJS + TypeScript**. Consumes domain events from RabbitMQ and dispatches notifications across **Email, SMS, Push, and In-App** channels with isolated per-channel job queues, classified retry policies, template rendering with Redis caching, and a dead-letter store for terminal failures.


---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js + TypeScript (strict mode) |
| Framework | NestJS |
| Message broker | RabbitMQ (topic exchange) |
| Job queues | BullMQ + Redis |
| Database | MongoDB + Mongoose |
| Cache | Redis (`ioredis`) |
| Email | Resend |
| SMS | Twilio |
| Push | Firebase Admin SDK |
| In-App realtime | Socket.io |
| Templating | Handlebars |
| Containerization | Docker + docker-compose |

---

## Architecture

```
External Services (Order, Payment, Auth, Cron)
        │
        ▼
   RabbitMQ (Topic Exchange)
        │
        ▼
   Notification Engine (NestJS)
   ┌─────────────────────────────────────────────────┐
   │ Event Ingestion → Preference Check → Template   │
   │   Render → Channel Router → BullMQ Queues       │
   │   (per channel) → Workers → Deliver             │
   │                                                  │
   │ Retry (classified backoff) → Dead Letter store  │
   └──────┬──────────┬──────────┬─────────────────────┘
          │          │          │
      MongoDB     Redis     External APIs
                 (queues)   (Resend / Twilio / FCM)
```

### Key design decisions
- **Per-channel BullMQ queues** for fault isolation — if Resend is down, SMS and push keep flowing.
- **`IChannel` interface** — every channel implements `send(payload): Promise<DeliveryResult>`.
- **Provider error classification** — HTTP / network / provider codes mapped to `transient` vs `permanent`. Permanent errors raise BullMQ `UnrecoverableError` to skip remaining retries and go straight to the dead-letter store.
- **Per-channel retry policy** — email 3× exponential, SMS 5× fixed 60 s, push 3× exponential, in-app 1 (no retry).
- **Two-layer template cache** — Redis caches the rendered template document strings (cross-process); an in-memory `Map` caches compiled Handlebars functions per-process (closures can't serialize to Redis).
- **Persist-then-emit for in-app** — every in-app notification is written to MongoDB first, then best-effort emitted via Socket.io. Offline users still receive their messages once the Notification Center API is added.
- **WebSocket on a separate port (3001)** instead of attaching to the main HTTP server — sets up a clean future split into a standalone realtime service.

---



---

## Data Model

| Collection | Purpose |
|---|---|
| `notifications` | Per-event record + overall status FSM (pending → sent / partial / failed) |
| `delivery_logs` | One row per channel send attempt (queued / delivered / failed / dlq) |
| `templates` | Tenant-scoped, versioned, per-channel Handlebars templates |
| `user_preferences` | Channel opt-in/out, quiet hours, digest mode, muted events |
| `dead_letters` | Terminal failures awaiting admin replay/discard |
| `inapp_notifications` | Persistent in-app inbox for offline delivery |

---

## Event Routing Table

| Event | Channels | Priority |
|---|---|---|
| `user.signup` | Email + In-App | Normal |
| `order.placed` | Email + SMS + In-App | Normal |
| `order.shipped` | SMS + Push | Normal |
| `payment.failed` | Email + SMS | High (bypasses quiet hours) |
| `friend.request` | In-App | Low |
| `weekly.digest` | Email (batched) | Low (cron) |

---

## Project Structure

```
notification-engine/
├── docker-compose.yml                # MongoDB, Redis, RabbitMQ
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── config/                       # database, redis, rabbitmq, channels
│   ├── common/
│   │   ├── enums/                    # ChannelType, DeliveryStatus, DeadLetterStatus, FailType
│   │   ├── interfaces/               # IChannel, DeliveryResult, NotificationJobData
│   │   └── errors/classify-error.ts  # Transient vs permanent classifier
│   ├── modules/
│   │   ├── event-ingestion/          # RabbitMQ consumer + router
│   │   ├── template/                 # Service, renderer, controller, schemas
│   │   ├── channels/                 # email | sms | push | inapp workers + services
│   │   └── delivery/                 # dead-letter schema (DLQ in progress)
│   └── seeds/                        # Default templates
└── test/                             # Reserved for Phase 10
```

---

## Running Locally

### Prerequisites
- Node.js ≥ 18
- Docker + docker-compose

### Quick start
```bash
# 1. Start infrastructure
docker-compose up -d mongodb redis rabbitmq

# 2. Install + seed templates
npm install
npm run seed

# 3. Run the API
npm run start:dev
```

The HTTP API listens on **`http://localhost:3000/api/v1`**. The WebSocket gateway listens separately on **`localhost:3001`**.

### Environment variables (see `.env.example`)
```
MONGODB_URI=
REDIS_HOST= REDIS_PORT=
RABBITMQ_URL=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= TWILIO_FROM=
FIREBASE_PROJECT_ID= FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY=
PUSH_DRY_RUN=true
```

---

## Roadmap

| Phase | Step | Status |
|---|---|---|
| 1 | NestJS + TypeScript foundation | ✅ |
| 2 | MongoDB + Mongoose schemas | ✅ |
| 3 | RabbitMQ ingestion | ✅ |
| 4 | Event validation & routing | ✅ |
| 5 | BullMQ per-channel queues | ✅ |
| 6 | Channel workers (Email / SMS / Push / In-App) | ✅ |
| 7 | Template engine + Redis caching | ✅ |
| 8 | Retry + classified errors + DLQ + circuit breaker | 🔄 |
| 9 | User preferences (opt-in/out, quiet hours) | ⏳ |
| 10 | Preference-based routing pipeline | ⏳ |
| 11 | Delivery tracking + status FSM | ⏳ |
| 12 | Analytics + SSE dashboard | ⏳ |
| 13 | Digest batching + distributed cron | ⏳ |
| 14 | Docker, Swagger, structured logging | ⏳ |
| 15 | Comprehensive test suite (Jest + e2e) | ⏳ |
| 16 | CI/CD with GitHub Actions | ⏳ |
| 17 | Auth, HMAC verification, rate limiting | ⏳ |
| 18 | Field-level encryption + GDPR | ⏳ |
| 19 | Multi-tenancy with row-level isolation | ⏳ |
| 20 | k6 load testing | ⏳ |
| 21 | Schema registry + contract testing | ⏳ |
| 22 | Kubernetes + Helm + Terraform | ⏳ |
| 23 | ADRs + system design doc | ⏳ |

---

## License

MIT
