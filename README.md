# Orbit — Professional Relationship Manager

A professional relationship manager that runs entirely on your computer. It connects to your Gmail and Google Calendar to automatically track your relationships, uses AI to summarize conversations and suggest follow-ups, and shows you which contacts are going cold.

**Your data never leaves your machine.** Everything is stored locally — no cloud accounts, no subscriptions.

Built by [Nachiketh Ramesh](https://nachikethramesh.com)

---

## Quick Install (Windows)

> **One double-click. No terminal needed.**

1. **[Download this repo](https://github.com/NachikethRamesh/Orbit_ProfessionalRelationshipManager/archive/refs/heads/main.zip)** and unzip it (or `git clone`)
2. **Double-click `Launcher.bat`**

That's it. The first time you run it, Launcher.bat will automatically install dependencies, set up the database, build the app, and then launch Orbit. Every time after that, it just launches Orbit instantly.

> **No Node.js required.** The launcher will automatically download a portable copy if you don't have it or if your installed version isn't compatible. Orbit supports Node.js 18, 20, or 22 (LTS versions only).

---

## Quick Install (macOS)

> **Requires [Node.js](https://nodejs.org/) 18, 20, or 22 (LTS).** Install it via the official installer or with Homebrew: `brew install node@22`

1. **[Download this repo](https://github.com/NachikethRamesh/Orbit_ProfessionalRelationshipManager/archive/refs/heads/main.zip)** and unzip it
2. **Open Terminal** in the unzipped folder (right-click the folder in Finder → *New Terminal at Folder*)
3. **Install dependencies and run setup:**
   ```
   npm install
   node bin/setup-only.js
   npm run build
   ```
4. **Launch Orbit:**
   ```
   node bin/orbit.js
   ```

That's it. Steps 1–3 only need to run once. After that, just open Terminal in the folder and run `node bin/orbit.js` to start Orbit.

---

## First-Time Setup

After installing and launching Orbit, open it in your browser at `http://localhost:3000` and go to **Settings** to add your API keys:

1. Your **OpenAI API key** ([get one here](https://platform.openai.com/api-keys))
2. Your **Google Client ID** and **Client Secret** (see below)
3. Optionally, an **Exa API key** for contact enrichment

That's it — save your keys and you're good to go.

## What It Does

- **Pulls in your contacts** from Google — both your address book and people you've emailed
- **Tracks emails and meetings** automatically by syncing with Gmail and Google Calendar
- **Summarizes conversations** so you can quickly recall what you talked about
- **Suggests follow-ups** — reminds you to reach out when relationships go quiet
- **Warmth scores** — see at a glance who you're close with and who's drifting
- **AI chat with actions** — ask questions like "When did I last talk to Sarah?" or tell it to "Create a reminder to follow up with John next Monday" — the chatbot can create, update, and delete both reminders and contacts directly
- **Contact enrichment** — optionally pulls in background info on your contacts (with built-in rate limiting to avoid API throttling)
- **Dashboard analysis** — one-click Analyze syncs your email, summarizes new interactions, generates action items, and updates warmth scores
- **Bulk reminder management** — select and dismiss multiple reminders at once from the Reminders page

## What You'll Need

- **An OpenAI API key** — for the AI features ([get one here](https://platform.openai.com/api-keys))
- **A Google Cloud project** — so Orbit can read your Gmail and Calendar (free, setup guide below)

## Setting Up Google Access

Orbit needs permission to read your Gmail and Calendar. Here's how to set that up:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and sign in
2. Click **Select a project** at the top, then **New Project** — give it any name (e.g. "Orbit PRM")
3. Once the project is created, go to **APIs & Services > Library** and enable these three:
   - **Gmail API**
   - **Google Calendar API**
   - **People API**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Under "Authorized redirect URIs", add: `http://localhost:3000/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** — you'll paste these into the **Settings** page in Orbit

That's it! Once connected, Orbit will pull in your contacts and start syncing.

## Settings Reference

All settings are managed from the **Settings** page inside Orbit. You can also edit `~/.orbit/.env` directly and restart.

| Setting | Required? | What it's for |
|---------|-----------|---------------|
| OpenAI API Key | Yes | Powers AI summaries, suggestions, and chat |
| Google Client ID | Yes | Lets Orbit connect to your Google account |
| Google Client Secret | Yes | Goes with the Client ID above |
| Google Redirect URI | Auto-filled | Don't change this — it's set automatically |
| Exa API Key | Optional | Enriches contacts with background info from the web |
| Encryption Key | Auto-generated | Protects your stored Google tokens — don't change it |

## License

MIT
