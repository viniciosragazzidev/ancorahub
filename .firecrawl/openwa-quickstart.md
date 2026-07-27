[Skip to content](https://www.open-wa.org/#main-content)

[![OpenWA Logo](https://www.open-wa.org/assets/openwa.svg)OpenWA](https://www.open-wa.org/#)

[11.1k](https://github.com/rmyndharis/OpenWA)Menu

[01Features](https://www.open-wa.org/#features) [02Architecture](https://www.open-wa.org/#architecture) [03Compare](https://www.open-wa.org/#compare) [04Quick Start](https://www.open-wa.org/#quickstart) [05Tech Stack](https://www.open-wa.org/#tech) [06Ecosystem](https://www.open-wa.org/#ecosystem) [07Plugins](https://www.open-wa.org/#plugins) [08Changelog](https://www.open-wa.org/#changelog) [09FAQ](https://www.open-wa.org/#faq) [10Community](https://www.open-wa.org/#community)

[GitHub](https://github.com/rmyndharis/OpenWA) [Documentation](https://docs.open-wa.org/) [Issues](https://github.com/rmyndharis/OpenWA/issues)

[v0.8.16 releasedWhat's new →](https://www.open-wa.org/#changelog)

# Open Source  WhatsApp API Gateway

The free, self-hosted WhatsApp HTTP API for developers who want to own their stack —
**full control**, a clean architecture, and **zero vendor lock-in**.
Your data never leaves your server.


[Get Started](https://www.open-wa.org/#quickstart) [View on GitHub](https://github.com/rmyndharis/OpenWA)

100% Free

Open Source

Self-Hosted

Production Ready

![](https://www.open-wa.org/assets/openwa_logo.webp)

01 — Capabilities

## Everything you need to ship.

A complete WhatsApp integration platform — **100% free and open**
**source**,
production-ready out of the box.

### Core

- Full REST API
- Multi-Session Support
- Real-time Webhooks (HMAC)
- Web Dashboard (9 Locales)
- Scoped API Key Auth
- Swagger Docs

### Messaging

- Text Messages
- Images & Videos
- Documents & Audio
- Message Reactions
- Bulk Messaging
- Delivery Status

### Advanced

- Groups API
- Channels / Newsletter
- Labels Management
- Proxy Per Session
- CIDR IP Whitelisting
- Rate Limiting & Audit

### Infrastructure

- SQLite / PostgreSQL
- Redis Cache + Queues
- S3 / MinIO Storage
- Multi-arch Docker
- Non-root Container
- Health & Migrations

02 — Architecture

## Built on a pluggable core.

Swap your database, storage, cache, and even the WhatsApp engine — all from
config. **Zero code changes.**

### Pluggable Architecture

Database (SQLite / PostgreSQL), storage (Local / S3 / MinIO), and cache (Memory / Redis) are
swappable adapters — configured, not coded. Move from local dev to production scale without
touching application logic.

SQLitePostgreSQLLocalS3MinIORedis

### Dual WhatsApp Engine

Choose your engine per deployment via `ENGINE_TYPE`. Ship with the battle-tested
`whatsapp-web.js` (Puppeteer) by default, or switch to the lightweight
`baileys` WebSocket engine when you'd rather skip the browser entirely.


whatsapp-web.jsbaileys

03 — Comparison

## Why developers choose OpenWA.

| Feature | OpenWA | W. Core | W. Plus | W. Cloud |
| --- | --- | --- | --- | --- |
| Price | Free Forever | Free | $50+/mo | $30+/mo |
| Open Source |  |  |  |  |
| Multi-Session |  | Limited |  |  |
| Web Dashboard |  |  |  |  |
| PostgreSQL |  |  |  | N/A |
| Webhook UI |  |  |  |  |
| Source Code |  |  |  |  |
| Self-Hosted |  |  |  |  |

Comparison reflects publicly available feature listings as of 2026.
Competitor names are abbreviated. Features and pricing may change — verify on their official
sites before deciding.

04 — Quick Start

## Live in 5 minutes.

**One command with Docker**, or a quick local setup for development
— no
complicated config, no surprises.

DockerLocal Dev

Terminal

```
# Clone and start with Docker (single-container quick start)
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
docker compose -f docker-compose.dev.yml up -d

# Dashboard & API are bundled on one port:
# http://localhost:2785
```

Terminal

```
# Clone and run locally
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA

# Install dependencies (includes dashboard)
npm install

# Start API + Dashboard with hot reload
npm run dev

# Dashboard: http://localhost:2886
```

Dashboard`:2785`

REST API`:2785/api`

Swagger`:2785/api/docs`

In `npm run dev` (local) the dashboard runs on its own Vite server
at `:2886` with hot reload. In Docker it's bundled into the API image and served on
`:2785`. For production, deploy using `docker compose up -d`, with optional
scaling profiles: `--profile postgres`, `--profile redis`,
`--profile minio`, or `--profile full`.


05 — Tech Stack

## Built on a modern, trusted stack.

Proven, production-grade tools — chosen for **reliability, not**
**novelty**.

![Node.js](https://www.open-wa.org/assets/tech/nodejs.svg)Node.js 22

![NestJS](https://www.open-wa.org/assets/tech/nestjs.svg)NestJS 11

![TypeScript](https://www.open-wa.org/assets/tech/typescript.svg)TypeScript 5

![React](https://www.open-wa.org/assets/tech/react.svg)React 19

![PostgreSQL](https://www.open-wa.org/assets/tech/postgresql.svg)PostgreSQL

![Redis](https://www.open-wa.org/assets/tech/redis.svg)Redis + BullMQ

![Docker](https://www.open-wa.org/assets/tech/docker.svg)Docker Multi-arch

![Socket.IO](https://www.open-wa.org/assets/tech/socketio.svg)Socket.IO

TypeORM for data access · Vite + TanStack Query + i18next power the dashboard ·
Helmet & NestJS Throttler harden the API · Pluggable WA engine: `whatsapp-web.js`
(default) or `baileys` via `ENGINE_TYPE`.

06 — Ecosystem

## An ecosystem, not just an API.

Connect OpenWA to **the tools you already use**.

[**n8n Nodes** \\
Official community nodes — `@rmyndharis/n8n-nodes-openwa` — for building WhatsApp\\
automations across hundreds of services.\\
Install in n8n →](https://github.com/rmyndharis/OpenWA-n8n) [**ioBroker Adapter** \\
Community-maintained adapter for home & IoT automation, with Blockly blocks for text,\\
image, video, audio and document messages.\\
View adapter →](https://github.com/ThorstenBoettler/ioBroker.openwa) [**Official SDKs** \\
Hand-written, fully-typed client libraries for the REST API — JavaScript/TypeScript\\
(`@rmyndharis/openwa`), Python (`rmyndharis-openwa`) and PHP\\
(`rmyndharis/openwa`), published to npm, PyPI and Packagist.\\
Get the SDKs →](https://github.com/rmyndharis/OpenWA/tree/main/sdk)

07 — Plugins

## Make it yours. Build a plugin.

OpenWA is **yours to shape**. Got an idea? Spin up a plugin
— it comes alive on real WhatsApp events through typed lifecycle hooks: send replies,
query chats and contacts, reach your own services, all behind a safe, permission-gated API.
**No fork, no core changes.** Build it, share it with the community, and make the
gateway do exactly what you imagined.

- React to events
- Send & reply
- Query & call out

[Read the plugin docs →](https://docs.open-wa.org/plugins/overview) [OpenWA-plugins on GitHub →](https://github.com/rmyndharis/OpenWA-plugins)

OpenWA SYSTEMS

auto-reply

webhook-relay

broadcast

chat-logger

\+ add plugin

08 — Changelog

## Shipping, in the open.

Every release, pulled live from the source `CHANGELOG.md` — no
copy-paste, **always current**.

UnreleasedIn progress

Added

- `AuditAction` emit-coverage gate
- Operator-tunable HTTP server timeouts
- Committed OpenAPI snapshot + CI sync gate
- Pre-release boot smoke on amd64 + arm64
- +10 more in this release

Fixed

- Diagnosable failure for a stale browser profile after a binary-changing upgrade
- OpenAPI export script under current env validation

v0.8.162026-07-12

Added

- Integration SDK v1 `response` contract for inbound routes
- `standard-webhooks` ingress signature scheme

v0.8.152026-07-11

[View full changelog on GitHub →](https://github.com/rmyndharis/OpenWA/blob/main/CHANGELOG.md)

09 — FAQ

## Frequently Asked Questions

Got questions? We've got answers.

Is OpenWA really free?

Yes. OpenWA is 100% free and open source under the MIT license — no licensing fees,
no feature locks, and full source code access. You can use it in personal and
commercial projects without any restrictions.

Is OpenWA affiliated with Meta or WhatsApp?

No. OpenWA is an independent, community-driven open-source project and has **no**
**affiliation, association, authorization, endorsement, or official connection**
**with Meta Platforms, Inc., WhatsApp LLC**, or any of their subsidiaries
or affiliates.

This software is developed independently to help developers integrate WhatsApp
capabilities into their own applications using self-hosted infrastructure. All
registered trademarks and logos belong to their respective owners.

Does using OpenWA risk account bans?

Because OpenWA is self-hosted and acts as a gateway on your own infrastructure,
account safety is entirely determined by your messaging behavior. WhatsApp's
automated spam detection filters look for bot-like patterns on their network, and
any automated third-party integration carries some risk if abused.

To minimize these risks, OpenWA is specifically engineered with built-in protection
mechanisms:

- **Simulated Human Behavior:**
Configurable simulated typing indicators and randomized message delivery
intervals.
- **Session Proxying:** Ability to
route each session through a dedicated proxy IP to match account locations.
- **Strict Rate-Limiting:** Hardened
limits to prevent bursting message delivery.
- **Official Engine Parity:** Stays
aligned with standard web browser and network protocols to avoid protocol
fingerprinting flags.

To keep your account safe, we strongly recommend warming up new numbers, avoiding
cold outreach/spam, and using OpenWA primarily for transactional notifications,
customer service, or opt-in communication.

Can I self-host OpenWA?

Yes. OpenWA is designed for self-hosting with a single Docker command. The API and
the dashboard are bundled together on port `2785`, making it easy to
deploy to any cloud provider, VPS, or local server.

Which WhatsApp engines does OpenWA support?

The default engine is `whatsapp-web.js` (a Puppeteer-based headless
browser). You can also switch to the lightweight `baileys` engine (a
WebSocket-based implementation) via the `ENGINE_TYPE` environment
variable to save resources and run browserless.

Can I change the database or storage backend?

Yes. OpenWA's pluggable architecture lets you swap the database (SQLite /
PostgreSQL), media storage (Local / S3 / MinIO), and cache layer (Memory / Redis)
purely from configuration without changing any code.

10 — Community

## Built in the open.

OpenWA is open from the first commit to the latest release. MIT licensed, free forever, and
open to contributions of every kind — code, documentation, or a well-written bug
report.

MITLicense

-34646%Free

OpenSource

[Star on GitHub](https://github.com/rmyndharis/OpenWA) [View Docs](https://docs.open-wa.org/)

### How to contribute

1. 01Fork the repository
2. 02Create your feature branch
3. 03Commit your changes
4. 04Push to the branch
5. 05Open a Pull Request

### The people behind OpenWA

Every developer who has shipped code, docs, or fixes — pulled
live from GitHub. Thank you. ♥

[![rmyndharis](https://avatars.githubusercontent.com/u/2390382?v=4&s=96)](https://github.com/rmyndharis "rmyndharis — 543 contributions")[![tobiasstrebitzer](https://avatars.githubusercontent.com/u/222509?v=4&s=96)](https://github.com/tobiasstrebitzer "tobiasstrebitzer — 8 contributions")[![dallascyclist](https://avatars.githubusercontent.com/u/16263935?v=4&s=96)](https://github.com/dallascyclist "dallascyclist — 8 contributions")[![albanobattistella](https://avatars.githubusercontent.com/u/34811668?v=4&s=96)](https://github.com/albanobattistella "albanobattistella — 7 contributions")[![Abhishekrajpurohit](https://avatars.githubusercontent.com/u/71376117?v=4&s=96)](https://github.com/Abhishekrajpurohit "Abhishekrajpurohit — 4 contributions")[![ulises2k](https://avatars.githubusercontent.com/u/2415609?v=4&s=96)](https://github.com/ulises2k "ulises2k — 4 contributions")[![hsnyvsh](https://avatars.githubusercontent.com/u/60756171?v=4&s=96)](https://github.com/hsnyvsh "hsnyvsh — 4 contributions")[![m7fz7](https://avatars.githubusercontent.com/u/75252008?v=4&s=96)](https://github.com/m7fz7 "m7fz7 — 4 contributions")[![MS-Jahan](https://avatars.githubusercontent.com/u/27774290?v=4&s=96)](https://github.com/MS-Jahan "MS-Jahan — 3 contributions")[![softronicve](https://avatars.githubusercontent.com/u/224290725?v=4&s=96)](https://github.com/softronicve "softronicve — 3 contributions")[![spidgrou](https://avatars.githubusercontent.com/u/42083306?v=4&s=96)](https://github.com/spidgrou "spidgrou — 3 contributions")[![aqilaziz](https://avatars.githubusercontent.com/u/46887634?v=4&s=96)](https://github.com/aqilaziz "aqilaziz — 2 contributions")[![Leslie-23](https://avatars.githubusercontent.com/u/97734325?v=4&s=96)](https://github.com/Leslie-23 "Leslie-23 — 2 contributions")[![amstrong-bil](https://avatars.githubusercontent.com/u/201595245?v=4&s=96)](https://github.com/amstrong-bil "amstrong-bil — 2 contributions")[![muhfalihr](https://avatars.githubusercontent.com/u/120786185?v=4&s=96)](https://github.com/muhfalihr "muhfalihr — 2 contributions")[![akash247777](https://avatars.githubusercontent.com/u/118187023?v=4&s=96)](https://github.com/akash247777 "akash247777 — 1 contribution")[![Al-win-Joby](https://avatars.githubusercontent.com/u/104632249?v=4&s=96)](https://github.com/Al-win-Joby "Al-win-Joby — 1 contribution")[![alejo117](https://avatars.githubusercontent.com/u/90878355?v=4&s=96)](https://github.com/alejo117 "alejo117 — 1 contribution")[![A831ARD0](https://avatars.githubusercontent.com/u/9155202?v=4&s=96)](https://github.com/A831ARD0 "A831ARD0 — 1 contribution")[![carlosjcuello](https://avatars.githubusercontent.com/u/280698536?v=4&s=96)](https://github.com/carlosjcuello "carlosjcuello — 1 contribution")[![MrViSiOn](https://avatars.githubusercontent.com/u/67826?v=4&s=96)](https://github.com/MrViSiOn "MrViSiOn — 1 contribution")[![Fernixp](https://avatars.githubusercontent.com/u/104770774?v=4&s=96)](https://github.com/Fernixp "Fernixp — 1 contribution")[![haseeblodhi1899](https://avatars.githubusercontent.com/u/197936674?v=4&s=96)](https://github.com/haseeblodhi1899 "haseeblodhi1899 — 1 contribution")[![Singh1106](https://avatars.githubusercontent.com/u/50988793?v=4&s=96)](https://github.com/Singh1106 "Singh1106 — 1 contribution")[![JibayMcs](https://avatars.githubusercontent.com/u/7621593?v=4&s=96)](https://github.com/JibayMcs "JibayMcs — 1 contribution")[![jimmimohtar](https://avatars.githubusercontent.com/u/22894405?v=4&s=96)](https://github.com/jimmimohtar "jimmimohtar — 1 contribution")[![maplerichie](https://avatars.githubusercontent.com/u/10757316?v=4&s=96)](https://github.com/maplerichie "maplerichie — 1 contribution")[![goldytech](https://avatars.githubusercontent.com/u/1241633?v=4&s=96)](https://github.com/goldytech "goldytech — 1 contribution")[![Mustafa-Shoukat1](https://avatars.githubusercontent.com/u/162743520?v=4&s=96)](https://github.com/Mustafa-Shoukat1 "Mustafa-Shoukat1 — 1 contribution")[![pranav-027](https://avatars.githubusercontent.com/u/71957060?v=4&s=96)](https://github.com/pranav-027 "pranav-027 — 1 contribution")[![quinton-8](https://avatars.githubusercontent.com/u/211494205?v=4&s=96)](https://github.com/quinton-8 "quinton-8 — 1 contribution")[![rafaelmerlotto](https://avatars.githubusercontent.com/u/106768498?v=4&s=96)](https://github.com/rafaelmerlotto "rafaelmerlotto — 1 contribution")[![Stanley-blik](https://avatars.githubusercontent.com/u/188949634?v=4&s=96)](https://github.com/Stanley-blik "Stanley-blik — 1 contribution")[![suraj7974](https://avatars.githubusercontent.com/u/140960022?v=4&s=96)](https://github.com/suraj7974 "suraj7974 — 1 contribution")[![Deep-Bhanushali](https://avatars.githubusercontent.com/u/161147802?v=4&s=96)](https://github.com/Deep-Bhanushali "Deep-Bhanushali — 1 contribution")[![aeyeio](https://avatars.githubusercontent.com/u/206663179?v=4&s=96)](https://github.com/aeyeio "aeyeio — 1 contribution")[![farrasyakila](https://avatars.githubusercontent.com/u/67940127?v=4&s=96)](https://github.com/farrasyakila "farrasyakila — 1 contribution")[![gaussepic](https://avatars.githubusercontent.com/u/40401892?v=4&s=96)](https://github.com/gaussepic "gaussepic — 1 contribution")[![mayko7d](https://avatars.githubusercontent.com/u/213075743?v=4&s=96)](https://github.com/mayko7d "mayko7d — 1 contribution")[![moduvoice](https://avatars.githubusercontent.com/u/291867022?v=4&s=96)](https://github.com/moduvoice "moduvoice — 1 contribution")[![robtrejo](https://avatars.githubusercontent.com/u/131044216?v=4&s=96)](https://github.com/robtrejo "robtrejo — 1 contribution")

![OpenWA](https://www.open-wa.org/assets/openwa.svg)OpenWA

Open Source WhatsApp API Gateway. Self-hosted, production-ready, no
vendor lock-in.

#### Resources

[Documentation](https://docs.open-wa.org/) [API Reference](https://docs.open-wa.org/api-reference) [Contributing](https://docs.open-wa.org/community/contributing)

#### Community

[GitHub](https://github.com/rmyndharis/OpenWA) [Issues](https://github.com/rmyndharis/OpenWA/issues) [Discussions](https://github.com/rmyndharis/OpenWA/discussions)

Disclaimer: OpenWA is an independent open-source project and is not affiliated, associated,
authorized, endorsed by, or in any way officially connected with Meta Platforms, Inc., WhatsApp
LLC, or any of their subsidiaries or affiliates. The official WhatsApp website can be found at
[whatsapp.com](https://www.whatsapp.com/).
The name "WhatsApp" as well as related names, marks, emblems, and images are registered
trademarks of their respective owners.


Made with  by [Yudhi Armyndharis](https://github.com/rmyndharis) and the OpenWA Community

MIT License© 2026 OpenWA