# Notification Engine — Project State

**Snapshot date:** 2026-06-21
**Build plan position:** Phase 3, Step 6 complete (channel services just finished). Step 7 (templates) done out of order. Steps 8 and 11 partially done.
**Compiles:** ✅ `npx tsc --noEmit` passes clean.

This document describes **everything actually built so far** — derived from the source, not the plan. For the full 25-step roadmap see `CLAUDE.md`.

---

## 1. What this application does today

An event-driven, multi-channel notification service built on NestJS. It ingests a domain
event (e.g. `order.placed`), looks up which channels that event maps to, and dispatches a
job per channel onto isolated BullMQ queues. Per-channel workers render a template and
deliver via the channel's service. Failed jobs are retried with per-channel backoff and
errors are classified transient vs. permanent.

**End-to-end flow that works right now:**

```
HTTP POST /api/v1/events  (or RabbitMQ consumer)
        │
        ▼
EventIngestionService.ingestEvent()
        │  ├─ resolve event → route (channels + priority)
        │  ├─ duplicate guard (Redis SET NX, 24h)   ← event-level dedup
        │  └─ generate notificationId (uuid)
        ▼
EventRouter.dispatch()  → one job per channel onto BullMQ queue
        │
        ▼
Per-channel Worker (email / sms / push / inapp)
        │  ├─ TemplateService.renderTemplate(tenant, event, channel, vars)
        │  ├─ <Channel>Service.send(payload)
        │  └─ on error → classify (transient → retry, permanent → UnrecoverableError)
        ▼
Delivery (email via Resend; sms/push SIMULATED; inapp persisted + socket emit)
```

---

## 2. Tech stack in use

| Concern | Implemented with |
|---------|------------------|
| Framework | NestJS + TypeScript (strict) |
| Config | `@nestjs/config` + Joi validation (`src/config/env.validation.ts`) |
| Queues | BullMQ + Redis (`@nestjs/bullmq`), one queue per channel |
| Database | MongoDB + Mongoose |
| Cache / dedup | Redis (ioredis) |
| Email | **Resend** (real client) — note: plan says Nodemailer |
| SMS | **Simulated** service (Twilio-shaped errors) |
| Push | **Simulated** service (Firebase-shaped errors) |
| In-app | Socket.io gateway + Mongo persistence |
| Events in | RabbitMQ consumer + REST endpoint |
| WebSocket | `@nestjs/platform-socket.io`, gateway on `WS_PORT` (default 3001) |

---

## 3. Bootstrap & global config (`src/main.ts`)

- Global prefix `api/v1`
- Global `ValidationPipe` (`whitelist: true`, `transform: true`)
- Global `AllExceptionsFilter`
- Global `LoggingInterceptor`
- Socket.io adapter wired in
- CORS enabled
- HTTP on `PORT` (default 3000), WS on `WS_PORT` (default 3001)

**Required env vars** (Joi-validated): `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`,
`RABBITMQ_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `PUSH_DRY_RUN`,
`WS_PORT`, `PORT`, `NODE_ENV`.

---

## 4. Modules registered (`src/app.module.ts`)

`ConfigModule` (global) · `MongooseModule` (async) · `BullModule` (async root) ·
`HealthModule` · `TemplateModule` · `DeliveryModule` · `PreferencesModule` ·
`EventIngestionModule` · `RedisModule`.

> Note: `ChannelsModule` is imported transitively (via the workers' queue usage), not
> listed directly in `app.module.ts`. Verify it is reachable when wiring the consumer end-to-end.

---

## 5. Feature-by-feature status

### ✅ Foundation (Step 1–2)
- `main.ts` bootstrap, global pipe/filter/interceptor, prefix, CORS — **done**
- Config + Joi env validation — **done**
- Enums: `ChannelType` (email/sms/push/inapp), `DeliveryStatus`, `EventPriority` (CRITICAL=1…LOW=4) — **done**
- Interfaces: `IChannel`, `ChannelPayload`, `DeliveryResult`, `NotificationJobData` — **done**
- Health check module — **done**
- Mongoose schemas: `Notification`, `DeliveryLog`, `Template`, `UserPreference`, `InappNotification` — **done**

### ✅ Event Ingestion (Step 3–4)
- `EventIngestionService.ingestEvent()` — resolve route → dedup → dispatch — **done**
- `EventRouter` with `ROUTING_TABLE` (6 event types) + per-channel queue injection — **done**
- `DublicateGuardService` — Redis `SET NX` hash of `eventType:userId:occurredAt:data`, 24h TTL — **done**
- RabbitMQ consumer + REST controller — **done**
- `NotificationEventDto` validation — **done**

### ✅ Channels — workers + services (Step 6)
| Channel | Worker | Service | Notes |
|---------|--------|---------|-------|
| Email | ✅ | ✅ `EmailService` | Real Resend client |
| SMS | ✅ | ✅ `SmsService` | **Simulated**; throws Twilio code 21211 / 503 |
| Push | ✅ | ✅ `PushService` | **Simulated**; throws Firebase invalid-token / server-unavailable |
| In-app | ✅ | ✅ `InappService` + `InappGateway` | Persists to Mongo, then socket emit |

Per-channel retry config (in `ChannelsModule`): email 3 (exp 2s), sms 5 (fixed 60s),
push 3 (exp 2s), inapp 1.

### ✅ Template Engine (Step 7 — done out of order)
- `TemplateService` CRUD + `renderTemplate()`, `template.render.ts` interpolation — **done**
- DTOs: create / update / preview — **done**
- `Template` schema, seed scripts (`src/seeds/`) — **done**
- Redis caching module present (`RedisModule`) — **wired**

### 🟡 Retry / Error Classification / DLQ (Step 8) — ~30%
- ✅ Per-channel BullMQ retry config
- ✅ Error classification: `classify-error.ts` + per-channel `*.errors.ts` (email/sms/push), permanent → `UnrecoverableError`
- ❌ `dlq.service.ts` (move exhausted jobs to dead-letter)
- ❌ DLQ admin API (`GET /dlq`, `POST /:id/replay`, `DELETE /:id/discard`)
- ❌ Send-level idempotency guard (needs DeliveryLog / Step 11)
- ❌ Opossum circuit breaker
- ❌ Admin alerts on DLQ entry

### 🟡 Delivery Tracking (Step 11) — schemas only
- ✅ `Notification` + `DeliveryLog` schemas, `DeliveryModule`
- ❌ `delivery.service.ts` — nothing writes a DeliveryLog yet (no per-attempt tracking)
- ❌ Notification status FSM updates, analytics aggregation

### ✅ User Preferences (Step 9) — done
- ✅ `PreferencesModule` + `UserPreference` schema
- ✅ `preferences.service.ts` (`getOrCreate`, `update`), `preferences.controller.ts`

### ✅ Preference-Based Routing (Step 10) — done
- ✅ `PreferenceRouter` (`preference-router.service.ts`) — pipeline: load prefs →
  muted events (with `marketing.*` wildcard) → channel opt-out → quiet hours
  (timezone-aware, wraps midnight) → priority override → final channels.
- ✅ HIGH/CRITICAL bypass **quiet hours only** (still honor opt-out + mute).
- ✅ `EventIngestionService` runs the pipeline before dispatch; suppressed events
  persist a `Notification` with `status: suppressed` and skip dispatch.
- ✅ `EventRouter.dispatch()` now takes the preference-filtered channel list +
  priority (no longer re-reads the static table).
- ✅ Every routing decision logged (per-channel kept/dropped audit trail).
- ✅ Added `NotificationStatus.SUPPRESSED`.
- ✅ Fixed bugs #4 (`resolve()` return type → `RouteRule | null`) and #5
  (unused `Notification` import in router).

### ❌ Not started
- Digest batching + distributed cron (Step 13)
- Dashboard / analytics API + SSE (Step 12)
- Swagger, full test suite (Step 14–15)
- CI/CD, Security, Multi-tenancy, Schema Registry, Load tests, K8s/Helm/Terraform, ADRs (Phases 10–16)

---

## 6. In-app / offline delivery design (decided)

**Pattern: store-then-emit. MongoDB is the source of truth; the socket is best-effort live push.**

- Worker saves the `InappNotification` doc **first** (`read: false`), then emits to the
  `user_<userId>` Socket.io room.
- **Online user** → gets the live emit.
- **Offline user** → emit hits an empty room (Socket.io silently no-ops); the doc is still
  persisted. Job still completes successfully.

**Catch-up on reconnect:** the user pulls missed notifications by querying `{ userId, read: false }` —
either via a REST endpoint (`GET /notifications/me?unread=true`, recommended) or via a
push-on-connect replay in `handleConnection`.

**Decided: do NOT delete on send.** Acknowledgment = `PATCH /notifications/:id/read`
sets `read: true`. The row is kept for history/unread-count/multi-device consistency.

**Retention via TTL index (not delete-on-send):** preferred variant is an `expiresAt`
field set when a notification is marked read, with a TTL index
`{ expiresAt: 1 }, { expireAfterSeconds: 0 }` — unread notifications (field null) are kept
forever; read ones auto-delete ~90 days after acknowledgment. (MongoDB TTL sweeper runs
~every 60s; not instant, never rely on it for security.)

> This Notification Center read API (`GET /notifications/me`, unread-count, mark-read) is
> **not built yet** — it's V2 feature #1. The write path and offline persistence already work.

---

## 7. Known bugs / gaps (from code review)

1. **Contact resolution missing (highest impact).** Workers read `variables.phone` /
   `variables.token` / `variables.email`, but the router copies `variables = event.data`.
   There is no `userId → contact info` lookup, so real events without those fields in
   `data` fail closed (SMS/push throw permanent → would DLQ). Belongs in preferences/profile (Step 9).
2. **No DeliveryLog written** anywhere — failures are currently invisible (no Step 11 service, no DLQ).
3. **Idempotency guard burns events on dispatch failure.** `DublicateGuardService.isFresh()`
   marks the event seen as a side effect; if `dispatch()` then throws, a retry is rejected as
   duplicate and never delivered. Mark-seen should happen after successful dispatch.
4. **`EventRouter.resolve()` return type** declared `RouteRule` but returns `null` →
   should be `RouteRule | null`.
5. **Unused import** `Notification` in `event-ingestion.router.ts`.
6. In-app persistence + socket emit are **not atomic** (queue is `attempts: 1`).

---

## 8. Recommended next steps (in order)

1. Finish **Step 8** — `dlq.service.ts` + DLQ admin API + opossum circuit breaker.
2. **Step 11** — `delivery.service.ts` to log every attempt/result (unblocks send-level idempotency).
3. **Step 9** — preferences service + controller (also fixes contact-resolution bug #1).
4. Build the **Notification Center API** (V2 #1) + TTL index for the in-app offline story.
5. Fix the self-contained bugs #3, #4, #5.

---

## 9. File map (built so far)

```
src/
├── main.ts, app.module.ts, app.controller.ts, app.service.ts
├── common/
│   ├── dto/notification-event.dto.ts
│   ├── enums/{channel-type, delivery-status, event-priority}.enum.ts
│   ├── errors/classify-error.ts
│   ├── filters/all-exceptions.filter.ts
│   ├── interceptors/logging.interceptor.ts
│   └── interfaces/{channel, delivery-result, notification-job}.interface.ts
├── config/{email, push, rabbitmq, sms}.config.ts, env.validation.ts
├── modules/
│   ├── channels/
│   │   ├── channels.module.ts
│   │   ├── email/{emailService, email.worker, email.errors}.ts
│   │   ├── sms/{sms.service, sms.worker, sms.errors}.ts
│   │   ├── push/{push.service, push.worker, push.errors}.ts
│   │   └── inapp/{inapp.service, inapp.worker, inapp.gateway}.ts
│   │            + schemas/inapp-notification.schema.ts
│   ├── delivery/{delivery.module}.ts + schemas/{notification, delivery-log}.schema.ts
│   ├── event-ingestion/{service, router, consumer, controller, module, DublicateGuardService}.ts
│   ├── health/{health.controller, health.module}.ts
│   ├── preferences/{preferences.module}.ts + schemas/user-preference.schema.ts
│   ├── redis/redis.module.ts
│   └── template/{template.service, template.controller, template.render, template.module}.ts
│            + dto/{create,update,preview}-template.dto.ts + schemas/template.schema.ts
└── seeds/{run, templates.seed}.ts
```
