# Event-Driven Notification Engine

## What This Is
A production-grade, multi-tenant, event-driven notification microservice built with NestJS + TypeScript. Consumes domain events via RabbitMQ and delivers multi-channel notifications (email, SMS, push, in-app) with template rendering, user preference management, retry logic, dead letter queues, digest batching, delivery tracking, and full observability. The 10/10 version adds security hardening, multi-tenancy, load testing, schema registry, CI/CD, Kubernetes/Terraform, and ADRs.

This is a portfolio project targeting remote backend/SWE roles. Build base version first (~5,000 LOC), then add 10/10 features (total ~18,000–22,000 LOC).

---

## Tech Stack
- **Runtime:** Node.js + TypeScript (strict mode)
- **Framework:** NestJS
- **Message Broker:** RabbitMQ (topic exchange)
- **Job Queues:** BullMQ + Redis
- **Database:** MongoDB + Mongoose
- **Cache:** Redis (ioredis)
- **Channels:** Nodemailer (email), Twilio (SMS), Firebase Admin SDK (push), Socket.io (in-app)
- **Testing:** Jest (unit + integration + e2e), k6 (load testing)
- **CI/CD:** GitHub Actions
- **Containerization:** Docker + docker-compose
- **Production Deploy:** Kubernetes + Helm + Terraform
- **Observability:** Prometheus + Grafana + structured logging (Pino)
- **Docs:** Swagger/OpenAPI, ADRs

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
   │ Retry (exponential backoff) ←→ Dead Letter Queue │
   │ Delivery Tracker ←→ Analytics Dashboard          │
   │ Schema Registry → Event Validation               │
   │ Tenant Middleware → Row-Level Isolation           │
   └──────┬──────────┬──────────┬─────────────────────┘
          │          │          │
      MongoDB     Redis     External APIs
                  (queues)   (Twilio/SMTP/FCM)
```

**Key design decisions:**
- Separate BullMQ queue per channel (fault isolation)
- IChannel interface — every channel implements `send(payload): Promise<DeliveryResult>`
- Idempotency guard before sending (check DeliveryLog)
- Exponential backoff: email (3 attempts), SMS (5 attempts), push (3), in-app (1)
- Priority: CRITICAL=1, HIGH=2, NORMAL=3, LOW=4
- Shared-database multi-tenancy with row-level isolation (tenantId on every document)
- HMAC signature verification for event publishers (zero-trust)

---

## Folder Structure

```
notification-engine/
├── docker-compose.yml                # MongoDB, Redis, RabbitMQ
├── Dockerfile                        # Multi-stage production build
├── .env / .env.example
├── package.json
├── tsconfig.json
├── README.md
├── CLAUDE.md
│
├── src/
│   ├── app.module.ts                 # Root module
│   ├── main.ts                       # Bootstrap NestJS app
│   │
│   ├── config/
│   │   ├── database.config.ts        # MongoDB connection
│   │   ├── redis.config.ts           # Redis + BullMQ config
│   │   ├── rabbitmq.config.ts        # Exchanges & queues
│   │   └── channels.config.ts        # Twilio, SMTP, Firebase keys
│   │
│   ├── common/
│   │   ├── dto/
│   │   │   ├── notification-event.dto.ts
│   │   │   └── paginated-response.dto.ts
│   │   ├── interfaces/
│   │   │   ├── channel.interface.ts       # IChannel — send(), getStatus()
│   │   │   └── delivery-result.interface.ts
│   │   ├── enums/
│   │   │   ├── channel-type.enum.ts       # EMAIL, SMS, PUSH, INAPP
│   │   │   ├── delivery-status.enum.ts    # QUEUED, DELIVERED, FAILED, DLQ
│   │   │   └── event-priority.enum.ts
│   │   ├── guards/
│   │   │   ├── admin.guard.ts
│   │   │   ├── api-key.guard.ts
│   │   │   └── tenant.guard.ts
│   │   └── middleware/
│   │       ├── tenant.middleware.ts
│   │       └── signature-verification.middleware.ts
│   │
│   ├── event-ingestion/
│   │   ├── event-ingestion.module.ts
│   │   ├── event-ingestion.controller.ts  # POST /api/events
│   │   ├── event-ingestion.consumer.ts    # RabbitMQ listener
│   │   ├── event-ingestion.validator.ts
│   │   └── event-ingestion.router.ts      # Routes to channel queues
│   │
│   ├── template/
│   │   ├── template.module.ts
│   │   ├── template.service.ts            # CRUD + render(template, vars)
│   │   ├── template.controller.ts         # Admin CRUD API
│   │   └── schemas/template.schema.ts
│   │
│   ├── preferences/
│   │   ├── preferences.module.ts
│   │   ├── preferences.service.ts
│   │   ├── preferences.controller.ts
│   │   └── schemas/user-preference.schema.ts
│   │
│   ├── channels/
│   │   ├── channels.module.ts
│   │   ├── email/
│   │   │   ├── email.service.ts           # Nodemailer wrapper
│   │   │   └── email.worker.ts            # BullMQ processor
│   │   ├── sms/
│   │   │   ├── sms.service.ts             # Twilio wrapper
│   │   │   └── sms.worker.ts
│   │   ├── push/
│   │   │   ├── push.service.ts            # Firebase Admin SDK wrapper
│   │   │   └── push.worker.ts
│   │   └── inapp/
│   │       ├── inapp.service.ts
│   │       └── inapp.gateway.ts           # WebSocket gateway (Socket.io)
│   │
│   ├── delivery/
│   │   ├── delivery.module.ts
│   │   ├── delivery.service.ts            # Log & track every attempt
│   │   ├── dlq.service.ts                 # Dead letter queue handler
│   │   └── schemas/
│   │       ├── notification.schema.ts
│   │       └── delivery-log.schema.ts
│   │
│   ├── digest/
│   │   ├── digest.module.ts
│   │   ├── digest.service.ts              # Batch notifications
│   │   ├── digest.cron.ts                 # Hourly/daily cron with distributed lock
│   │   └── schemas/digest-batch.schema.ts
│   │
│   ├── dashboard/
│   │   ├── dashboard.module.ts
│   │   ├── dashboard.controller.ts        # GET /stats, /logs
│   │   └── dashboard.gateway.ts           # SSE real-time stats
│   │
│   ├── schema-registry/
│   │   ├── schema-registry.module.ts
│   │   ├── schema-registry.service.ts     # Register, validate, version schemas
│   │   ├── schema-registry.controller.ts
│   │   └── schemas/event-schema.schema.ts
│   │
│   ├── tenant/
│   │   ├── tenant.module.ts
│   │   ├── tenant.service.ts
│   │   ├── tenant.controller.ts
│   │   └── schemas/tenant.schema.ts
│   │
│   └── security/
│       ├── encryption.service.ts          # AES-256-GCM field-level encryption
│       ├── audit-log.service.ts
│       └── schemas/audit-log.schema.ts
│
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── load-tests/                            # k6 scripts
│   ├── smoke.js
│   ├── load.js
│   ├── stress.js
│   └── spike.js
│
├── k8s/                                   # Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   └── ingress.yaml
│
├── helm/                                  # Helm chart
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│
├── terraform/                             # IaC
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
├── docs/
│   ├── SYSTEM_DESIGN.md
│   ├── CONTRIBUTING.md
│   └── adr/
│       ├── ADR-001-why-rabbitmq-plus-bullmq.md
│       ├── ADR-002-why-mongodb.md
│       ├── ADR-003-why-per-channel-queues.md
│       ├── ADR-004-why-opossum-circuit-breaker.md
│       ├── ADR-005-why-shared-db-multi-tenancy.md
│       └── ADR-006-why-pino-logging.md
│
└── .github/
    └── workflows/
        └── ci.yml
```

---

## MongoDB Schemas

**Notification:** `{ eventType, userId, tenantId, data, channels[], status (pending|sent|partial|failed), priority, createdAt }`

**DeliveryLog:** `{ notificationId, channel, status (queued|delivered|failed|dlq), attempts, lastError, deliveredAt }`

**Template:** `{ eventType, channel, tenantId, subject, body (with {{variables}}), isActive, version }`

**UserPreference:** `{ userId, tenantId, channels: { email, sms, push }, quietHours: { start, end }, digestMode (instant|hourly|daily), mutedEvents[] }`

**Tenant:** `{ name, apiKeyHash, config: { providers, rateLimits, quotas }, status, createdAt }`

**EventSchema:** `{ eventType, version, jsonSchema, status (active|deprecated), createdAt }`

**AuditLog:** `{ tenantId, actor, action, resource, details, timestamp }`

---

## Event Routing Table

| Event            | Channels              | Priority |
|------------------|-----------------------|----------|
| user.signup      | Email + In-App        | Normal   |
| order.placed     | Email + SMS + In-App  | Normal   |
| order.shipped    | SMS + Push            | Normal   |
| payment.failed   | Email + SMS           | High (bypasses quiet hours) |
| friend.request   | In-App only           | Low      |
| weekly.digest    | Email (batched)       | Low (cron) |

---

## Build Plan — 16 Phases, 25 Steps

### PHASE 1: Foundation & Project Setup

**Step 1 — NestJS & TypeScript Foundation**
- Topics: TypeScript strict mode, generics, decorators, utility types. NestJS modules/controllers/providers/DI. @nestjs/config with Joi validation. CLI scaffolding. Feature-based module organization.
- Tasks: `nest new notification-engine`, enable strict TS, set up ConfigModule with .env + Joi schema, create CoreModule + SharedModule, global exception filters + logging interceptor, path aliases (@shared/*, @modules/*), health-check endpoint (GET /health), global ValidationPipe with class-validator, global prefix /api/v1 + CORS.

**Step 2 — MongoDB & Mongoose Integration**
- Topics: MongoDB documents/collections/BSON. @nestjs/mongoose, Schema decorators, SchemaFactory. Indexes (compound, unique, TTL, text). Virtuals, pre/post hooks, timestamps. Data modeling for notifications. Mongoose plugins (pagination, soft-delete).
- Tasks: Install @nestjs/mongoose, configure MongooseModule.forRoot via ConfigService. Create all schemas: Notification, DeliveryLog, Template, UserPreference. Add compound indexes. Create seed script for default templates. Set up timestamps and status/priority enums.

### PHASE 2: Event Ingestion

**Step 3 — RabbitMQ Integration**
- Topics: AMQP concepts (exchanges, queues, bindings, routing keys). Topic exchange pattern. @golevelup/nestjs-rabbitmq. Connection management, reconnection, heartbeats. Dead letter exchanges. Message acknowledgment (ack/nack/reject).
- Tasks: Install and configure RabbitMQ module. Create topic exchange 'notification.events'. Define routing key patterns (order.*, payment.*, user.*). Create EventConsumerService with @RabbitSubscribe. Implement message acknowledgment. Add connection health check. Set up DLX for unprocessable messages.

**Step 4 — Event Validation & Routing**
- Topics: DTO validation with class-validator. Event-to-channel mapping table. Event priority classification. Idempotency keys.
- Tasks: Create NotificationEventDTO with validation decorators. Build EventRouter that maps events to channels + priority. Implement idempotency check (hash eventType + userId + timestamp). Create REST endpoint POST /api/v1/events/publish for manual triggering. Add event logging with correlationId.

### PHASE 3: Multi-Channel Delivery

**Step 5 — BullMQ Queue Architecture**
- Topics: BullMQ queues, workers, job lifecycle (waiting→active→completed/failed). Redis as queue backend. Per-channel queue isolation. Worker concurrency, lock duration, stalled job recovery. @nestjs/bullmq integration.
- Tasks: Install @nestjs/bullmq + bullmq + ioredis. Create isolated queues: 'notifications:email', 'notifications:sms', 'notifications:push', 'notifications:in-app'. Build ChannelRouter dispatching to queues. Define job data interface: { notificationId, userId, tenantId, channel, event, templateId, variables, priority, metadata }. Per-queue retry defaults. Job priority (CRITICAL=1 to LOW=4). Bull-board for monitoring. Stalled job recovery. Queue event listeners with correlationId.

**Step 6 — Channel Workers (Email, SMS, Push, In-App)**
- Topics Week 1: Nodemailer (transports, HTML, attachments). Twilio (SMS API, phone formatting, error codes).
- Topics Week 2: Firebase Admin SDK (device tokens, topics, invalid token handling). NestJS @WebSocketGateway + Socket.io (rooms, namespaces).
- Tasks: EmailWorker @Processor + EmailService (Nodemailer). SmsWorker + SmsService (Twilio). PushWorker + PushService (Firebase, handle invalid tokens). InAppGateway (WebSocket, user rooms) + InAppService (store + emit). IChannel interface: all channels implement `send(payload): Promise<DeliveryResult>`. E2E test: publish event → RabbitMQ → consumer → route → queue → worker → deliver.

### PHASE 4: Template Engine

**Step 7 — Template Engine with Redis Caching**
- Topics: Template interpolation ({{variable}}). Redis data types, TTL, key naming. Cache-aside pattern. Cache stampede prevention (SETNX lock). Template versioning.
- Tasks: Configure ioredis. TemplateService CRUD. TemplateEngine: interpolate {{variable}} via regex or Handlebars. Nested variables: {{user.firstName}}, {{order.total | currency}}. Template validation (required variables). Redis cache: key 'template:{name}:{channel}:{version}' with 1hr TTL. Cache invalidation on update. Stampede prevention with SETNX. Template API: POST/GET/PUT/DELETE /api/v1/templates. Preview endpoint: POST /api/v1/templates/preview. Seed default templates.

### PHASE 5: Retry & Dead Letter Queue

**Step 8 — Retry Logic, Error Classification & DLQ**
- Topics: Exponential backoff formula. Error classification: transient (timeout, 503) vs permanent (invalid email, 400). Circuit breaker (opossum). Dead letter queue patterns. Idempotency guard.
- Tasks: BullMQ retry per queue: email (3 attempts, exponential 2^n), SMS (5 attempts, fixed 60s), push (3). Classify errors: retryable vs permanent (permanent → DLQ immediately). DLQ service: move to 'dlq:{channel}' after max retries. DLQ admin: GET /api/v1/dlq, POST /:id/replay, DELETE /:id/discard. Idempotency check before sending. Opossum circuit breaker for external APIs. Admin alerts on DLQ entry.

### PHASE 6: User Preferences & Routing

**Step 9 — User Preference Management**
- Topics: Channel opt-in/out. Quiet hours + timezone. Event muting (wildcard: 'marketing.*'). Priority override (HIGH bypasses quiet hours). Default preferences for new users.
- Tasks: UserPreference schema + service + controller. Preference API: GET/PUT /api/v1/preferences/:userId. Default preferences on first access. Channel opt-in/out. Quiet hours with timezone.

**Step 10 — Preference-Based Routing Logic**
- Topics: Routing pipeline: validate → preferences → quiet hours → priority override → muted events → determine channels → dispatch.
- Tasks: PreferenceRouter service with full pipeline. Priority override for HIGH/CRITICAL. Wildcard muted event matching. Logging every routing decision for audit.

### PHASE 7: Delivery Tracking & Analytics

**Step 11 — Delivery Tracking**
- Topics: Notification status FSM: pending → processing → sent/partial/failed. Per-channel delivery status. MongoDB aggregation for analytics.
- Tasks: Update DeliveryLog on every attempt. Update Notification status based on all channels. Aggregation pipeline: delivery rate, failure rate, avg delivery time per channel.

**Step 12 — Analytics Dashboard API**
- Topics: SSE for real-time stats. Aggregation queries.
- Tasks: Dashboard API: GET /api/v1/dashboard/stats. Per-user history: GET /api/v1/notifications/:userId. SSE endpoint for real-time monitoring.

### PHASE 8: Digest & Batching

**Step 13 — Digest Batching with Distributed Cron**
- Topics: Digest modes (instant, hourly, daily). Grouping by user + time window. Distributed cron lock with Redis SETNX. @nestjs/schedule.
- Tasks: DigestService: buffer notifications for digest-mode users. Cron job: collect buffered notifications, group by user, render digest email. Distributed lock: Redis SETNX (only one instance runs cron). DigestBatch schema. Edge cases: preference change mid-digest, empty digest (skip).

### PHASE 9: Containerization & Deployment

**Step 14 — Docker, Swagger & Structured Logging**
- Tasks: Unit tests for every service (mock external deps). E2E tests: POST /events → verify full pipeline. Swagger: decorate all controllers + DTOs, expose at /api/docs. Multi-stage Dockerfile: build → production. Structured logging (Pino): event received, channel dispatched, delivery result, DLQ entry — all with correlationId. Comprehensive README. Final integration test: docker-compose up → publish → verify all channels + delivery logged.

---

### ⭐ PHASE 10: Testing & CI/CD Pipeline

**Step 15 — Comprehensive Test Suite**
- Topics: Jest patterns for NestJS. mongodb-memory-server. Mocking external services. Coverage thresholds. WebSocket testing.
- Tasks: Unit tests for every service. Integration tests with mongodb-memory-server. E2E tests with Supertest. WebSocket tests. Coverage thresholds: 80% statements, 75% branches. Coverage badge in README.

**Step 16 — CI/CD Pipeline with GitHub Actions**
- Topics: GitHub Actions workflows/jobs/steps/triggers. Docker in CI. Branch protection. Conventional commits + semver.
- Tasks: .github/workflows/ci.yml (push + PRs). Job 1: Lint + Type Check. Job 2: Unit Tests + coverage. Job 3: Integration Tests (docker-compose services). Job 4: Build + Docker image. Coverage artifact. Branch protection. commitlint + husky. Release workflow: tag → build → push to GHCR. CI badge in README.

### ⭐ PHASE 11: Security Hardening

**Step 17 — Authentication & Event Verification**
- Topics: HMAC signatures (SHA-256). JWT + Passport. API key auth (crypto.randomBytes, bcrypt hash, rotation). @nestjs/throttler. Input sanitization.
- Tasks: HMAC webhook signature verification (X-Signature header). Signature verification middleware. API key auth for all endpoints. Per-tenant API keys. Rate limit: 100 req/min (publish), 30 req/min (management). Max payload 1MB. Helmet middleware. Sanitized logging. Security tests (no signature → 401, tampered → 403).

**Step 18 — Data Protection & Encryption**
- Topics: Field-level encryption (AES-256-GCM). PII handling. Secret management. GDPR (erasure, portability). Immutable audit logging.
- Tasks: EncryptionService: encrypt/decrypt PII. Encrypt before storage, decrypt for delivery only. Data retention: auto-delete > 90 days (configurable/tenant). GDPR export: GET /users/:id/data-export. GDPR delete: DELETE /users/:id/data (anonymize). Encryption keys in env/KMS. Immutable audit log. Secret rotation support. Document security model.

### ⭐ PHASE 12: Multi-Tenancy

**Step 19 — Multi-Tenant Architecture**
- Topics: Shared-database with row-level isolation. AsyncLocalStorage for tenant context. Tenant-aware middleware. Per-tenant resource limits. Onboarding flow.
- Tasks: tenantId on every document. TenantMiddleware: extract tenantId from API key/JWT → AsyncLocalStorage. TenantGuard: verify tenantId. Mongoose query middleware to auto-scope by tenantId. Tenant-scoped templates + preferences. Per-tenant rate limits. Per-tenant provider config (Tenant A → SendGrid, Tenant B → SES). Tenant API: POST/GET/PATCH /tenants. Onboarding: create → generate keys → seed templates → return credentials. Cross-tenant isolation test.

### ⭐ PHASE 13: Load Testing & Benchmarks

**Step 20 — Load Testing with k6**
- Topics: Throughput (RPS), latency (p50/p95/p99). k6 (VUs, stages, thresholds). Scenarios: smoke, load, stress, spike, soak. Bottleneck analysis. Tuning (pooling, indexes, caching, concurrency).
- Tasks: /load-tests directory. Smoke: 1 VU/10 req. Load: 10→100 VUs over 5 min, sustain 10 min. Stress: 500 VUs (find breaking point). Spike: 10→300 VUs instant. Test publishing + feed reads concurrently. Thresholds: p95 < 500ms, errors < 1%, throughput > 200 RPS. Prometheus metrics during load. README "Performance" section with numbers. Comparison table at 50/100/200/500 VUs. Document bottlenecks + optimizations.

### ⭐ PHASE 14: Schema Registry & Contract Testing

**Step 21 — Schema Registry & Event Contract Validation**
- Topics: Centralized schema storage. JSON Schema Draft-07. Evolution rules (additive-only). Versioning. Contract testing (Pact concepts).
- Tasks: EventSchema collection: { eventType, version, jsonSchema, status, createdAt }. SchemaRegistryService: registerSchema(), getSchema(), validateEvent(), listSchemas(). JSON Schema per event type. Validate in EventConsumerService (reject non-matching). Backward-compatibility check on new versions. Schema API: POST/GET/PUT /schemas. Auto-reject deprecated schemas (422 + migration guide). Contract tests per event type. Metrics: events_validated_total{result=pass|fail|deprecated}.

### ⭐ PHASE 15: Cloud Deployment & IaC

**Step 22 — Kubernetes Manifests & Terraform**
- Topics: K8s (Pods, Deployments, Services, ConfigMaps, Secrets, probes, HPA). Helm charts. Terraform (providers, resources, state, modules). Cloud services (EKS, Atlas, ElastiCache).
- Tasks: /k8s directory. Deployment: replicas=3, limits (256-512Mi, 250-500m CPU), rolling update. Readiness: GET /health. Liveness: GET /health/live. ConfigMap + Secret. Service + Ingress. HPA: 3→10 pods on CPU > 70%. Helm chart with values.yaml. /terraform: VPC, K8s cluster, managed DB, Redis. README: Docker Compose (dev) + Kubernetes (prod) paths. Deployment architecture diagram.

### ⭐ PHASE 16: Documentation & ADRs

**Step 23 — README, ADRs & System Design Document**
- Topics: README best practices. ADR format (Context → Decision → Consequences). System design doc. Swagger + @nestjs/swagger. C4 model diagrams.
- Tasks: README: badges, Mermaid diagram, features, quick start, API link, tech stack, performance section. /docs/adr/ with 6+ ADRs:
  - ADR-001: Why RabbitMQ + BullMQ instead of Kafka
  - ADR-002: Why MongoDB over PostgreSQL
  - ADR-003: Why per-channel queues over single queue
  - ADR-004: Why opossum circuit breaker
  - ADR-005: Why shared-database multi-tenancy
  - ADR-006: Why Pino over Winston
- SYSTEM_DESIGN.md: problem, requirements, capacity estimation (1M notifs/day ≈ 12 RPS avg, 100 RPS peak), components, data model, failure modes, scalability. Swagger at /api/docs. Postman/Bruno collection. CONTRIBUTING.md. Architecture diagrams (C1, C2, C3).

---

## V2 Feature Additions (post-base, each 2–4 days)

1. **Notification Center API (~400 LOC)** — GET /notifications/me, unread count, mark read/dismiss
2. **Priority Queues (~300 LOC)** — BullMQ priority field, HIGH bypasses quiet hours
3. **Webhook Delivery (~600 LOC)** — Register URLs, HMAC signing, retry (5min→30min→2hr→24hr), auto-disable after 5 failures
4. **Rate Limiting Per Channel (~300 LOC)** — BullMQ limiter: email 50/s, SMS 10/s, push 500/s
5. **Prometheus Metrics + Health (~300 LOC)** — Custom counters/histograms, Grafana dashboard
6. **A/B Template Testing (~400 LOC)** — Variant A/B, track open/click rates

---

## LOC Estimates

| Module | Lines |
|--------|-------|
| Core Service Layer (ingestion, queues, retry, DLQ, idempotency) | ~4,000–6,000 |
| Notification Routing & Delivery (channels, preferences, templates) | ~3,000–4,500 |
| Rule/Decision Engine (preferences, rate limiting, quiet hours, dedup) | ~1,500–2,500 |
| Data Layer (schemas, repositories, tracking, audit) | ~2,000–3,000 |
| Infrastructure & Config (modules, env, health, Docker, K8s, Terraform) | ~1,500–2,500 |
| Observability (Prometheus, logging, Grafana) | ~1,000–1,500 |
| Security & Auth (API keys, HMAC, encryption, RBAC) | ~800–1,200 |
| Testing (unit + integration + e2e + k6) | ~3,000–5,000 |
| Docs, CI/CD, ADRs | ~500–1,000 |
| **Base version (Phases 1–9)** | **~5,000–8,000** |
| **Full 10/10 (all 25 steps)** | **~18,000–22,000** |

---

## Current Progress

Phase: ___  Step: ___
<!-- Update this as you progress -->

---

## Key Interfaces

```typescript
// channel.interface.ts
export interface IChannel {
  send(payload: ChannelPayload): Promise<DeliveryResult>;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;    // external ID from Twilio/Nodemailer/FCM
  error?: string;
  timestamp: Date;
}

// Job data pushed to BullMQ queues
export interface NotificationJobData {
  notificationId: string;
  userId: string;
  tenantId: string;
  channel: ChannelType;
  event: string;
  templateId: string;
  variables: Record<string, any>;
  priority: number;
  metadata: Record<string, any>;
}
```

---

## Coding Conventions

- **Strict TypeScript:** `strict: true`, `strictNullChecks: true`
- **Path aliases:** `@shared/*`, `@modules/*`, `@common/*`
- **Global prefix:** `/api/v1`
- **Validation:** class-validator + class-transformer via global ValidationPipe
- **Error handling:** Global exception filters, structured error responses with correlationId
- **Logging:** Pino, structured JSON, correlationId on every event. Never log API keys, tokens, or PII.
- **Naming:** Feature-based modules. Files: `*.service.ts`, `*.controller.ts`, `*.worker.ts`, `*.schema.ts`, `*.guard.ts`, `*.middleware.ts`
- **Env vars:** Validated with Joi schema via @nestjs/config
- **Testing:** `*.spec.ts` co-located for unit, `/test` for e2e. Coverage: 80% statements, 75% branches.
- **Commits:** Conventional commits (commitlint + husky)

---

## Docker Services (docker-compose)

- **mongodb:** port 27017
- **redis:** port 6379
- **rabbitmq:** ports 5672 (AMQP) + 15672 (management UI)
- **app:** NestJS service

---

## Common Commands

```bash
# Infrastructure
docker-compose up -d mongodb redis rabbitmq

# Dev
npm run start:dev

# Tests
npm run test              # unit
npm run test:e2e          # e2e
npm run test:cov          # coverage

# Load tests
k6 run load-tests/smoke.js
k6 run load-tests/load.js

# Generate
nest g module modules/<name>
nest g service modules/<name>
nest g controller modules/<name>

# Swagger
open http://localhost:3000/api/docs

# Bull Board
open http://localhost:3000/admin/queues
```

---

## Interview Talking Points

- **"How do you handle failures?"** → Exponential backoff retry per channel + DLQ + circuit breaker (opossum)
- **"How do you scale?"** → Isolated queues per channel, horizontal workers, HPA on K8s
- **"How do you handle duplicates?"** → Idempotency check in DeliveryLog before sending
- **"Why separate queues?"** → Fault isolation: if email provider down, SMS/push continue
- **"Why RabbitMQ + BullMQ?"** → RabbitMQ for inter-service events, BullMQ for job processing with retry/priority/rate-limiting
- **"Multi-tenancy approach?"** → Shared DB, row-level isolation, tenant context via AsyncLocalStorage, per-tenant API keys
- **"Why not Kafka?"** → ADR-001 explains the tradeoffs
- **"How do you handle distributed cron?"** → Redis SETNX ensures only one instance runs digest cron
