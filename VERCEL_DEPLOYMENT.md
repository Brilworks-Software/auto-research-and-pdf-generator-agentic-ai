# AI Research System - Vercel Deployment Guide

## Quick Start

### Prerequisites
- GitHub account
- Vercel account (free at vercel.com)
- Google Generative AI API key

### Deployment Steps

#### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/ai-research.git
git push -u origin main
```

#### 2. Deploy to Vercel

**Option A: Via Vercel Dashboard (Easiest)**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Select your GitHub repository
3. Vercel auto-detects settings from `vercel.json`
4. Add environment variables:
   - `GOOGLE_API_KEY`: Your Gemini API key
5. Click "Deploy"

**Option B: Via CLI**
```bash
npm install -g vercel
vercel --prod
```

#### 3. Configure Environment Variables
In Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Add:
   - `GOOGLE_API_KEY` = your Gemini API key
3. Redeploy to apply changes

#### 4. Test Deployment
```bash
# Your app will be live at: https://yourdomain.vercel.app
curl https://yourdomain.vercel.app/api/health
```

## Project Structure

```
├── vercel.json           # Vercel configuration
├── .env.local           # Local dev environment
├── .env.production      # Production environment
├── api/
│   ├── research.js      # Main research endpoint
│   └── health.js        # Health check endpoint
├── client/
│   ├── src/App.jsx      # Updated with env variables
│   ├── package.json
│   └── vite.config.js
└── agents/              # Your research agents
```

## How It Works

1. **Frontend** (React + Vite) builds and deploys to Vercel CDN
2. **Backend API** runs as serverless functions in `/api` folder
3. **Requests flow**: Client → `/api/research` → Manager Agent → Specialists → Report

## Environment Variables

| Variable | Dev | Production |
|----------|-----|------------|
| `VITE_API_URL` | `http://localhost:3001` | `/api` |
| `GOOGLE_API_KEY` | `.env.local` | Vercel secrets |

## Local Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Start backend (Terminal 1)
npm run server

# Start client (Terminal 2)
cd client
npm run dev
```

## Important Notes

⚠️ **Serverless Limitations (Hobby Plan):**
- Memory limited to 2048 MB
- Functions timeout after 60 seconds
- Puppeteer may have issues in serverless (consider web scraping APIs instead)
- Large file uploads are limited

✅ **What Works Well:**
- LLM API calls (Google Generative AI / Gemini)
- Web searches and content fetching
- Data collection and processing
- Report generation

## Troubleshooting

**Build fails?**
- Check `vercel.json` syntax
- Ensure ES modules are used (`"type": "module"` in package.json)
- Check all imports are correct

**API not found?**
- Files in `/api` must be ES modules
- Function names must match routes: `api/research.js` → `/api/research`

**Function too large or slow?**
- Optimize code to reduce bundle size
- Consider breaking large agents into separate smaller functions
- Profile with Vercel Analytics

**Environment variables not loading?**
- Redeploy after adding secrets
- For client: must use `VITE_` prefix for Vite to expose them

## Next Steps

1. ✅ Set up GitHub repository
2. ✅ Connect to Vercel
3. ✅ Add environment variables
4. 🔄 Monitor deployment & test
5. 📊 Check logs in Vercel dashboard

Happy researching! 🚀
