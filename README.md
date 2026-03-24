# Orbit — Personal CRM

A personal CRM that runs entirely on your computer. It connects to your Gmail and Google Calendar to automatically track your relationships, uses AI to summarize conversations and suggest follow-ups, and shows you which contacts are going cold.

**Your data never leaves your machine.** Everything is stored locally — no cloud accounts, no subscriptions.

Built by [Nachiketh Ramesh](https://nachikethramesh.com)

---

## Quick Install (Windows)

> **Just two double-clicks. No terminal needed.**

1. **[Download this repo](https://github.com/NachikethRamesh/Orbit_ProfessionalRelationshipManager/archive/refs/heads/main.zip)** and unzip it (or `git clone`)
2. **Double-click `Install Orbit.bat`** — installs dependencies, runs setup, and builds the app
3. **Double-click `Launch Orbit.bat`** — starts Orbit and opens it in your browser

That's it. `Install Orbit.bat` only needs to run once. After that, just use `Launch Orbit.bat` whenever you want to open Orbit.

---

## Quick Install (macOS / Linux)

Open **Terminal** and run:

```bash
git clone https://github.com/NachikethRamesh/Orbit_ProfessionalRelationshipManager.git
cd Orbit_ProfessionalRelationshipManager
chmod +x install-orbit.sh launch-orbit.sh
./install-orbit.sh
```

Then to launch Orbit anytime:

```bash
./launch-orbit.sh
```

> **Want to double-click instead of using Terminal?** By default, macOS opens `.sh` files in Xcode as text. To fix this:
> 1. Right-click `install-orbit.sh` in Finder
> 2. Click **Get Info**
> 3. Under **Open with**, change from Xcode to **Terminal.app**
> 4. Click **Change All** to apply to all `.sh` files
>
> After that, double-clicking any `.sh` file will run it in Terminal — same as `.bat` on Windows.

---

## Alternative: Command Line (any OS)

```
git clone https://github.com/NachikethRamesh/Orbit_ProfessionalRelationshipManager.git
cd Orbit_ProfessionalRelationshipManager
npm install
node bin/orbit.js
```

---

## First-Time Setup

The first time Orbit launches, it will ask you for a few things:

1. Your name and email
2. Your OpenAI API key ([get one here](https://platform.openai.com/api-keys))
3. Your Google Client ID and Secret (see below)
4. Optionally, an Exa API key for contact enrichment

After that, Orbit opens at `http://localhost:3000` and you're good to go.

## What It Does

- **Pulls in your contacts** from Google — both your address book and people you've emailed
- **Tracks emails and meetings** automatically by syncing with Gmail and Google Calendar
- **Summarizes conversations** so you can quickly recall what you talked about
- **Suggests follow-ups** — reminds you to reach out when relationships go quiet
- **Warmth scores** — see at a glance who you're close with and who's drifting
- **AI chat** — ask questions like "When did I last talk to Sarah?" or "Who works at Acme?"
- **Contact enrichment** — optionally pulls in background info on your contacts

## What You'll Need

- **Node.js** (version 18 or newer) — [download here](https://nodejs.org)
- **An OpenAI API key** — for the AI features ([get one here](https://platform.openai.com/api-keys))
- **A Google Cloud project** — so Orbit can read your Gmail and Calendar (free, setup guide below)

## Setting Up Google Access

Orbit needs permission to read your Gmail and Calendar. Here's how to set that up:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and sign in
2. Click **Select a project** at the top, then **New Project** — give it any name (e.g. "Orbit CRM")
3. Once the project is created, go to **APIs & Services > Library** and enable these three:
   - **Gmail API**
   - **Google Calendar API**
   - **People API**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Under "Authorized redirect URIs", add: `http://localhost:3000/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** — you'll paste these into the Orbit setup wizard

That's it! Once connected, Orbit will pull in your contacts and start syncing.

## Changing Settings Later

All your settings (API keys, etc.) can be changed from the **Settings** page inside Orbit, or by editing the file at `~/.orbit/.env` and restarting.

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
