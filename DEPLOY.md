# Deployment Guide

## Quick Deploy Options

### Option 1: Render (Recommended - Free Tier)
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - `PORT` (Render sets this automatically)
     - `CORS_ORIGIN=https://your-app.onrender.com`
     - `NUM_BOTS=0` (Puppeteer may not work, disable bots initially)
5. Deploy!

### Option 2: Railway
1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables (same as above)
4. Railway auto-detects Node.js and deploys

### Option 3: Fly.io
```bash
# Install flyctl
npm install -g flyctl

# Login
fly auth login

# Launch app
fly launch

# Deploy
fly deploy
```

### Option 4: DigitalOcean/AWS/Azure
- Spin up Ubuntu server
- Install Node.js
- Clone repo, run `npm install && npm start`
- Use PM2 for process management: `npm i -g pm2 && pm2 start server.js`
- Setup Nginx reverse proxy with SSL (Let's Encrypt)

## Important Notes

### 🔒 HTTPS Required
WebRTC requires HTTPS in production. All hosting platforms above provide free SSL certificates.

### 🤖 Bots in Production
**Puppeteer bots may not work** on serverless/container platforms because:
- Requires Chrome/Chromium (large binary)
- Needs extra dependencies
- May hit memory limits

**Solutions:**
1. **Disable bots initially** (`NUM_BOTS=0`)
2. **Use VPS** (DigitalOcean, AWS EC2) where you can install Chrome
3. **Run bots separately** on a different server and connect via websockets

### 🔧 Environment Variables for Production
Create `.env` file or set in hosting dashboard:
```
PORT=3000
CORS_ORIGIN=https://yourdomain.com
OLLAMA_URL=http://localhost:11434  # Or external Ollama server
OLLAMA_TIMEOUT=5000
NUM_BOTS=0  # Start with 0, enable after testing
CLEANUP_INTERVAL=60000
```

### 📱 TURN Server for Mobile
You may need a TURN server for mobile connections behind NAT. Update WebRTC config in `public/client.js`:
```javascript
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { 
    urls: 'turn:yourturnserver.com:3478',
    username: 'user',
    credential: 'pass'
  }
]
```

Free TURN options: [Metered.ca](https://www.metered.ca/tools/openrelay/), [Twilio](https://www.twilio.com/stun-turn)

## Testing Deployment
1. Deploy server
2. Open `https://your-domain.com` on mobile
3. Allow camera/mic permissions
4. Click "Start" - should say "Waiting for partner..."
5. Open second tab/device and connect

## Common Issues

**"Can't access camera"** → Need HTTPS (check URL has `https://`)

**Bots crash** → Set `NUM_BOTS=0` in production

**Connection timeout** → May need TURN server for NAT traversal

**CORS errors** → Set `CORS_ORIGIN` to your domain
