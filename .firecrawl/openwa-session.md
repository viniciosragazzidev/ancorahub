[Skip to main content](https://docs.open-wa.org/getting-started/first-session/#__docusaurus_skipToContent_fallback)

[![OpenWA](https://docs.open-wa.org/img/openwa.svg)\\
**OpenWA**](https://www.open-wa.org/) [Docs](https://docs.open-wa.org/) [API Reference](https://docs.open-wa.org/api-reference) [Changelog](https://docs.open-wa.org/changelog)

[v0.8.11](https://docs.open-wa.org/getting-started/first-session) [11.1k](https://github.com/rmyndharis/OpenWA)

`ctrl`  `K`

- [Introduction](https://docs.open-wa.org/)
- [Getting Started](https://docs.open-wa.org/getting-started/first-session/#)

  - [Quick Start](https://docs.open-wa.org/getting-started/quick-start)
  - [Install Docker](https://docs.open-wa.org/getting-started/install-docker)
  - [Installation](https://docs.open-wa.org/getting-started/installation)
  - [Configuration](https://docs.open-wa.org/getting-started/configuration)
  - [Connect a Session](https://docs.open-wa.org/getting-started/first-session)
- [Guides](https://docs.open-wa.org/getting-started/first-session/#)

- [API Reference](https://docs.open-wa.org/api-reference)

- [SDK](https://docs.open-wa.org/getting-started/first-session/#)

- [Plugins](https://docs.open-wa.org/getting-started/first-session/#)

- [Integrations](https://docs.open-wa.org/getting-started/first-session/#)

- [Self-Hosting](https://docs.open-wa.org/getting-started/first-session/#)

- [Reference](https://docs.open-wa.org/getting-started/first-session/#)

- [Community](https://docs.open-wa.org/getting-started/first-session/#)

- [Changelog](https://docs.open-wa.org/changelog)

- [Home page](https://docs.open-wa.org/)
- Getting Started
- Connect a Session

Version: v0.8.11

On this page

# Connect a session

By the end of this tutorial you will have a WhatsApp account linked to OpenWA and a test message delivered from it. The path is four steps: create a session, start it, scan its QR code, then send a message.

A **session** is one linked WhatsApp account. One OpenWA instance runs many sessions side by side, each identified by its own UUID.

Prerequisites

- OpenWA running locally — see [Installation](https://docs.open-wa.org/getting-started/installation). This tutorial uses the base URL `http://localhost:2785/api`.
- An API key with at least the `operator` role. Creating, starting, and sending all require `operator`; the seeded admin key works. See [Authentication](https://docs.open-wa.org/guides/authentication) for where the key comes from.
- WhatsApp installed on a phone you can scan a QR code with.

Every request below sends your key in the `X-API-Key` header. Export it once so the examples are copy-paste runnable:

```bash
export API_KEY="YOUR_API_KEY"
```

## How a session connects [​](https://docs.open-wa.org/getting-started/first-session/\#how-a-session-connects "Direct link to How a session connects")

A session moves through a fixed set of states from creation to connected. You drive the first two transitions with API calls; WhatsApp drives the rest once you scan.

POST /sessions

POST /sessions/{id}/start

engine emits QR

you scan the QR

link established

stop / link dropped

restart

engine error

link rejected

created

initializing

qr\_ready

authenticating

ready

disconnected

failed

The `status` field on a session is always one of these lowercase values:

| Status | Meaning | What you do |
| --- | --- | --- |
| `created` | Session exists; the engine has not started. | Call start. |
| `initializing` | Engine is starting and contacting WhatsApp. | Wait, then fetch the QR. |
| `qr_ready` | A QR code is available to scan. | Scan it with your phone. |
| `authenticating` | QR scanned; the link handshake is finishing. | Wait. |
| `ready` | Connected. The session can send and receive. | Send a message. |
| `disconnected` | Link closed (you stopped it, or it dropped). Usually reconnects without a new QR. | Restart if needed. |
| `failed` | Terminal error (for example, the link was rejected). `lastError` explains it. | Inspect `lastError`, then retry. |

You have two ways to walk this flow: the dashboard, which renders the QR for you, or the API. Pick one — both reach the same `ready` state.

## Option A — connect via the dashboard [​](https://docs.open-wa.org/getting-started/first-session/\#option-a--connect-via-the-dashboard "Direct link to Option A — connect via the dashboard")

The dashboard runs on the same port as the API. Use it if you want to scan without scripting anything.

1. Open `http://localhost:2785` and sign in with your API key.
2. Go to **Sessions** and choose **New Session**. Give it a name (letters, numbers, and hyphens; 3–50 characters).
3. Start the session. A live QR code appears once the status reaches `qr_ready`.
4. On your phone, open **WhatsApp → Settings → Linked devices → Link a device** and point the camera at the QR.
5. Watch the status badge advance through `authenticating` to `ready`.

Fresh QR codes are pushed to the dashboard over its WebSocket connection, so an expired code is replaced for you without a page reload.

Link by phone number instead of QR

The connect modal also has a **Link with Phone Number** tab. Enter the number in international
format (digits only) and the dashboard requests an 8-character pairing code to type into WhatsApp
under **Link a device → Link with phone number** — useful on a headless server or when you cannot
scan a QR.

For a full tour of the interface, see the [dashboard guide](https://docs.open-wa.org/guides/dashboard). The rest of this tutorial uses the API.

## Option B — connect via the API [​](https://docs.open-wa.org/getting-started/first-session/\#option-b--connect-via-the-api "Direct link to Option B — connect via the API")

### 1\. Create the session [​](https://docs.open-wa.org/getting-started/first-session/\#1-create-the-session "Direct link to 1. Create the session")

`POST /api/sessions` registers a session. Only `name` is required — letters, numbers, and hyphens, 3 to 50 characters.

```bash
curl -X POST http://localhost:2785/api/sessions \

  -H "Content-Type: application/json" \

  -H "X-API-Key: $API_KEY" \

  -d '{ "name": "my-bot" }'
```

A `201 Created` returns the new session. Its `status` is `created` and it has a UUID `id` you use in every later call:

```json
{

  "id": "8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a",

  "name": "my-bot",

  "status": "created",

  "phone": null,

  "pushName": null,

  "connectedAt": null,

  "lastActive": null,

  "createdAt": "2026-06-25T09:00:00.000Z",

  "updatedAt": "2026-06-25T09:00:00.000Z",

  "lastError": null

}
```

Save the `id` for the rest of the tutorial:

```bash
export SESSION_ID="8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a"
```

A duplicate `name` returns `409 Conflict`. A name outside the allowed length or character set returns `400`.

Deleting a session purges its credentials

`DELETE /api/sessions/{id}` now also removes the engine's on-disk auth directory
(`data/baileys/<name>` for Baileys, `data/sessions/session-<name>` for whatsapp-web.js), not just
the database rows — and it cascades the webhooks, templates, and stored Baileys messages that
reference the session. Recreating a session under the same name therefore starts fresh: it no
longer reloads the previous account's stale credentials. See the [Sessions guide](https://docs.open-wa.org/guides/sessions)
for the full lifecycle.

### 2\. Start the session [​](https://docs.open-wa.org/getting-started/first-session/\#2-start-the-session "Direct link to 2. Start the session")

`POST /api/sessions/{id}/start` boots the WhatsApp engine. The response is the session with its status advanced to `initializing`.

```bash
curl -X POST http://localhost:2785/api/sessions/$SESSION_ID/start \

  -H "X-API-Key: $API_KEY"
```

```json
{

  "id": "8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a",

  "name": "my-bot",

  "status": "initializing",

  "phone": null,

  "pushName": null,

  "connectedAt": null,

  "lastActive": null,

  "createdAt": "2026-06-25T09:00:00.000Z",

  "updatedAt": "2026-06-25T09:05:00.000Z",

  "lastError": null

}
```

Starting an already-started session returns `400`. Within a second or two the status moves on to `qr_ready`.

### 3\. Fetch and scan the QR code [​](https://docs.open-wa.org/getting-started/first-session/\#3-fetch-and-scan-the-qr-code "Direct link to 3. Fetch and scan the QR code")

`GET /api/sessions/{id}/qr` returns the current QR as a PNG data URL, plus the session's status.

```bash
curl http://localhost:2785/api/sessions/$SESSION_ID/qr \

  -H "X-API-Key: $API_KEY"
```

```json
{

  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",

  "status": "qr_ready"

}
```

If you get `400` here, the engine has not reached `qr_ready` yet (or the session is already linked). Wait a moment and retry the same call.

To scan, render `qrCode` as an image. The fastest way from the terminal is to write the data URL to an HTML file and open it:

```bash
QR=$(curl -s http://localhost:2785/api/sessions/$SESSION_ID/qr \

  -H "X-API-Key: $API_KEY" | sed 's/.*"qrCode":"\([^"]*\)".*/\1/')

echo "<img src=\"$QR\">" > qr.html

open qr.html   # macOS; use xdg-open on Linux
```

On your phone, open **WhatsApp → Settings → Linked devices → Link a device** and scan the image. WhatsApp rotates the QR every few seconds, so if it expires before you scan, re-fetch it with the same `GET` call.

No way to scan a QR?

On a headless server, link by phone number instead. `POST /api/sessions/{id}/pairing-code` with `{ "phoneNumber": "628123456789" }` (digits only, country code first, 6–15 digits) returns an 8-character `pairingCode`. Enter it under **Link a device → Link with phone number** on your phone.

### 4\. Confirm it is connected [​](https://docs.open-wa.org/getting-started/first-session/\#4-confirm-it-is-connected "Direct link to 4. Confirm it is connected")

Poll the session until its status is `ready`. `GET /api/sessions/{id}` returns the current state.

```bash
curl http://localhost:2785/api/sessions/$SESSION_ID \

  -H "X-API-Key: $API_KEY"
```

Once linked, `status` is `ready` and `phone` carries the connected number:

```json
{

  "id": "8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a",

  "name": "my-bot",

  "status": "ready",

  "phone": "628123456789",

  "pushName": "My Bot",

  "connectedAt": "2026-06-25T09:06:11.000Z",

  "lastActive": "2026-06-25T09:06:11.000Z",

  "createdAt": "2026-06-25T09:00:00.000Z",

  "updatedAt": "2026-06-25T09:06:11.000Z",

  "lastError": null

}
```

If `status` is `failed`, read `lastError` for the reason, then stop and start the session to retry.

## Send a test message [​](https://docs.open-wa.org/getting-started/first-session/\#send-a-test-message "Direct link to Send a test message")

With the session `ready`, send a text. `chatId` is the recipient's number in international format — digits only, no `+` — followed by `@c.us`. Send to your own number first.

```bash
curl -X POST http://localhost:2785/api/sessions/$SESSION_ID/messages/send-text \

  -H "Content-Type: application/json" \

  -H "X-API-Key: $API_KEY" \

  -d '{

    "chatId": "628123456789@c.us",

    "text": "Hello from OpenWA!"

  }'
```

A `201 Created` returns the WhatsApp message id and an epoch-seconds timestamp. The message arrives on the recipient's phone:

```json
{

  "messageId": "true_628123456789@c.us_3EB0ABCD",

  "timestamp": 1719312000

}
```

That confirms the full path works: created, started, scanned, connected, sending.

## Do it with the SDK [​](https://docs.open-wa.org/getting-started/first-session/\#do-it-with-the-sdk "Direct link to Do it with the SDK")

The [`@rmyndharis/openwa`](https://docs.open-wa.org/sdk/overview) JavaScript SDK wraps the same calls. Note the `baseUrl` is the origin without the `/api` prefix — the SDK adds it.

```bash
npm install @rmyndharis/openwa
```

```ts
import { OpenWAClient } from '@rmyndharis/openwa';

const client = new OpenWAClient({

  baseUrl: 'http://localhost:2785',

  apiKey: process.env.API_KEY!,

});

// 1. Create and start

const session = await client.sessions.create({ name: 'my-bot' });

await client.sessions.start(session.id);

// 2. Fetch the QR (render qrCode as an image, then scan)

const { qrCode } = await client.sessions.getQrCode(session.id);

console.log(qrCode); // data:image/png;base64,…

// 3. Poll until ready

let status = 'initializing';

while (status !== 'ready') {

  await new Promise((r) => setTimeout(r, 2000));

  status = (await client.sessions.get(session.id)).status;

}

// 4. Send a test message

const msg = await client.messages.sendText(session.id, {

  chatId: '628123456789@c.us',

  text: 'Hello from OpenWA!',

});

console.log(msg.messageId);
```

## Troubleshooting [​](https://docs.open-wa.org/getting-started/first-session/\#troubleshooting "Direct link to Troubleshooting")

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401 Unauthorized` on every call | Missing, invalid, or out-of-scope `X-API-Key`. | Check the header value and that the key may access this session. See [Authentication](https://docs.open-wa.org/guides/authentication). |
| `403 Forbidden` on create/start/send | Key role is below `operator`. | Use an `operator` or `admin` key. |
| `409 Conflict` on create | A session with that `name` already exists. | Pick a different name, or reuse the existing session's `id`. |
| `400` on the QR call | Engine has not reached `qr_ready`, or the session is already linked. | Wait a moment and retry; or check status with `GET /api/sessions/{id}`. |
| QR expires before you scan | WhatsApp rotates the code every few seconds. | Re-fetch the QR and scan promptly. |
| `400` on send-text | The session is not `ready`, or `chatId` is malformed. | Confirm `status` is `ready` and use `<digits>@c.us` with no `+`. |
| Status reaches `failed` | The link was rejected or the engine errored. | Read `lastError`, then stop and start the session to retry. |

## Next steps [​](https://docs.open-wa.org/getting-started/first-session/\#next-steps "Direct link to Next steps")

- [Sessions guide](https://docs.open-wa.org/guides/sessions) — stop, restart, reconnect, and delete sessions, and run several at once.
- [Sending messages](https://docs.open-wa.org/guides/sending-messages) — media, replies, reactions, locations, and bulk sends.
- [Webhooks](https://docs.open-wa.org/guides/webhooks) — receive incoming messages and status changes in real time.
- [API reference](https://docs.open-wa.org/api-reference) — every endpoint, field, and status code.

[Previous\\
\\
Configuration](https://docs.open-wa.org/getting-started/configuration) [Next\\
\\
Sessions & Multi-Session](https://docs.open-wa.org/guides/sessions)

- [How a session connects](https://docs.open-wa.org/getting-started/first-session/#how-a-session-connects)
- [Option A — connect via the dashboard](https://docs.open-wa.org/getting-started/first-session/#option-a--connect-via-the-dashboard)
- [Option B — connect via the API](https://docs.open-wa.org/getting-started/first-session/#option-b--connect-via-the-api)
  - [1\. Create the session](https://docs.open-wa.org/getting-started/first-session/#1-create-the-session)
  - [2\. Start the session](https://docs.open-wa.org/getting-started/first-session/#2-start-the-session)
  - [3\. Fetch and scan the QR code](https://docs.open-wa.org/getting-started/first-session/#3-fetch-and-scan-the-qr-code)
  - [4\. Confirm it is connected](https://docs.open-wa.org/getting-started/first-session/#4-confirm-it-is-connected)
- [Send a test message](https://docs.open-wa.org/getting-started/first-session/#send-a-test-message)
- [Do it with the SDK](https://docs.open-wa.org/getting-started/first-session/#do-it-with-the-sdk)
- [Troubleshooting](https://docs.open-wa.org/getting-started/first-session/#troubleshooting)
- [Next steps](https://docs.open-wa.org/getting-started/first-session/#next-steps)

Made with ❤ by [Yudhi Armyndharis](https://github.com/rmyndharis) and the OpenWA Community