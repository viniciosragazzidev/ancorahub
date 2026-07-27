[Skip to main content](https://docs.open-wa.org/#__docusaurus_skipToContent_fallback)

[![OpenWA](https://docs.open-wa.org/img/openwa.svg)\\
**OpenWA**](https://www.open-wa.org/) [Docs](https://docs.open-wa.org/) [API Reference](https://docs.open-wa.org/api-reference) [Changelog](https://docs.open-wa.org/changelog)

[v0.8.11](https://docs.open-wa.org/) [11.1k](https://github.com/rmyndharis/OpenWA)

`ctrl`  `K`

- [Introduction](https://docs.open-wa.org/)
- [Getting Started](https://docs.open-wa.org/#)

  - [Quick Start](https://docs.open-wa.org/getting-started/quick-start)
  - [Install Docker](https://docs.open-wa.org/getting-started/install-docker)
  - [Installation](https://docs.open-wa.org/getting-started/installation)
  - [Configuration](https://docs.open-wa.org/getting-started/configuration)
  - [Connect a Session](https://docs.open-wa.org/getting-started/first-session)
- [Guides](https://docs.open-wa.org/#)

- [API Reference](https://docs.open-wa.org/api-reference)

- [SDK](https://docs.open-wa.org/#)

- [Plugins](https://docs.open-wa.org/#)

- [Integrations](https://docs.open-wa.org/#)

- [Self-Hosting](https://docs.open-wa.org/#)

- [Reference](https://docs.open-wa.org/#)

- [Community](https://docs.open-wa.org/#)

- [Changelog](https://docs.open-wa.org/changelog)

- [Home page](https://docs.open-wa.org/)
- Introduction

Version: v0.8.11

On this page

# Introduction

OpenWA is an open-source, self-hosted WhatsApp API Gateway. It wraps a WhatsApp connection in a REST API so your applications can send and receive messages, manage groups and contacts, and react to events — running entirely on infrastructure you control.

This page explains what OpenWA is, the problems it solves, and how its pieces fit together, so you can decide whether it fits your stack before you install anything. This documentation set targets OpenWA v0.8.11.

## What OpenWA gives you [​](https://docs.open-wa.org/\#what-openwa-gives-you "Direct link to What OpenWA gives you")

WhatsApp does not offer a free, self-hostable HTTP API. Most hosted gateways fill that gap but charge for the parts you need most — multi-session, PostgreSQL, a dashboard, webhook management — and keep your message data on their servers.

OpenWA inverts that trade. The full feature set is open source under the MIT license, and every byte of session and message data stays on your own machine. You own the deployment, the data, and the source.

- **Open source, no feature gates.** The complete codebase is MIT-licensed. There is no paid tier and no locked feature — fork it, audit it, extend it.
- **Self-hosted, no vendor lock-in.** Sessions, messages, and media live on your server. Nothing routes through a third-party SaaS.
- **Pluggable adapters.** Swap the database (SQLite or PostgreSQL), media storage (local filesystem or S3/MinIO), and cache (Redis or none) through environment variables — no code changes.
- **Multi-session.** Run several WhatsApp accounts concurrently on one instance.
- **Web dashboard.** A bundled React UI manages sessions, webhooks, and API keys, served by the API on the same port.
- **Signed webhooks.** Message and session events are delivered to your endpoints in real time, signed with HMAC so your receiver can verify they came from your gateway.
- **Typed SDKs.** Official clients for JavaScript/TypeScript, Python, PHP, and Java wrap every endpoint with typed methods and typed errors. See the [SDK overview](https://docs.open-wa.org/sdk/overview).

## Feature overview [​](https://docs.open-wa.org/\#feature-overview "Direct link to Feature overview")

| Area | What you get |
| --- | --- |
| **API** | REST API under the `/api` prefix; interactive Swagger docs at `/api/docs` |
| **Messaging** | Text, images, video, audio (incl. PTT voice notes), documents, stickers, reactions, replies, forwards, native polls, @mentions, bulk sends |
| **Sessions** | Multi-session; QR-code or pairing-code auth; lifecycle status tracking |
| **Groups & channels** | Create and manage groups, participants, and invites; WhatsApp Channels support |
| **Contacts & labels** | Contact lookup and management; chat labels (WhatsApp Business) |
| **Webhooks** | Per-session subscriptions, HMAC signatures, automatic retries, dead-letter + redrive, optional pre-dispatch filters |
| **Integrations** | Integration Fabric for bidirectional external bridges (helpdesk/CRM/chatbot) via sandboxed plugins; optional MCP server for AI agents |
| **Auth** | API-key authentication via the `X-API-Key` header, with roles and per-key IP allow-lists |
| **Database** | SQLite (zero-config default) or PostgreSQL — set `DATABASE_TYPE` |
| **Storage** | Local filesystem or S3/MinIO — set `STORAGE_TYPE` |
| **Cache** | Optional Redis — set `REDIS_ENABLED`; when off, the cache layer no-ops |
| **Engine** | Baileys (browser-free) or whatsapp-web.js — set `ENGINE_TYPE` |

The REST API is organized into the resource tags **sessions, messages, webhooks, contacts, groups, labels, channels, and health**. For the full request and response shape of every endpoint, see the generated [API reference](https://docs.open-wa.org/api-reference).

## How it fits together [​](https://docs.open-wa.org/\#how-it-fits-together "Direct link to How it fits together")

OpenWA sits between your applications and WhatsApp. Requests arrive over HTTP authenticated with an API key; the NestJS API drives a pluggable WhatsApp engine that talks to WhatsApp's servers; and the database, storage, and cache backends are selected by configuration. When WhatsApp emits an event, OpenWA signs it and delivers it to your webhook endpoints.

OpenWA instance

X-API-Key

WhatsApp protocol

HMAC-signed events

Pluggable adapters

Database

SQLite / PostgreSQL

Storage

Local / S3

Cache

Redis / none

Your apps · Dashboard · SDK

REST API (NestJS)

WhatsApp engine

Baileys / whatsapp-web.js

WhatsApp servers

Your webhook endpoints

The WhatsApp engine is the one formal plug-in interface. The database, storage, and cache backends are single services that switch implementation based on an environment variable, so you can run a minimal SQLite-and-local-storage instance or a PostgreSQL-and-S3 one from the same image. See the [configuration reference](https://docs.open-wa.org/getting-started/configuration) for how to select each backend.

## A request in practice [​](https://docs.open-wa.org/\#a-request-in-practice "Direct link to A request in practice")

Every call carries the `X-API-Key` header. In local development the API base URL is `http://localhost:2785/api` (note the `/api` prefix); in production it sits behind your own domain and TLS. Sending a text message looks like this:

```bash
curl -X POST http://localhost:2785/api/sessions/my-session/messages/send-text \

  -H "Content-Type: application/json" \

  -H "X-API-Key: YOUR_API_KEY" \

  -d '{

    "chatId": "628123456789@c.us",

    "text": "Hello from OpenWA!"

  }'
```

```json
{

  "messageId": "3EB0XXXXXXXXXXXXXXXX",

  "timestamp": 1719400000

}
```

Replace `YOUR_API_KEY` with a key minted on first run (the [Quick Start](https://docs.open-wa.org/getting-started/quick-start) shows where it comes from), and `my-session` with a session you have authenticated. The typed SDK wraps the same call:

```ts
import { OpenWAClient } from '@rmyndharis/openwa';

const client = new OpenWAClient({

  baseUrl: 'http://localhost:2785',

  apiKey: 'YOUR_API_KEY',

});

const result = await client.messages.sendText('my-session', {

  chatId: '628123456789@c.us',

  text: 'Hello from OpenWA!',

});

console.log(result.messageId);
```

## Engines and adapters [​](https://docs.open-wa.org/\#engines-and-adapters "Direct link to Engines and adapters")

OpenWA speaks to WhatsApp through one of two interchangeable engines, chosen with `ENGINE_TYPE`:

- **Baileys** — a browser-free WebSocket client with a small memory footprint. Suited to running many sessions on modest hardware.
- **whatsapp-web.js** — a Chromium/Puppeteer-based client. Heavier per session, but uses a real browser fingerprint.

Because both implement the same engine interface, switching is a config change and a restart — your application code and the REST payloads do not change. The same principle holds for the infrastructure adapters: move from SQLite to PostgreSQL, local storage to S3/MinIO, or no cache to Redis by editing environment variables. The trade-offs behind each choice are covered in [scaling](https://docs.open-wa.org/self-hosting/scaling); moving existing data between backends is covered in [migration](https://docs.open-wa.org/self-hosting/migration).

note

OpenWA connects through an unofficial WhatsApp interface and is not affiliated with or endorsed by Meta. You are responsible for using it in line with WhatsApp's terms of service.

## Next steps [​](https://docs.open-wa.org/\#next-steps "Direct link to Next steps")

- [Quick Start](https://docs.open-wa.org/getting-started/quick-start) — get OpenWA running and send your first message in about five minutes.
- [Installation](https://docs.open-wa.org/getting-started/installation) — Docker and local-development setup options.
- [Configuration](https://docs.open-wa.org/getting-started/configuration) — select your database, storage, cache, and engine.

[Next\\
\\
Quick Start](https://docs.open-wa.org/getting-started/quick-start)

- [What OpenWA gives you](https://docs.open-wa.org/#what-openwa-gives-you)
- [Feature overview](https://docs.open-wa.org/#feature-overview)
- [How it fits together](https://docs.open-wa.org/#how-it-fits-together)
- [A request in practice](https://docs.open-wa.org/#a-request-in-practice)
- [Engines and adapters](https://docs.open-wa.org/#engines-and-adapters)
- [Next steps](https://docs.open-wa.org/#next-steps)

Made with ❤ by [Yudhi Armyndharis](https://github.com/rmyndharis) and the OpenWA Community