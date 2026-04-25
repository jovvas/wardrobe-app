# Wardrobe App — Setup Guide

Follow these steps in order. Each section links to where you need to go.
Estimated time: ~30 minutes.

---

## 1. Create a Supabase account & project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up (free).
2. Create a new project:
   - **Project name:** wardrobe-app (or anything you like)
   - **Database password:** choose something strong and save it somewhere safe
   - **Region:** pick the one closest to you (e.g. EU West for Cyprus)
3. Wait ~1 min for the project to be ready.
4. In the left sidebar → **SQL Editor** → paste the entire contents of `schema.sql` → click **Run**.
   - You should see green "Success" messages. This creates your two tables and the photo storage bucket.
5. Go to **Settings → API**:
   - Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
   - Copy your **anon / public** key (the long string under "Project API keys")

---

## 2. Create a Vercel account

1. Go to [vercel.com](https://vercel.com) → **Sign Up** → choose **Continue with GitHub** (easiest).
2. Authorise Vercel to access your GitHub account.

---

## 3. Push the project to GitHub

In a terminal, navigate to this folder and run:

```bash
git init
git add .
git commit -m "Initial wardrobe app scaffold"
git branch -M main
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/wardrobe-app.git
git push -u origin main
```

(Or use GitHub Desktop if you prefer a visual tool.)

---

## 4. Deploy to Vercel

1. In Vercel → **Add New Project** → import your `wardrobe-app` GitHub repo.
2. Vercel will auto-detect the Vite framework. The build settings should be correct automatically.
3. Before clicking **Deploy**, go to **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `ANTHROPIC_API_KEY` | your Anthropic API key (starts with `sk-ant-`) |

4. Click **Deploy**. In ~1 minute you'll get a live URL like `wardrobe-app-xxx.vercel.app`.

---

## 5. Add app icons (optional but nice for iPhone)

The app works without icons, but if you want a proper icon on your home screen:

1. Create (or find) two PNG images:
   - `icon-192.png` — 192 × 192 px
   - `icon-512.png` — 512 × 512 px
2. Drop them into the `public/` folder.
3. Commit and push — Vercel will redeploy automatically.

A quick way: use [favicon.io](https://favicon.io) or [maskable.app](https://maskable.app) to generate icons.

---

## 6. Pin to your iPhone home screen

1. Open your Vercel URL in **Safari** on your iPhone.
2. Tap the **Share** button (the square with an arrow) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. Give it the name "Wardrobe" → tap **Add**.

The app will now open full-screen like a native app.

---

## 7. Local development (optional)

If you ever want to run the app locally to test changes before deploying:

```bash
# Install dependencies (first time only)
npm install

# Install Vercel CLI (first time only)
npm install -g vercel

# Copy env template and fill in your values
cp .env.example .env.local

# Start local dev server (includes API function emulation)
vercel dev
```

Then open `http://localhost:3000` in your browser.

> **Note:** The serverless function (`/api/suggest`) only works locally if you run `vercel dev`.
> Plain `npm run dev` will serve the frontend but the outfit suggestion feature will fail locally.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Wardrobe screen shows error | Supabase env vars wrong | Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel dashboard |
| Photos fail to upload | Storage bucket missing or wrong policy | Re-run schema.sql in Supabase SQL Editor |
| Outfit suggestions fail | Anthropic key missing | Check ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables |
| App looks wrong on iPhone | Pinned from Chrome not Safari | Delete and re-add from Safari |

---

## Making changes later

1. Edit files in this folder.
2. `git add . && git commit -m "describe your change" && git push`
3. Vercel picks up the push and redeploys automatically (usually under 1 minute).
