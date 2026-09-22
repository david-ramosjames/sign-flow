# Sign Flow Slack bot — setup

Send intake contracts from Slack with `@Sign Flow send contract` or `/send-contract`.

## 1. Create the Slack app

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
2. Name it **Sign Flow** (or similar) and pick your workspace.

## 2. Bot token scopes

**OAuth & Permissions** → Bot Token Scopes — add:

- `app_mentions:read`
- `chat:write`
- `commands`
- `users:read` (optional)

Install the app to the workspace, then copy the **Bot User OAuth Token** (`xoxb-…`).

## 3. Signing secret

**Basic Information** → **Signing Secret** → copy it.

## 4. Request URLs (use your production origin)

Replace `https://YOUR_APP` with your Sign Flow URL (e.g. `https://rjl-signflow.vercel.app`).

| Slack feature | URL | Notes |
|---|---|---|
| **Slash Commands** → Create `/send-contract` | `https://YOUR_APP/api/slack/commands` | Not for Event Subscriptions |
| **Interactivity & Shortcuts** → Request URL | `https://YOUR_APP/api/slack/interactions` | Modal submit + button |
| **Event Subscriptions** → Request URL | `https://YOUR_APP/api/slack/events` | Must be `/events` (handles Slack’s `challenge`) |

**Common mistake:** Putting `/api/slack/commands` under Event Subscriptions fails URL verification. Use **`/api/slack/events`** there.

**Turn Socket Mode OFF.** Sign Flow runs on Vercel (HTTP callbacks). Socket Mode hides the Request URL fields and won’t work with this setup.

1. **Socket Mode** → toggle **Off** (and Save)
2. **Interactivity & Shortcuts** → On → Request URL = `https://YOUR_APP/api/slack/interactions`
3. **Event Subscriptions** → On → Request URL = `https://YOUR_APP/api/slack/events`
4. **Slash Commands** → `/send-contract` → `https://YOUR_APP/api/slack/commands`

Before verifying URLs:

1. Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` in Vercel (Production)
2. Redeploy so those env vars are live
3. Paste the URLs above and Retry / Verify

Event Subscriptions → Subscribe to bot events:

- `app_mention`

## 5. Env vars (Vercel / `.env`)

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_DEFAULT_FIRM_ID=ramos-james
SIGNFLOW_EMAIL_PUBLIC_ORIGIN=https://YOUR_APP
```

Redeploy after setting env vars.

## 6. Invite the bot

In each channel where staff will send contracts:

```
/invite @Sign Flow
```

## 7. How staff use it

**@ mention (recommended for your team)**  
1. `@Sign Flow send contract` (works in **threads** too — include the words *send contract*)  
2. Tap **Send contract** on the bot’s reply in that thread (visible message with a button)  
3. Fill the modal (client, phone, template, date of loss)  
4. Submit — SMS goes out; optional email if checked  

If @mention does nothing: confirm Event Subscriptions includes `app_mention`, Interactivity URL is saved, the bot is `/invite`d in that channel, and Vercel has `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET`. Try `/send-contract` in the same channel to confirm the bot token works. In Vercel logs, open `POST /api/slack/events` and look for `[slack/events]` lines (including Slack retry / postMessage errors).  

**Slash command**  
`/send-contract` → modal opens immediately  

## Email From (clients vs team)

Set a **client-facing** mailbox separately from team completion mail:

```
GMAIL_SIGNING_SEND_AS_EMAIL=contracts@ramosjames.com
GMAIL_SEND_AS_EMAIL=intake@ramosjames.com
```

Both Workspace users need domain-wide delegation for the same service account (`gmail.send` scope).
