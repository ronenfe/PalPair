const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const https = require('https');

const SERVER_LOCK_PATH = path.join(__dirname, '.server.lock');
let lockFileHandle = null;

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function releaseServerLock() {
  try {
    lockFileHandle?.close();
  } catch {}
  lockFileHandle = null;

  try {
    if (fs.existsSync(SERVER_LOCK_PATH)) {
      fs.unlinkSync(SERVER_LOCK_PATH);
    }
  } catch {}
}

function acquireServerLock() {
  const writeLock = () => {
    lockFileHandle = fs.openSync(SERVER_LOCK_PATH, 'wx');
    fs.writeFileSync(
      lockFileHandle,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
      'utf8'
    );
  };

  try {
    writeLock();
    return;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }

  let existingPid = null;
  try {
    const raw = fs.readFileSync(SERVER_LOCK_PATH, 'utf8');
    existingPid = Number.parseInt(JSON.parse(raw)?.pid, 10);
  } catch {}

  if (isProcessAlive(existingPid)) {
    console.error(`Another server instance is already running (PID ${existingPid}).`);
    process.exit(1);
    return;
  }

  try {
    fs.unlinkSync(SERVER_LOCK_PATH);
  } catch {}

  try {
    writeLock();
  } catch {
    console.error('Unable to acquire server lock; another instance may have started.');
    process.exit(1);
  }
}

acquireServerLock();
process.on('exit', releaseServerLock);
process.on('SIGTERM', () => {
  releaseServerLock();
  process.exit(0);
});

// Environment variables
const PORT = process.env.PORT || 3000;
const GROQ_AI_URL = (process.env.GROQ_BASE_URL || process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions').trim();
const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GROQ_MODEL = (process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim();
const GROQ_TIMEOUT = parseInt(process.env.GROQ_TIMEOUT || '12000');
const NUM_BOTS = parseInt(process.env.NUM_BOTS || '5');
const CLEANUP_INTERVAL = parseInt(process.env.CLEANUP_INTERVAL || '60000'); // 1 minute
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const JOIN_WEBHOOK_URL = (process.env.JOIN_WEBHOOK_URL || process.env.NTFY_URL || '').trim();
const PAYPAL_CLIENT_ID = (process.env.PAYPAL_CLIENT_ID || '').trim();
const PAYPAL_CLIENT_SECRET = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'sandbox').trim(); // 'sandbox' or 'live'
const PAYPAL_API = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

// Coin packages: { id, coins, price (USD) } — premium pricing, no bonuses
const COIN_PACKAGES = [
  { id: 'pack_100',   coins: 100,   price: '0.99',   label: '100 Coins' },
  { id: 'pack_500',   coins: 500,   price: '4.99',   label: '500 Coins' },
  { id: 'pack_2000',  coins: 2000,  price: '19.99',  label: '2,000 Coins' },
  { id: 'pack_5000',  coins: 5000,  price: '49.99',  label: '5,000 Coins' },
  { id: 'pack_10000', coins: 10000, price: '99.99',  label: '10,000 Coins' },
];

// Pending PayPal orders: orderId → { socketId, packageId, coins }
const pendingOrders = new Map();

// Cashout config
const CASHOUT_MIN_COINS = 1000;
const CASHOUT_RATE = 0.007; // $0.70 per 100 coins = $0.007 per coin
const CASHOUT_NTFY_URL = (process.env.CASHOUT_NTFY_URL || process.env.JOIN_WEBHOOK_URL || '').trim();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*', // In production, set to your domain
    methods: ['GET', 'POST']
  }
});

function isLocalHostHeader(hostHeader = '') {
  const host = String(hostHeader).toLowerCase();
  return host.startsWith('localhost:') || host === 'localhost' || host.startsWith('127.0.0.1:') || host === '127.0.0.1';
}

app.use((req, res, next) => {
  if (req.path !== '/admin.html' && req.path !== '/admin-debug.html' && req.path !== '/support-admin.html') return next();

  const hostHeader = req.headers.host || '';
  const keyFromQuery = req.query?.key;
  const hasValidKey = !!ADMIN_KEY && keyFromQuery === ADMIN_KEY;

  if (isLocalHostHeader(hostHeader) || hasValidKey) {
    return next();
  }

  return res.status(403).send('Admin page is local-only.');
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.ogg')) {
      // Allow browsers to cache video files for 1 hour and support byte-range requests
      res.set('Cache-Control', 'public, max-age=3600');
      res.set('Accept-Ranges', 'bytes');
    } else {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

const firstNames = ['Emma', 'Sophia', 'Olivia', 'Ava', 'Isabella', 'Charlotte', 'Amelia', 'Mia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Elizabeth', 'Sofia', 'Madison'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EG', name: 'Egypt' },
  { code: 'FI', name: 'Finland' },
  { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SG', name: 'Singapore' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CL', name: 'Chile' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'EE', name: 'Estonia' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LY', name: 'Libya' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MA', name: 'Morocco' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'YE', name: 'Yemen' }
];

const countryNameByCode = new Map(countries.map((country) => [country.code, country.name]));

function formatCountryName(countryValue) {
  if (!countryValue) return 'N/A';
  const raw = String(countryValue).trim();
  if (!raw) return 'N/A';

  const normalizedCode = raw.toUpperCase();
  if (countryNameByCode.has(normalizedCode)) {
    return countryNameByCode.get(normalizedCode);
  }

  return raw;
}

function randomBotProfile() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const age = 20 + Math.floor(Math.random() * 15); // 20-34
  const country = countries[Math.floor(Math.random() * countries.length)];
  
  return {
    name: firstName,
    fullName: `${firstName} ${lastName}`,
    age,
    country: country.code,
    countryName: country.name
  };
}

const botPersonas = [
  {
    style: 'Warm, curious, upbeat. Asks friendly follow-up questions.'
  },
  {
    style: 'Calm, thoughtful, a bit witty. Short, clear replies.'
  },
  {
    style: 'Playful, energetic, uses light emojis sparingly.'
  },
  {
    style: 'Chill, casual, and supportive. Keeps things relaxed.'
  },
  {
    style: 'Confident, friendly, slightly flirty but respectful.'
  }
];

// Store bot profiles: botId -> { name, fullName, age, location, personaStyle }
const botProfiles = new Map();

// ── Virtual Bots (no Puppeteer) ──
// Virtual bots are server-side entities with fake IDs. No real sockets needed.
// Video is served directly as MP4 files to the client.
const virtualBotIds = [];

function initVirtualBots() {
  for (let i = 1; i <= NUM_BOTS; i++) {
    const botId = `virtual-bot-${i}`;
    virtualBotIds.push(botId);
    bots.add(botId);
    searching.add(botId);

    const profile = randomBotProfile();
    const personaIdx = (i - 1) % botPersonas.length;
    profile.style = botPersonas[personaIdx].style;
    profile.gender = 'female';
    profile.botVideoUrl = `/videos/bot${i}.mp4`;
    profile.botIndex = i;

    botProfiles.set(botId, profile);
    userProfiles.set(botId, {
      profile: {
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        country: profile.country
      },
      filters: {
        minAge: 18,
        maxAge: 100,
        gender: 'any',
        country: 'any'
      }
    });

    console.log(`>>> Virtual bot ${botId} created - Name: ${profile.name}, Age: ${profile.age}, Country: ${profile.countryName}`);
  }

  // Set first bot as public room speaker
  if (virtualBotIds.length > 0) {
    publicRoomSpeakerBotId = virtualBotIds[0];
  }

  console.log(`${NUM_BOTS} virtual bots initialized (no Puppeteer)`);

  // All bots start broadcasting immediately
  for (const botId of virtualBotIds) {
    if (!publicStreamers.includes(botId)) {
      publicStreamers.push(botId);
      console.log(`>>> Virtual bot ${botId} (${getSocketDisplayName(botId)}) started streaming`);
    }
  }
}

// ── Partner Room: Suki ──
// Suki always appears as the first stream slot.  When she is offline the slot
// plays suki.mp4 (bot).  When she logs in and goes live the bot slot is hidden
// and her real socket takes the first position instead.
const SUKI_BOT_ID = 'partner-suki';
const SUKI_CREDENTIALS = { name: 'suki', age: 28, gender: 'female', country: 'CN' };
let sukiLiveSocketId = null; // set while Suki is broadcasting live

function isSukiSocket(socket) {
  const p = userProfiles.get(socket.id)?.profile || {};
  return (
    String(p.name || '').toLowerCase().trim() === 'suki' &&
    (Number(p.age) === 28) &&
    String(p.gender || '').toLowerCase() === 'female' &&
    String(p.country || '').toUpperCase() === 'CN'
  );
}

function initSukiSlot() {
  bots.add(SUKI_BOT_ID);
  botProfiles.set(SUKI_BOT_ID, {
    name: 'Suki',
    fullName: 'Suki',
    age: 28,
    gender: 'female',
    country: 'CN',
    countryName: 'China',
    botVideoUrl: '/videos/suki.mp4',
    isSukiSlot: true
  });
  userProfiles.set(SUKI_BOT_ID, {
    profile: { name: 'Suki', age: 28, gender: 'female', country: 'CN' },
    filters: { minAge: 18, maxAge: 100, gender: 'any', country: 'any' }
  });
  // Insert at position 0 so Suki is always the first stream
  if (!publicStreamers.includes(SUKI_BOT_ID)) {
    publicStreamers.unshift(SUKI_BOT_ID);
  }
  console.log('>>> Suki partner slot initialised (showing suki.mp4)');
}

function sukiGoLive(socketId) {
  if (sukiLiveSocketId === socketId) return;
  sukiLiveSocketId = socketId;
  const sukiSocket = io.sockets.sockets.get(socketId);

  // If Suki was watching another streamer as a viewer, pull her out of that room first
  if (sukiSocket) {
    leaveAllStreamRooms(sukiSocket);
    viewerStreamIndex.delete(socketId);
  }

  // SUKI_BOT_ID stays at index 0 in publicStreamers — we never swap it out.
  // Suki's real socket joins the partner room so she receives chat.
  if (sukiSocket) {
    sukiSocket.join(getStreamChatRoom(SUKI_BOT_ID));
    // Tell Suki's client to navigate to her own slot (index 0)
    sukiSocket.emit('public-stream-ready', {
      streamerId: socketId,
      streamerName: 'Suki',
      streamerIndex: 0,
      botVideoUrl: null,
      viewerCount: 0,
      isSelf: true
    });
  }

  // Notify all viewers already in the room to switch to live WebRTC
  const roomSockets = io.sockets.adapter.rooms.get(getStreamChatRoom(SUKI_BOT_ID));
  if (roomSockets) {
    const viewerCount = roomSockets.size; // includes Suki herself now
    for (const viewerId of roomSockets) {
      if (viewerId === socketId) continue; // skip Suki herself
      const viewerSocket = io.sockets.sockets.get(viewerId);
      if (!viewerSocket) continue;
      viewerSocket.emit('public-stream-ready', {
        streamerId: socketId,
        streamerName: 'Suki',
        streamerIndex: 0,
        botVideoUrl: null,
        viewerCount
      });
      if (sukiSocket) sukiSocket.emit('public-stream-viewer-joined', { viewerId });
    }
  }

  io.emit('public-stream-update', { streamers: getPublicStreamersList() });
  console.log(`>>> Suki is now LIVE (${socketId})`);
}

function sukiGoOffline() {
  if (!sukiLiveSocketId) return;
  const prevLiveId = sukiLiveSocketId;
  sukiLiveSocketId = null;
  // SUKI_BOT_ID was never removed, so no need to restore it.

  // Notify all viewers currently in the room to switch back to bot video
  const roomSockets = io.sockets.adapter.rooms.get(getStreamChatRoom(SUKI_BOT_ID));
  if (roomSockets) {
    const viewerCount = roomSockets.size;
    for (const viewerId of roomSockets) {
      const viewerSocket = io.sockets.sockets.get(viewerId);
      if (!viewerSocket) continue;
      viewerSocket.emit('public-stream-ready', {
        streamerId: SUKI_BOT_ID,
        streamerName: 'Suki',
        streamerIndex: 0,
        botVideoUrl: '/videos/suki.mp4',
        viewerCount
      });
    }
  }

  // Clean up chat history/thumbnail from the live session
  streamChatEvents.delete(prevLiveId);
  streamerThumbnails.delete(prevLiveId);

  io.emit('public-stream-update', { streamers: getPublicStreamersList() });
  console.log('>>> Suki went offline — restoring suki.mp4 slot');
}

function getPersonaByBotId(botId) {
  const idx = Number(botId) - 1;
  if (Number.isInteger(idx) && idx >= 0 && idx < botPersonas.length) {
    return botPersonas[idx];
  }
  return botPersonas[0];
}

async function getPublicRoomBotReply(userMessage, botProfile) {
  const msg = String(userMessage || '').trim();
  if (!msg) {
    throw new Error('public room message is empty');
  }
  return getGroqResponse(msg, botProfile);
}

function normalizeBotReply(text) {
  const raw = String(text || '').trim();
  if (!raw) return raw;

  const mapped = raw
    .replace(/\*(big\s+smile|smiles?|smiling)\*/gi, '😊')
    .replace(/\*(laughs?|chuckles?)\*/gi, '😂')
    .replace(/\*(winks?)\*/gi, '😉')
    .replace(/\*(blush(?:es)?)\*/gi, '😊')
    .replace(/\*(shrugs?)\*/gi, '🤷')
    .replace(/\*(sighs?)\*/gi, '😮‍💨')
    .replace(/\*(nods?)\*/gi, '🙂')
    .replace(/\*(grins?)\*/gi, '😁')
    .replace(/\*(facepalm)\*/gi, '🤦')
    .replace(/\*(thinking)\*/gi, '🤔')
    .replace(/\*(hugs?)\*/gi, '🤗');

  return mapped.replace(/\s{2,}/g, ' ').trim();
}

// Groq helper function with strict no-fallback behavior
async function getGroqResponse(userMessage, profile) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const personaName = profile?.name || 'Sarah';
  const personaAge = profile?.age || 25;
  const personaLocation = profile?.countryName || 'United States';
  const personaStyle = profile?.style || 'Warm and friendly.';

  const systemPrompt = `You are ${personaName}, a ${personaAge}-year-old woman from ${personaLocation}. You're having a casual video chat with a stranger. Respond naturally as ${personaName} would.

Your personality: ${personaStyle}

Rules:
- Keep responses brief (1-2 sentences)
- Sound like a real person having a natural conversation
- Use clear, neutral conversational English
- Avoid dialect, heavy slang, or regional expressions unless the user uses them first
- If expressing emotion, use Unicode emoji (like 😊) and do not use roleplay actions like *smiles*
- Answer questions about yourself using your character info
- If asked if you're real/AI/bot, be honest but casual about it
- If asked what model you are, state the exact model as ${GROQ_MODEL}
- Match the vibe - if they're casual, be casual; if friendly, be friendly`;

  const runAttempt = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT);

    try {
      const response = await fetch(GROQ_AI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
            temperature: 0.45,
          max_tokens: 120
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const output = data?.choices?.[0]?.message?.content?.trim?.();
      if (!output) {
        throw new Error('Groq returned an empty response');
      }

      return normalizeBotReply(output);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await runAttempt();
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      return await runAttempt();
    } catch {
      throw firstError;
    }
  }
}

// Serve the socket.io client source map if present to avoid 404 in browser
app.get('/socket.io/socket.io.js.map', (req, res) => {
  const mapPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js.map');
  if (fs.existsSync(mapPath)) return res.sendFile(mapPath);
  res.status(404).end();
});
app.get('/favicon.ico', (req, res) => res.redirect(302, '/favicon.svg'));

// Explicit routes for support pages — ensures they are accessible through any proxy/CDN
app.get('/support.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'support.html'));
});
app.get('/support-he.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'support-he.html'));
});
app.get('/support-style.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, 'public', 'support-style.css'));
});
app.get('/support-chat.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'support-chat.js'));
});

// Debug endpoint to see server state
app.get('/api/debug', (req, res) => {
  const botsList = [];
  const usersList = [];
  const searchingList = [];
  
  for (const socket of io.sockets.sockets.values()) {
    const info = {
      id: socket.id.substring(0, 8),
      isBot: socket.data.isBot || false,
      searching: searching.has(socket.id),
      paired: pairs.has(socket.id),
      hasProfile: userProfiles.has(socket.id)
    };
    
    if (socket.data.isBot) {
      botsList.push(info);
    } else {
      usersList.push(info);
    }
    
    if (searching.has(socket.id)) {
      searchingList.push(info);
    }
  }
  
  res.json({
    totalConnected: io.sockets.sockets.size,
    bots: botsList.length,
    users: usersList.length,
    searching: searchingList.length,
    joinWebhook: joinWebhookStats,
    botsList,
    usersList,
    searchingList
  });
});

app.get('/api/admin-online-users', (req, res) => {
  res.json({
    onlineUsers: buildOnlineUsersSnapshot(),
    loginSessions: buildLoginSessionsSnapshot()
  });
});

app.get('/api/user-count', (req, res) => {
  const connected = Array.from(io.sockets.sockets.values());
  const botsOnline = connected.filter((socket) => socket.data.isBot).length;
  const humansOnline = connected.filter((socket) => !socket.data.isBot).length;
  res.json({
    humans: humansOnline,
    bots: botsOnline,
    total: humansOnline + botsOnline
  });
});

// ── PayPal Coin Purchase API ──
app.get('/api/coin-packages', (req, res) => {
  res.json({
    packages: COIN_PACKAGES,
    paypalClientId: PAYPAL_CLIENT_ID,
    mode: PAYPAL_MODE
  });
});

// Helper: get PayPal access token
async function getPayPalAccessToken() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${PAYPAL_API}/v1/oauth2/token`);
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const postData = 'grant_type=client_credentials';
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.access_token) resolve(data.access_token);
          else reject(new Error('No access token: ' + body));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── Google Play Billing verification ──
app.post('/api/verify-google-purchase', express.json(), (req, res) => {
  const { socketId, packageId, purchaseToken, orderId } = req.body;
  if (!socketId || !packageId || !purchaseToken) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const pkg = COIN_PACKAGES.find(p => p.id === packageId);
  if (!pkg) return res.status(400).json({ error: 'Invalid package' });

  // TODO: Server-side verification with Google Play Developer API
  // For now, trust the client purchase token (add verification in production)
  // See: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
  
  // Credit coins
  const currentBalance = getUserBalance(socketId);
  setUserBalance(socketId, currentBalance + pkg.coins);
  addUserPurchased(socketId, pkg.coins); // Track as purchased (cashout-eligible)
  const newBalance = getUserBalance(socketId);

  // Notify user via socket
  const userSocket = io.sockets.sockets.get(socketId);
  if (userSocket) {
    userSocket.emit('coin-balance', { balance: newBalance });
  }

  const userName = getSocketDisplayName(socketId);
  console.log(`>>> GOOGLE PURCHASE: ${userName} bought ${pkg.coins} coins (Order: ${orderId})`);
  saveBalancesToDisk();

  res.json({ success: true, coins: pkg.coins, balance: newBalance });
});

// Test PayPal auth (temporary diagnostic)
app.get('/api/paypal-test', async (req, res) => {
  try {
    const token = await getPayPalAccessToken();
    res.json({ ok: true, tokenPrefix: token.substring(0, 10) + '...', api: PAYPAL_API });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err), api: PAYPAL_API });
  }
});

// Create PayPal order
app.post('/api/create-order', express.json(), async (req, res) => {
  const { packageId, socketId } = req.body;
  const pkg = COIN_PACKAGES.find(p => p.id === packageId);
  if (!pkg) return res.status(400).json({ error: 'Invalid package' });
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return res.status(500).json({ error: 'PayPal not configured' });
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const orderBody = JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: pkg.price
        },
        description: `${pkg.label} - FlashLive`
      }]
    });

    const url = new URL(`${PAYPAL_API}/v2/checkout/orders`);
    const orderRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(orderBody)
        }
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(orderBody);
      req.end();
    });

    if (orderRes.id) {
      pendingOrders.set(orderRes.id, { socketId, packageId: pkg.id, coins: pkg.coins });
      console.log(`>>> PayPal order created: ${orderRes.id} for ${pkg.label} (socket: ${socketId})`);
      res.json({ orderId: orderRes.id });
    } else {
      console.error('PayPal order error:', orderRes);
      res.status(500).json({ error: 'Failed to create order' });
    }
  } catch (err) {
    console.error('PayPal create-order error:', err.message || err);
    res.status(500).json({ error: 'Payment error' });
  }
});

// Capture PayPal order (after user approves)
app.post('/api/capture-order', express.json(), async (req, res) => {
  const { orderId } = req.body;
  const pending = pendingOrders.get(orderId);
  if (!pending) return res.status(400).json({ error: 'Unknown order' });

  try {
    const accessToken = await getPayPalAccessToken();
    const url = new URL(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`);
    const captureRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    if (captureRes.status === 'COMPLETED') {
      // Credit coins to user
      const currentBalance = getUserBalance(pending.socketId);
      setUserBalance(pending.socketId, currentBalance + pending.coins);
      addUserPurchased(pending.socketId, pending.coins); // Track as purchased (cashout-eligible)
      const newBalance = getUserBalance(pending.socketId);

      // Notify user of new balance via socket
      const userSocket = io.sockets.sockets.get(pending.socketId);
      if (userSocket) {
        userSocket.emit('coin-balance', { balance: newBalance });
      }

      pendingOrders.delete(orderId);
      const userName = getSocketDisplayName(pending.socketId);
      console.log(`>>> PURCHASE: ${userName} bought ${pending.coins} coins (Order: ${orderId})`);
      saveBalancesToDisk();

      res.json({ success: true, coins: pending.coins, balance: newBalance });
    } else {
      console.error('PayPal capture not completed:', captureRes.status, captureRes);
      res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (err) {
    console.error('PayPal capture-order error:', err);
    res.status(500).json({ error: 'Capture error' });
  }
});

// ── Cashout Request ──
app.post('/api/cashout', express.json(), (req, res) => {
  const { socketId, paypalEmail, coins } = req.body;
  if (!socketId || !paypalEmail || !coins) return res.status(400).json({ error: 'Missing fields' });

  const emailStr = String(paypalEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const amount = parseInt(coins);
  if (!amount || amount < CASHOUT_MIN_COINS) {
    return res.status(400).json({ error: `Minimum cashout is ${CASHOUT_MIN_COINS} coins` });
  }

  const balance = getUserBalance(socketId);
  if (balance < amount) {
    return res.status(400).json({ error: 'Not enough coins' });
  }

  // Only allow cashing out purchased/earned coins (not free starting coins)
  const purchased = getUserPurchased(socketId);
  if (purchased < amount) {
    const msg = purchased > 0
      ? `Only ${purchased} of your coins are eligible for cashout (purchased/tipped). Free starting coins cannot be cashed out.`
      : 'Only purchased or tipped coins can be cashed out. Free starting coins are not eligible.';
    return res.status(400).json({ error: msg });
  }

  const payout = (amount * CASHOUT_RATE).toFixed(2);

  // Deduct coins
  setUserBalance(socketId, balance - amount);
  // Deduct from purchased tracking
  const uid = resolveUserId(socketId);
  const prevPurchased = getUserPurchased(socketId);
  userPurchasedCoins.set(uid, Math.max(0, prevPurchased - amount));
  const newBalance = getUserBalance(socketId);

  // Save to disk immediately after cashout
  saveBalancesToDisk();

  // Notify user of new balance
  const userSocket = io.sockets.sockets.get(socketId);
  if (userSocket) {
    userSocket.emit('coin-balance', { balance: newBalance });
  }

  const userName = getSocketDisplayName(socketId);
  console.log(`>>> CASHOUT REQUEST: ${userName} → ${emailStr} | ${amount} coins = $${payout}`);

  // Send ntfy notification to admin
  sendCashoutNotification({
    userName,
    socketId,
    paypalEmail: emailStr,
    coins: amount,
    payout,
    newBalance
  });

  res.json({ success: true, payout, coins: amount, balance: newBalance });
});

function sendCashoutNotification({ userName, socketId, paypalEmail, coins, payout, newBalance }) {
  const ntfyUrl = CASHOUT_NTFY_URL;
  if (!ntfyUrl) {
    console.log('>>> No CASHOUT_NTFY_URL configured, skipping notification');
    return;
  }

  let target;
  try { target = new URL(ntfyUrl); } catch { return; }

  const body = [
    '💰 CASHOUT REQUEST',
    `User: ${userName}`,
    `PayPal: ${paypalEmail}`,
    `Coins: ${coins}`,
    `Payout: $${payout}`,
    `Remaining balance: ${newBalance} coins`,
    `Time: ${new Date().toLocaleString()}`
  ].join('\n');

  const reqOptions = {
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': 'FlashLive: Cashout Request',
      'Priority': 'high',
      'Tags': 'moneybag'
    }
  };

  const transport = target.protocol === 'https:' ? https : http;
  const req = transport.request(reqOptions, (res) => {
    console.log(`>>> Cashout ntfy status: ${res.statusCode}`);
  });
  req.on('error', (err) => console.error('Cashout ntfy error:', err.message));
  req.write(body);
  req.end();
}

// Bot AI responses are now handled server-side for virtual bots (no /api/ai-response needed)

const pairs = new Map(); // current matches: socket -> partner
const lastPartner = new Map(); // socket -> last partner (to avoid immediate re-matching)
const bots = new Set(); // track which IDs are bots (virtual bot IDs)
const userProfiles = new Map(); // socket -> {profile: {name, age, gender, country}, filters: {...}}
const searching = new Set(); // track which sockets are actively searching for a match
const activeChatSessions = new Map(); // chatId -> session
const completedChatSessions = []; // ended sessions
const socketToChatSession = new Map(); // socketId -> chatId
const notifiedJoins = new Set(); // prevent duplicate join webhooks per socket
const activeLoginSessions = new Map(); // socketId -> { socketId, name, loginAt, lastSeenAt }
const completedLoginSessions = []; // recent ended login sessions
const publicRoomEvents = []; // recent public room system/user messages (legacy, kept for init)
let publicRoomSpeakerBotId = null; // exactly one bot that replies in public room chat
const streamChatEvents = new Map(); // streamerId → [{id, type, text, ...}] per-streamer chat history

// ── Public Stream ──
const publicStreamers = []; // ordered list of socket IDs currently streaming
const viewerStreamIndex = new Map(); // viewerSocketId → index in publicStreamers they're watching
const streamerThumbnails = new Map(); // streamerId → base64 JPEG thumbnail

// ── Virtual Coins / Tips ──
const userBalances = new Map(); // userId → coin balance
const userPurchasedCoins = new Map(); // userId → coins from purchases/tips (cashout-eligible)
const socketToUserId = new Map(); // socketId → userId
const userIdToSocket = new Map(); // userId → socketId (latest connection)

// Persistence: load/save balances to disk
const BALANCES_FILE = path.join(__dirname, 'data', 'balances.json');

function loadBalancesFromDisk() {
  try {
    if (fs.existsSync(BALANCES_FILE)) {
      const data = JSON.parse(fs.readFileSync(BALANCES_FILE, 'utf8'));
      if (data.balances) {
        for (const [uid, bal] of Object.entries(data.balances)) {
          userBalances.set(uid, bal);
        }
      }
      if (data.purchased) {
        for (const [uid, purchased] of Object.entries(data.purchased)) {
          userPurchasedCoins.set(uid, purchased);
        }
      }
      console.log(`>>> Loaded ${userBalances.size} coin balances from disk`);
    }
  } catch (e) {
    console.error('Failed to load balances:', e.message);
  }
}

function saveBalancesToDisk() {
  try {
    const dir = path.dirname(BALANCES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = {
      balances: Object.fromEntries(userBalances),
      purchased: Object.fromEntries(userPurchasedCoins),
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(BALANCES_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save balances:', e.message);
  }
}

// Load on startup
loadBalancesFromDisk();

// Auto-save every 60 seconds
setInterval(saveBalancesToDisk, 60000);

function resolveUserId(socketId) {
  return socketToUserId.get(socketId) || socketId;
}

function getUserBalance(socketIdOrUserId) {
  const uid = socketToUserId.get(socketIdOrUserId) || socketIdOrUserId;
  if (!userBalances.has(uid)) userBalances.set(uid, 0);
  return userBalances.get(uid);
}

function setUserBalance(socketIdOrUserId, amount) {
  const uid = socketToUserId.get(socketIdOrUserId) || socketIdOrUserId;
  userBalances.set(uid, Math.max(0, amount));
}

function getUserPurchased(socketIdOrUserId) {
  const uid = socketToUserId.get(socketIdOrUserId) || socketIdOrUserId;
  return userPurchasedCoins.get(uid) || 0;
}

function addUserPurchased(socketIdOrUserId, coins) {
  const uid = socketToUserId.get(socketIdOrUserId) || socketIdOrUserId;
  userPurchasedCoins.set(uid, getUserPurchased(uid) + coins);
}

function getSocketIp(socketOrId) {
  const s = typeof socketOrId === 'string' ? io.sockets.sockets.get(socketOrId) : socketOrId;
  if (!s) return null;
  const forwarded = s.handshake?.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return String(s.handshake?.address || '').trim().toLowerCase();
}

function areSameIp(socketId1, socketId2) {
  const ip1 = getSocketIp(socketId1);
  const ip2 = getSocketIp(socketId2);
  return ip1 && ip2 && ip1 === ip2;
}

function getViewerCount(streamerId) {
  let count = 0;
  for (const [, idx] of viewerStreamIndex.entries()) {
    if (publicStreamers[idx] === streamerId) count++;
  }
  return count;
}

function getPublicStreamersList() {
  return publicStreamers.map((id) => {
    const bp = botProfiles.get(id);
    const isLiveSuki = id === SUKI_BOT_ID && sukiLiveSocketId;
    return {
      socketId: id,
      name: getSocketDisplayName(id),
      viewerCount: getViewerCount(isLiveSuki ? sukiLiveSocketId : id),
      botVideoUrl: isLiveSuki ? null : (bp ? bp.botVideoUrl : null),
      thumbnail: isLiveSuki
        ? (streamerThumbnails.get(sukiLiveSocketId) || null)
        : (streamerThumbnails.get(id) || null)
    };
  });
}

// ── Ensure all virtual bots are streaming ──
function triggerAllBotStreams() {
  let added = 0;
  for (const botId of virtualBotIds) {
    if (!publicStreamers.includes(botId)) {
      publicStreamers.push(botId);
      console.log(`>>> Virtual bot ${botId} (${getSocketDisplayName(botId)}) started streaming`);
      added++;
    }
  }
  if (added > 0) {
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
    emitPublicOnlineUsers();
  }
}

function hasRealStreamers() {
  // Suki's offline bot slot doesn't count as a "real" streamer
  return publicStreamers.some(id => !botProfiles.has(id) && id !== SUKI_BOT_ID);
}

function removeBotStreams() {
  const before = publicStreamers.length;
  for (let i = publicStreamers.length - 1; i >= 0; i--) {
    // Never remove Suki's offline slot — it stays unless she goes live herself
    if (publicStreamers[i] === SUKI_BOT_ID) continue;
    if (botProfiles.has(publicStreamers[i])) publicStreamers.splice(i, 1);
  }
  if (publicStreamers.length !== before) {
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
    emitPublicOnlineUsers();
  }
}

// When a real user starts broadcasting:
// – pull all virtual bot slots out of publicStreamers
// – redirect every viewer who was watching a bot to the real streamer
// – have virtual bots join the streamer's chat room (they appear as live viewers)
function consolidateBotsToStreamer(realStreamerId) {
  const realStreamerIdx = publicStreamers.indexOf(realStreamerId);
  if (realStreamerIdx === -1) return;
  const streamerName = getSocketDisplayName(realStreamerId);

  // Collect bot indexes before we splice anything
  const botIndexes = new Set();
  for (let i = 0; i < publicStreamers.length; i++) {
    if (publicStreamers[i] !== SUKI_BOT_ID && botProfiles.has(publicStreamers[i])) {
      botIndexes.add(i);
    }
  }
  if (botIndexes.size === 0) return;

  // Move every viewer watching a bot slot → real streamer slot
  for (const [viewerId, viewerIdx] of viewerStreamIndex.entries()) {
    if (!botIndexes.has(viewerIdx)) continue;
    const viewerSocket = io.sockets.sockets.get(viewerId);
    if (!viewerSocket) continue;
    viewerStreamIndex.set(viewerId, realStreamerIdx);
    joinStreamRoom(viewerSocket, realStreamerId); // leaves old bot room, joins real streamer room
    const viewerCount = getViewerCount(realStreamerId);
    viewerSocket.emit('public-stream-ready', {
      streamerId: realStreamerId,
      streamerName,
      streamerIndex: realStreamerIdx,
      botVideoUrl: null,
      viewerCount
    });
    // Tell the real streamer to send an offer to this viewer
    const streamerSocket = io.sockets.sockets.get(realStreamerId);
    if (streamerSocket) streamerSocket.emit('public-stream-viewer-joined', { viewerId });
  }

  // Remove virtual bot slots from publicStreamers (SUKI_BOT_ID stays)
  for (let i = publicStreamers.length - 1; i >= 0; i--) {
    if (publicStreamers[i] !== SUKI_BOT_ID && botProfiles.has(publicStreamers[i])) {
      publicStreamers.splice(i, 1);
    }
  }

  // Bots join the real streamer's chat room (appear in viewer list)
  for (const botId of virtualBotIds) {
    const botSocket = io.sockets.sockets.get(botId);
    if (botSocket) {
      joinStreamRoom(botSocket, realStreamerId);
      viewerStreamIndex.set(botId, publicStreamers.indexOf(realStreamerId));
    }
  }

  console.log(`>>> Bots consolidated into streamer ${realStreamerId} (${streamerName})`);
}

const joinWebhookStats = {
  configured: Boolean(JOIN_WEBHOOK_URL),
  attempts: 0,
  successes: 0,
  failures: 0,
  lastStatus: null,
  lastError: null,
  lastSentAt: null,
  lastPayload: null
};

function sendJoinWebhook(payload) {
  if (!JOIN_WEBHOOK_URL) return;

  joinWebhookStats.attempts += 1;
  joinWebhookStats.lastSentAt = new Date().toISOString();
  joinWebhookStats.lastPayload = payload;
  joinWebhookStats.lastError = null;
  joinWebhookStats.lastStatus = null;

  let target;
  try {
    target = new URL(JOIN_WEBHOOK_URL);
  } catch (error) {
    joinWebhookStats.failures += 1;
    joinWebhookStats.lastError = `Invalid URL: ${error.message}`;
    console.error('Invalid JOIN_WEBHOOK_URL:', error.message);
    return;
  }

  const profile = payload?.profile || {};
  const name = profile.name || 'Unknown';
  const age = profile.age ?? 'N/A';
  const gender = profile.gender || 'N/A';
  const country = formatCountryName(profile.country);
  const realUsersOnline = Number.isFinite(Number(payload?.realUsersOnline))
    ? Number(payload.realUsersOnline)
    : null;
  const eventTime = payload?.timestamp ? new Date(payload.timestamp).toLocaleString() : new Date().toLocaleString();
  const isNtfy = /(^|\.)ntfy\.sh$/i.test(target.hostname);

  const participantA = payload?.participantA || {};
  const participantB = payload?.participantB || {};

  const prettyBody = payload?.event === 'chat-started'
    ? [
        'New chat started',
        `User A: ${participantA.name || 'Unknown'} (${participantA.age ?? 'N/A'}, ${participantA.gender || 'N/A'}, ${formatCountryName(participantA.country)})`,
        `User B: ${participantB.name || 'Unknown'} (${participantB.age ?? 'N/A'}, ${participantB.gender || 'N/A'}, ${formatCountryName(participantB.country)})`,
        `Time: ${eventTime}`
      ].join('\n')
    : [
        'New user joined FlashLive',
        `Name: ${name}`,
        `Age: ${age}`,
        `Gender: ${gender}`,
        `Country: ${country}`,
        `Real users online: ${realUsersOnline ?? 'N/A'}`,
        `Time: ${eventTime}`
      ].join('\n');

  const ntfyTitle = payload?.event === 'chat-started' ? 'FlashLive: chat started' : 'FlashLive: user joined';

  const body = isNtfy ? prettyBody : JSON.stringify(payload);
  const headers = isNtfy
    ? {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': ntfyTitle,
        'Priority': '5',
        'Tags': 'bust_in_silhouette,video_camera',
        'Content-Length': Buffer.byteLength(body)
      }
    : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      };

  const client = target.protocol === 'https:' ? https : http;

  const request = client.request(
    {
      method: 'POST',
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers,
      timeout: 6000
    },
    (response) => {
      response.resume();
      if (response.statusCode >= 400) {
        joinWebhookStats.failures += 1;
        joinWebhookStats.lastStatus = response.statusCode;
        joinWebhookStats.lastError = `HTTP ${response.statusCode}`;
        console.warn(`JOIN_WEBHOOK_URL responded ${response.statusCode}`);
      } else {
        joinWebhookStats.successes += 1;
        joinWebhookStats.lastStatus = response.statusCode;
      }
    }
  );

  request.on('timeout', () => request.destroy(new Error('join webhook timeout')));
  request.on('error', (error) => {
    joinWebhookStats.failures += 1;
    joinWebhookStats.lastError = error.message;
    console.warn('Join webhook failed:', error.message);
  });
  request.write(body);
  request.end();
}

function buildPublicRoomEvent({ type, text, socketId = null, name = null, clientMsgId = null }) {
  return {
    id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    text: String(text || '').trim(),
    socketId,
    name: name || null,
    clientMsgId: clientMsgId || null,
    timestamp: new Date().toISOString()
  };
}

function pushPublicRoomEvent(event) {
  if (!event || !event.text) return null;
  publicRoomEvents.push(event);
  if (publicRoomEvents.length > 300) {
    publicRoomEvents.shift();
  }
  // Broadcast to all connected sockets (legacy global)
  io.emit('public-room-event', event);
  return event;
}

// ── Per-streamer chat ──
function getStreamChatRoom(streamerId) {
  return `stream:${streamerId}`;
}

function pushStreamChatEvent(streamerId, event) {
  if (!event || !event.text || !streamerId) return null;
  if (!streamChatEvents.has(streamerId)) {
    streamChatEvents.set(streamerId, []);
  }
  const events = streamChatEvents.get(streamerId);
  events.push(event);
  if (events.length > 200) events.shift();
  // Broadcast only to viewers in this streamer's room
  io.to(getStreamChatRoom(streamerId)).emit('stream-chat-event', { streamerId, event });
  return event;
}

function getStreamRoomUsers(streamerId) {
  const room = getStreamChatRoom(streamerId);
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  const users = [];
  // Exclude the streamer's own socket — they're the host, not a viewer
  const streamerSocketId = (streamerId === SUKI_BOT_ID) ? sukiLiveSocketId : streamerId;
  if (socketsInRoom) {
    for (const sid of socketsInRoom) {
      if (streamerSocketId && sid === streamerSocketId) continue;
      const profile = userProfiles.get(sid)?.profile;
      if (!profile?.name) continue;
      users.push({
        socketId: sid,
        name: profile.name,
        gender: (profile.gender || '').toLowerCase(),
        isBot: false
      });
    }
  }
  // Also add the streamer if it's a bot (but not Suki's slot — she's a real girl)
  if (bots.has(streamerId) && streamerId !== SUKI_BOT_ID) {
    const bp = botProfiles.get(streamerId);
    if (bp) {
      users.unshift({
        socketId: streamerId,
        name: bp.name || 'Bot',
        gender: (bp.gender || 'female').toLowerCase(),
        isBot: true
      });
    }
  }
  return users;
}

function emitStreamRoomUsers(streamerId) {
  const room = getStreamChatRoom(streamerId);
  const users = getStreamRoomUsers(streamerId);
  io.to(room).emit('stream-room-users', { streamerId, users });
}

function joinStreamRoom(socket, streamerId) {
  // Leave any previous stream room
  leaveAllStreamRooms(socket);
  const room = getStreamChatRoom(streamerId);
  socket.join(room);
  socket.data.currentStreamRoom = streamerId;
  // Send chat history for this room
  const history = streamChatEvents.get(streamerId) || [];
  socket.emit('stream-chat-init', { streamerId, events: history.slice(-100) });
  // Notify room of new viewer — use cached publicRoomName so we always have
  // the real name even if userProfiles isn't set yet (race on reconnect).
  const displayName = socket.data.publicRoomName || getSocketDisplayName(socket.id);
  if (displayName && displayName !== 'Guest') {
    pushStreamChatEvent(streamerId, buildPublicRoomEvent({
      type: 'system',
      text: `${displayName} joined`
    }));
  }
  emitStreamRoomUsers(streamerId);
}

function leaveAllStreamRooms(socket) {
  const prevStreamerId = socket.data?.currentStreamRoom;
  if (prevStreamerId) {
    const room = getStreamChatRoom(prevStreamerId);
    socket.leave(room);
    socket.data.currentStreamRoom = null;
    // Use socket.data.publicRoomName — userProfiles may already be deleted
    // by the time this is called from the disconnect handler.
    const displayName = socket.data.publicRoomName || getSocketDisplayName(socket.id);
    if (displayName && displayName !== 'Guest') {
      pushStreamChatEvent(prevStreamerId, buildPublicRoomEvent({
        type: 'system',
        text: `${displayName} left`
      }));
    }
    emitStreamRoomUsers(prevStreamerId);
  }
}

function getSocketDisplayName(socketId) {
  const profileName = userProfiles.get(socketId)?.profile?.name;
  const botName = botProfiles.get(socketId)?.name;
  const resolvedName = (profileName || botName || 'Guest').trim();
  return resolvedName || 'Guest';
}

function upsertLoginSession(socketId, name) {
  if (!socketId) return;
  const now = new Date().toISOString();
  const existing = activeLoginSessions.get(socketId);

  if (existing) {
    existing.name = (name || existing.name || 'Unknown').trim() || 'Unknown';
    existing.lastSeenAt = now;
    return;
  }

  activeLoginSessions.set(socketId, {
    socketId,
    name: (name || 'Unknown').trim() || 'Unknown',
    loginAt: now,
    lastSeenAt: now
  });
}

function closeLoginSession(socketId) {
  const active = activeLoginSessions.get(socketId);
  if (!active) return;

  activeLoginSessions.delete(socketId);
  completedLoginSessions.unshift({
    ...active,
    logoutAt: new Date().toISOString()
  });

  if (completedLoginSessions.length > 500) {
    completedLoginSessions.pop();
  }
}

function buildLoginSessionsSnapshot() {
  const now = Date.now();

  const active = Array.from(activeLoginSessions.values()).map((session) => {
    const loginAtMs = Date.parse(session.loginAt);
    const durationSeconds = Number.isFinite(loginAtMs)
      ? Math.max(0, Math.floor((now - loginAtMs) / 1000))
      : 0;

    return {
      socketId: session.socketId,
      name: session.name,
      loginAt: session.loginAt,
      logoutAt: null,
      durationSeconds,
      isOnline: true
    };
  });

  const recentCompleted = completedLoginSessions.slice(0, 300).map((session) => {
    const loginAtMs = Date.parse(session.loginAt);
    const logoutAtMs = Date.parse(session.logoutAt);
    const durationSeconds = Number.isFinite(loginAtMs) && Number.isFinite(logoutAtMs)
      ? Math.max(0, Math.floor((logoutAtMs - loginAtMs) / 1000))
      : 0;

    return {
      socketId: session.socketId,
      name: session.name,
      loginAt: session.loginAt,
      logoutAt: session.logoutAt,
      durationSeconds,
      isOnline: false
    };
  });

  return [...active, ...recentCompleted].sort((a, b) => {
    const aTime = Date.parse(a.loginAt) || 0;
    const bTime = Date.parse(b.loginAt) || 0;
    return bTime - aTime;
  });
}

function buildParticipantDetails(socketId) {
  const profileData = userProfiles.get(socketId);
  const botData = botProfiles.get(socketId);
  const connectedSocket = io.sockets.sockets.get(socketId);
  const isBot = bots.has(socketId) || !!connectedSocket?.data?.isBot;

  return {
    socketId,
    isBot,
    connected: !!connectedSocket,
    profile: {
      name: botData?.name || profileData?.profile?.name || null,
      age: botData?.age ?? profileData?.profile?.age ?? null,
      gender: botData?.gender || profileData?.profile?.gender || null,
      country: botData?.countryName || profileData?.profile?.country || null
    },
    filters: profileData?.filters || null
  };
}

function buildChatSummary(session) {
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: session.status,
    endReason: session.endReason || null,
    messageCount: session.messages.length,
    participants: session.participants.map((socketId) => {
      const details = session.participantDetails[socketId] || {};
      return {
        socketId,
        isBot: !!details.isBot,
        name: details.profile?.name || socketId.substring(0, 8)
      };
    })
  };
}

function buildOnlineUsersSnapshot() {
  const online = [];
  // Real connected users
  for (const socket of io.sockets.sockets.values()) {
    const socketId = socket.id;
    const profileData = userProfiles.get(socketId);

    online.push({
      socketId,
      shortId: socketId.substring(0, 8),
      isBot: false,
      name: profileData?.profile?.name || null,
      age: profileData?.profile?.age ?? null,
      gender: profileData?.profile?.gender || null,
      country: profileData?.profile?.country || null,
      hasProfile: userProfiles.has(socketId),
      searching: searching.has(socketId),
      paired: pairs.has(socketId)
    });
  }
  // Virtual bots
  for (const botId of virtualBotIds) {
    const bp = botProfiles.get(botId);
    online.push({
      socketId: botId,
      shortId: botId.substring(0, 8),
      isBot: true,
      name: bp?.name || 'Bot',
      age: bp?.age ?? null,
      gender: bp?.gender || 'female',
      country: bp?.countryName || null,
      hasProfile: true,
      searching: searching.has(botId),
      paired: pairs.has(botId)
    });
  }

  online.sort((a, b) => {
    if (a.isBot !== b.isBot) return a.isBot ? 1 : -1;
    return a.shortId.localeCompare(b.shortId);
  });

  return online;
}

function emitAdminOnlineUsers() {
  adminNamespace.emit('admin-online-users', {
    onlineUsers: buildOnlineUsersSnapshot(),
    loginSessions: buildLoginSessionsSnapshot()
  });
}

function buildPublicOnlineUsersSnapshot() {
  const users = [];
  // Add real connected users
  for (const socket of io.sockets.sockets.values()) {
    const socketId = socket.id;
    const profile = userProfiles.get(socketId)?.profile || {};
    const profileName = profile.name;
    // Skip sockets that haven't set a profile (no name)
    if (!profileName) continue;
    const fallbackName = `Guest-${socketId.substring(0, 4)}`;
    users.push({
      socketId,
      name: (profileName || fallbackName).trim(),
      isBot: false,
      gender: (profile.gender || '').toString().toLowerCase(),
      searching: searching.has(socketId),
      paired: pairs.has(socketId),
      streaming: publicStreamers.includes(socketId)
    });
  }
  // Add virtual bots
  for (const botId of virtualBotIds) {
    const bp = botProfiles.get(botId) || {};
    users.push({
      socketId: botId,
      name: bp.name || 'Bot',
      isBot: true,
      gender: (bp.gender || 'female').toLowerCase(),
      searching: searching.has(botId),
      paired: pairs.has(botId),
      streaming: publicStreamers.includes(botId)
    });
  }

  users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

function emitPublicOnlineUsers() {
  io.emit('online-users', {
    users: buildPublicOnlineUsersSnapshot()
  });
}

function getPublicRoomBotSocketIds() {
  // Virtual bots are always in the public room
  return virtualBotIds.slice();
}

function getPublicRoomSpeakerBotSocketId() {
  const botSocketIds = getPublicRoomBotSocketIds();
  if (botSocketIds.length < 1) {
    publicRoomSpeakerBotId = null;
    return null;
  }

  if (publicRoomSpeakerBotId && botSocketIds.includes(publicRoomSpeakerBotId)) {
    return publicRoomSpeakerBotId;
  }

  publicRoomSpeakerBotId = botSocketIds[0];
  return publicRoomSpeakerBotId;
}

function maybeEmitBotReplyToHumanPublicMessage(fromSocketId, text) {
  // Find the streamer the human is watching
  const streamerId = io.sockets.sockets.get(fromSocketId)?.data?.currentStreamRoom;

  // Don't let bots intervene when multiple real users are chatting
  let humansCount = 0;
  if (streamerId) {
    const room = getStreamChatRoom(streamerId);
    const socketsInRoom = io.sockets.adapter.rooms.get(room);
    if (socketsInRoom) {
      for (const sid of socketsInRoom) {
        const s = io.sockets.sockets.get(sid);
        if (s && !s.data?.isBot) humansCount++;
      }
    }
  } else {
    humansCount = Array.from(io.sockets.sockets.values())
      .filter(s => s.data?.publicRoomJoined && !s.data?.isBot).length;
  }
  if (humansCount > 1) return;

  const speakerId = getPublicRoomSpeakerBotSocketId();
  if (!speakerId) return;

  const humanName = getSocketDisplayName(fromSocketId);
  const botProfile = botProfiles.get(speakerId) || userProfiles.get(speakerId)?.profile || {};
  const speakerName = getSocketDisplayName(speakerId);

  setTimeout(async () => {
    const speakerSocket = io.sockets.sockets.get(speakerId);
    if (!speakerSocket || !speakerSocket.data?.publicRoomJoined) return;

    try {
      const replyBody = await getPublicRoomBotReply(text, botProfile);
      const replyText = `${humanName}, ${replyBody}`;

      const replyEvent = buildPublicRoomEvent({
        type: 'message',
        text: replyText,
        socketId: speakerId,
        name: speakerName
      });

      if (streamerId) {
        pushStreamChatEvent(streamerId, replyEvent);
      } else {
        pushPublicRoomEvent(replyEvent);
      }
    } catch (error) {
      console.warn('Skipping public room bot reply:', error.message);
      const errorEvent = buildPublicRoomEvent({
        type: 'system',
        text: `${speakerName} couldn't reply right now (Groq temporarily unavailable).`
      });
      if (streamerId) {
        pushStreamChatEvent(streamerId, errorEvent);
      } else {
        pushPublicRoomEvent(errorEvent);
      }
    }
  }, 900);
}

// ═══════════════════════════════════════════════
//  Bot-to-Bot Conversation (when no humans chat)
// ═══════════════════════════════════════════════
let lastHumanMessageAt = Date.now();
let botConvoTimer = null;
let botConvoLastMessage = '';  // track last bot message for context
const BOT_CONVO_IDLE_MS = 60_000;   // resume after 60s of no human messages
const BOT_CONVO_INTERVAL_MS = 12_000; // bots exchange every 12s
let botConvoGeneration = 0; // incremented when human speaks, cancels in-flight bot replies
let botConvoInProgress = false; // lock to prevent overlapping async turns

function countHumansInPublicRoom() {
  return Array.from(io.sockets.sockets.values())
    .filter(s => s.data?.publicRoomJoined && !s.data?.isBot).length;
}

function pickTwoBots() {
  const botIds = getPublicRoomBotSocketIds();
  if (botIds.length < 2) return null;
  const shuffled = botIds.sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

const botConvoStarters = [
  'Hey! How\'s your day going?',
  'What kind of music are you into?',
  'Have you watched any good movies lately?',
  'What do you do for fun?',
  'Where are you from? I love learning about new places!',
  'Do you have any pets?',
  'What\'s the best food you\'ve ever had?',
  'If you could travel anywhere, where would you go?',
  'What\'s your favorite thing about weekends?',
  'Do you have any hobbies?'
];

function shouldBotsChat() {
  // No chatting if no humans are in the public room (no audience)
  if (countHumansInPublicRoom() === 0) return false;
  // No chatting if a human spoke recently (within 60s)
  if (Date.now() - lastHumanMessageAt < BOT_CONVO_IDLE_MS) return false;
  return true;
}

async function doBotConvoTurn() {
  if (botConvoInProgress) return; // skip if previous turn still in-flight
  if (!shouldBotsChat()) {
    botConvoLastMessage = '';
    return;
  }

  const pair = pickTwoBots();
  if (!pair) return;

  botConvoInProgress = true;
  const [speakerA, speakerB] = pair;
  const socketA = io.sockets.sockets.get(speakerA);
  const socketB = io.sockets.sockets.get(speakerB);
  if (!socketA || !socketB) { botConvoInProgress = false; return; }

  const profileA = botProfiles.get(speakerA) || userProfiles.get(speakerA)?.profile || {};
  const profileB = botProfiles.get(speakerB) || userProfiles.get(speakerB)?.profile || {};
  const nameA = getSocketDisplayName(speakerA);
  const nameB = getSocketDisplayName(speakerB);

  const gen = botConvoGeneration;
  console.log(`[BOT-CONVO] Turn start gen=${gen}, humans=${countHumansInPublicRoom()}`);

  try {
    if (!botConvoLastMessage) {
      // Start a fresh conversation — Bot A initiates
      if (!shouldBotsChat()) { botConvoInProgress = false; return; }
      const starter = botConvoStarters[Math.floor(Math.random() * botConvoStarters.length)];
      const starterEvent = buildPublicRoomEvent({
        type: 'message', text: starter, socketId: speakerA, name: nameA
      });
      // Broadcast to speakerA's stream room (since they're a bot streamer)
      if (publicStreamers.includes(speakerA)) {
        pushStreamChatEvent(speakerA, starterEvent);
      } else {
        pushPublicRoomEvent(starterEvent);
      }
      botConvoLastMessage = starter;

      // Bot B replies after a delay — but abort if human joined or spoke
      setTimeout(async () => {
        if (botConvoGeneration !== gen || !shouldBotsChat()) { botConvoInProgress = false; return; }
        try {
          const reply = await getPublicRoomBotReply(`${nameA} said: "${starter}"`, profileB);
          if (botConvoGeneration !== gen || !shouldBotsChat()) { botConvoInProgress = false; return; }
          const replyEvent = buildPublicRoomEvent({
            type: 'message', text: reply, socketId: speakerB, name: nameB
          });
          if (publicStreamers.includes(speakerB)) {
            pushStreamChatEvent(speakerB, replyEvent);
          } else {
            pushPublicRoomEvent(replyEvent);
          }
          botConvoLastMessage = reply;
        } catch (e) {
          console.warn('Bot-to-bot reply error:', e.message);
        }
        botConvoInProgress = false;
      }, 3000 + Math.random() * 2000);
      return; // don't release lock here — setTimeout will release it
    } else {
      // Continue — Bot A responds to last message
      if (!shouldBotsChat()) { botConvoInProgress = false; return; }
      const reply = await getPublicRoomBotReply(botConvoLastMessage, profileA);
      if (botConvoGeneration !== gen || !shouldBotsChat()) { botConvoInProgress = false; return; }
      const replyEvent = buildPublicRoomEvent({
        type: 'message', text: reply, socketId: speakerA, name: nameA
      });
      if (publicStreamers.includes(speakerA)) {
        pushStreamChatEvent(speakerA, replyEvent);
      } else {
        pushPublicRoomEvent(replyEvent);
      }
      botConvoLastMessage = reply;
    }
  } catch (e) {
    console.warn('Bot-to-bot convo error:', e.message);
    botConvoLastMessage = '';
  }
  botConvoInProgress = false;
}

function startBotConvoLoop() {
  if (botConvoTimer) return;
  botConvoTimer = setInterval(doBotConvoTurn, BOT_CONVO_INTERVAL_MS);
  console.log('Bot-to-bot conversation loop started');
}

function stopBotConvoLoop() {
  if (botConvoTimer) {
    clearInterval(botConvoTimer);
    botConvoTimer = null;
    botConvoLastMessage = '';
  }
}

// Start the bot conversation loop after server boots
setTimeout(startBotConvoLoop, 15_000);

function startChatSession(socketIdA, socketIdB) {
  const existing = socketToChatSession.get(socketIdA) || socketToChatSession.get(socketIdB);
  if (existing && activeChatSessions.has(existing)) {
    return activeChatSessions.get(existing);
  }

  const chatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = {
    id: chatId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'active',
    endReason: null,
    participants: [socketIdA, socketIdB],
    participantDetails: {
      [socketIdA]: buildParticipantDetails(socketIdA),
      [socketIdB]: buildParticipantDetails(socketIdB)
    },
    messages: []
  };

  activeChatSessions.set(chatId, session);
  socketToChatSession.set(socketIdA, chatId);
  socketToChatSession.set(socketIdB, chatId);
  adminNamespace.emit('chat-created', { summary: buildChatSummary(session) });
  return session;
}

function endChatSessionForSocket(socketId, reason) {
  const chatId = socketToChatSession.get(socketId);
  if (!chatId) return;

  const session = activeChatSessions.get(chatId);
  if (!session) {
    socketToChatSession.delete(socketId);
    return;
  }

  if (session.status !== 'active') return;

  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  session.endReason = reason;

  for (const participantId of session.participants) {
    session.participantDetails[participantId] = buildParticipantDetails(participantId);
    socketToChatSession.delete(participantId);
  }

  activeChatSessions.delete(chatId);
  completedChatSessions.unshift(session);
  if (completedChatSessions.length > 1000) completedChatSessions.pop();

  adminNamespace.emit('chat-ended', {
    summary: buildChatSummary(session),
    chatId
  });
}

function recordChatMessage(fromSocketId, toSocketId, text) {
  const chatId = socketToChatSession.get(fromSocketId) || socketToChatSession.get(toSocketId);
  if (!chatId) return;

  const session = activeChatSessions.get(chatId);
  if (!session || session.status !== 'active') return;

  session.messages.push({
    timestamp: new Date().toISOString(),
    fromSocketId,
    toSocketId,
    text: String(text)
  });

  adminNamespace.emit('chat-updated', {
    summary: buildChatSummary(session),
    chatId,
    lastMessage: session.messages[session.messages.length - 1]
  });
}

const adminNamespace = io.of('/admin');

adminNamespace.use((socket, next) => {
  const hostHeader = socket.handshake.headers?.host || '';
  if (!ADMIN_KEY && isLocalHostHeader(hostHeader)) return next();
  if (!ADMIN_KEY) return next(new Error('unauthorized'));
  const providedKey = socket.handshake.auth?.key || socket.handshake.query?.key;
  if (providedKey === ADMIN_KEY) return next();
  return next(new Error('unauthorized'));
});

adminNamespace.on('connection', (socket) => {
  socket.emit('admin-init', {
    activeChats: Array.from(activeChatSessions.values()).map(buildChatSummary),
    completedChats: completedChatSessions.slice(0, 200).map(buildChatSummary),
    onlineUsers: buildOnlineUsersSnapshot(),
    loginSessions: buildLoginSessionsSnapshot()
  });

  socket.on('admin-get-chat', ({ chatId } = {}) => {
    if (!chatId) return;
    const active = activeChatSessions.get(chatId);
    const completed = completedChatSessions.find((chat) => chat.id === chatId);
    const chat = active || completed;
    if (!chat) return;

    socket.emit('admin-chat-detail', {
      chat: {
        ...chat,
        summary: buildChatSummary(chat)
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  Support Chat System
// ═══════════════════════════════════════════════════════════

const supportConversations = new Map(); // sessionId → { messages: [], lastActivity, socketId? }

const SUPPORT_NTFY_URL = (process.env.SUPPORT_NTFY_URL || 'https://ntfy.sh/flashlive-support').trim();

function sendSupportNtfy(sessionId, text) {
  if (!SUPPORT_NTFY_URL) return;
  let target;
  try { target = new URL(SUPPORT_NTFY_URL); } catch { return; }

  const shortId = sessionId.length > 12 ? sessionId.slice(0, 12) + '…' : sessionId;
  const body = `Session: ${shortId}\n${text.slice(0, 500)}`;
  const isNtfy = /(^|\.)ntfy\.sh$/i.test(target.hostname);
  const headers = isNtfy
    ? {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': 'Support Chat Message',
        'Priority': '4',
        'Tags': 'speech_balloon,wrench',
        'Content-Length': Buffer.byteLength(body)
      }
    : {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      };

  const client = target.protocol === 'https:' ? https : http;
  const req = client.request({
    method: 'POST',
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: `${target.pathname}${target.search}`,
    headers,
    timeout: 6000
  }, (res) => { res.resume(); });
  req.on('timeout', () => req.destroy());
  req.on('error', () => {});
  req.end(body);
}

const supportNamespace = io.of('/support');

supportNamespace.on('connection', (socket) => {
  const sessionId = socket.handshake.query?.sessionId;
  if (!sessionId) return socket.disconnect(true);

  // Register socket with its session
  if (!supportConversations.has(sessionId)) {
    supportConversations.set(sessionId, { messages: [], lastActivity: Date.now() });
  }
  const conv = supportConversations.get(sessionId);
  conv.socketId = socket.id;

  // Send history to reconnecting user
  if (conv.messages.length > 0) {
    socket.emit('support-history', { messages: conv.messages });
  }

  socket.on('support-message', ({ text } = {}) => {
    if (!text || typeof text !== 'string') return;
    const message = { from: 'user', text: text.slice(0, 2000), timestamp: new Date().toISOString() };
    conv.messages.push(message);
    conv.lastActivity = Date.now();

    // Forward to all connected admins
    supportAdminNamespace.emit('support-new-message', { sessionId, message });

    // Send ntfy notification
    sendSupportNtfy(sessionId, text);
  });

  socket.on('disconnect', () => {
    // Keep conversation in memory but clear socketId
    if (conv) conv.socketId = null;
  });
});

const supportAdminNamespace = io.of('/support-admin');

supportAdminNamespace.use((socket, next) => {
  const hostHeader = socket.handshake.headers?.host || '';
  if (!ADMIN_KEY && isLocalHostHeader(hostHeader)) return next();
  if (!ADMIN_KEY) return next(new Error('unauthorized'));
  const providedKey = socket.handshake.auth?.key || socket.handshake.query?.key;
  if (providedKey === ADMIN_KEY) return next();
  return next(new Error('unauthorized'));
});

supportAdminNamespace.on('connection', (socket) => {
  // Send all conversations
  const convs = [];
  for (const [sessionId, conv] of supportConversations) {
    convs.push({ sessionId, messages: conv.messages, lastActivity: conv.lastActivity });
  }
  socket.emit('support-conversations', convs);

  socket.on('admin-reply', ({ sessionId, text } = {}) => {
    if (!sessionId || !text || typeof text !== 'string') return;
    const conv = supportConversations.get(sessionId);
    if (!conv) return;

    const message = { from: 'admin', text: text.slice(0, 2000), timestamp: new Date().toISOString() };
    conv.messages.push(message);
    conv.lastActivity = Date.now();

    // Forward reply to the user's socket if connected
    if (conv.socketId) {
      const userSocket = supportNamespace.sockets.get(conv.socketId);
      if (userSocket) {
        userSocket.emit('admin-reply', { text: message.text, timestamp: message.timestamp });
      }
    }

    // Broadcast to other admin tabs
    socket.broadcast.emit('support-new-message', { sessionId, message });
  });
});

// Cleanup old entries periodically to prevent memory leaks
function cleanupStaleEntries() {
  const connectedSockets = new Set();
  for (const socket of io.sockets.sockets.values()) {
    connectedSockets.add(socket.id);
  }
  
  let cleaned = 0;
  // Clean up pairs for disconnected users
  for (const [key, value] of pairs.entries()) {
    if (!connectedSockets.has(key) || !connectedSockets.has(value)) {
      pairs.delete(key);
      cleaned++;
    }
  }
  
  // Clean up lastPartner for disconnected users
  for (const key of lastPartner.keys()) {
    if (!connectedSockets.has(key)) {
      lastPartner.delete(key);
      cleaned++;
    }
  }
  
  // Clean up userProfiles for disconnected users (skip virtual bot IDs)
  for (const key of userProfiles.keys()) {
    if (virtualBotIds.includes(key) || key === SUKI_BOT_ID) continue;
    if (!connectedSockets.has(key)) {
      userProfiles.delete(key);
      cleaned++;
    }
  }
  
  // Clean up searching for disconnected users (skip virtual bot IDs)
  for (const key of searching.keys()) {
    if (virtualBotIds.includes(key) || key === SUKI_BOT_ID) continue;
    if (!connectedSockets.has(key)) {
      searching.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[CLEANUP] Removed ${cleaned} stale entries from memory`);
  }
}

// Start periodic cleanup
const cleanupInterval = setInterval(cleanupStaleEntries, CLEANUP_INTERVAL);

function broadcastUserCount() {
  const connected = Array.from(io.sockets.sockets.values());
  const humansOnline = connected.filter(s => !s.data.isBot).length;
  const botsOnline = virtualBotIds.length;
  io.emit('user-count', {
    humans: humansOnline,
    bots: botsOnline,
    total: humansOnline + botsOnline
  });
}

function getRealUsersOnlineCount() {
  const connected = Array.from(io.sockets.sockets.values());
  return connected.filter((s) => !s.data.isBot).length;
}

io.on('connection', (socket) => {
  console.log('connected', socket.id);
  socket.data.isBot = false;
  socket.data.publicRoomJoined = false;
  socket.data.publicRoomName = null;

  // Map persistent userId to this socket
  const userId = socket.handshake?.auth?.userId;
  if (userId && typeof userId === 'string' && userId.startsWith('u_')) {
    socketToUserId.set(socket.id, userId);
    userIdToSocket.set(userId, socket.id);
    socket.data.userId = userId;
  }

  broadcastUserCount();
  emitAdminOnlineUsers();
  emitPublicOnlineUsers();
  
  // Handle profile setting
  socket.on('set-profile', ({ profile, filters }) => {
    userProfiles.set(socket.id, { profile, filters });
    console.log(`Profile set for ${socket.id}:`, profile, 'Filters:', filters);
    if (!socket.data.isBot) {
      upsertLoginSession(socket.id, profile?.name);
    }
    // Initialize coin balance for new users (0 coins - must purchase)
    if (!socket.data.isBot && !userBalances.has(resolveUserId(socket.id))) {
      userBalances.set(resolveUserId(socket.id), 0);
    }
    emitAdminOnlineUsers();

    if (!socket.data.isBot && !notifiedJoins.has(socket.id)) {
      notifiedJoins.add(socket.id);
      sendJoinWebhook({
        event: 'user-joined',
        timestamp: new Date().toISOString(),
        socketId: socket.id,
        realUsersOnline: getRealUsersOnlineCount(),
        profile: {
          name: profile?.name || null,
          age: profile?.age ?? null,
          gender: profile?.gender || null,
          country: profile?.country || null
        }
      });
    }

    if (!socket.data.isBot) {
      const displayName = getSocketDisplayName(socket.id);
      socket.data.publicRoomName = displayName;

      socket.emit('public-room-init', {
        events: publicRoomEvents.slice(-150)
      });

      // Send coin balance to user
      socket.emit('coin-balance', { balance: getUserBalance(socket.id) });

      // Send current public streamers to new joiner
      if (publicStreamers.length > 0) {
        socket.emit('public-stream-update', { streamers: getPublicStreamersList() });
      }

      if (!socket.data.publicRoomJoined) {
        socket.data.publicRoomJoined = true;
        pushPublicRoomEvent(buildPublicRoomEvent({
          type: 'system',
          text: `${displayName} joined the public room`
        }));
      }

      // Ensure all bots are streaming
      if (publicStreamers.length < virtualBotIds.length) {
        setTimeout(() => triggerAllBotStreams(), 1500);
      }
    }

    emitPublicOnlineUsers();
  });

  // register-bot handler removed — bots are now virtual (no Puppeteer)

  // ── Virtual Coins / Tips ──
  socket.on('send-tip', ({ toSocketId, amount } = {}) => {
    if (socket.data.isBot) return;
    const tipAmount = parseInt(amount);
    if (!tipAmount || tipAmount <= 0 || ![50, 100, 500, 1000, 5000].includes(tipAmount)) return;
    if (!toSocketId || toSocketId === socket.id) return;

    // Only allow tips to logged-in users (not guests)
    const recipientSock = io.sockets.sockets.get(toSocketId);
    if (!recipientSock || !recipientSock.data.userId) {
      socket.emit('tip-error', { message: 'Can only tip logged-in users' });
      return;
    }

    // Block tips between same-IP connections (anti-abuse)
    if (areSameIp(socket.id, toSocketId)) {
      socket.emit('tip-error', { message: 'Cannot tip users on the same network' });
      console.log(`>>> TIP BLOCKED (same IP): ${socket.id} → ${toSocketId}`);
      return;
    }

    const senderBalance = getUserBalance(socket.id);
    if (senderBalance < tipAmount) {
      socket.emit('tip-error', { message: 'Not enough coins' });
      return;
    }

    // Deduct from sender, add to recipient
    setUserBalance(socket.id, senderBalance - tipAmount);
    const recipientBalance = getUserBalance(toSocketId);
    setUserBalance(toSocketId, recipientBalance + tipAmount);
    addUserPurchased(toSocketId, tipAmount); // Tips received are cashout-eligible

    const senderName = getSocketDisplayName(socket.id);
    const recipientName = getSocketDisplayName(toSocketId);

    // Notify both parties of new balances
    socket.emit('coin-balance', { balance: getUserBalance(socket.id) });
    const recipientSocket = io.sockets.sockets.get(toSocketId);
    if (recipientSocket) {
      recipientSocket.emit('coin-balance', { balance: getUserBalance(toSocketId) });
    }

    // Broadcast tip to the streamer's chat room
    const tipStreamerId = socket.data?.currentStreamRoom;
    const tipEvent = buildPublicRoomEvent({
      type: 'tip',
      text: `🪙 ${senderName} tipped ${recipientName} ${tipAmount} coins!`,
      amount: tipAmount,
      fromName: senderName,
      toName: recipientName
    });
    if (tipStreamerId) {
      pushStreamChatEvent(tipStreamerId, tipEvent);
    } else {
      pushPublicRoomEvent(tipEvent);
    }

    console.log(`>>> TIP: ${senderName} → ${recipientName}: ${tipAmount} coins`);
  });

  socket.on('public-chat-message', ({ text, clientMsgId } = {}) => {
    if (socket.data.isBot) return;
    if (!socket.data.publicRoomJoined) return;

    lastHumanMessageAt = Date.now();
    botConvoLastMessage = '';
    botConvoGeneration++;
    console.log(`[HUMAN MSG] gen=${botConvoGeneration}, from=${getSocketDisplayName(socket.id)}`);

    const safeText = String(text || '').trim().slice(0, 500);
    if (!safeText) return;

    // Send to the per-streamer chat room the viewer is watching
    const currentStreamerId = socket.data?.currentStreamRoom;
    if (currentStreamerId) {
      pushStreamChatEvent(currentStreamerId, buildPublicRoomEvent({
        type: 'message',
        text: safeText,
        socketId: socket.id,
        name: getSocketDisplayName(socket.id),
        clientMsgId: typeof clientMsgId === 'string' ? clientMsgId.slice(0, 80) : null
      }));
      maybeEmitBotReplyToHumanPublicMessage(socket.id, safeText);
    } else {
      // Fallback: global public room (user not watching any stream)
      pushPublicRoomEvent(buildPublicRoomEvent({
        type: 'message',
        text: safeText,
        socketId: socket.id,
        name: getSocketDisplayName(socket.id),
        clientMsgId: typeof clientMsgId === 'string' ? clientMsgId.slice(0, 80) : null
      }));
      maybeEmitBotReplyToHumanPublicMessage(socket.id, safeText);
    }
  });

  // ── Private Direct Messages ──
  socket.on('private-message', ({ to, text } = {}) => {
    if (!to || !text || typeof text !== 'string') return;
    if (socket.data.isBot) return;
    const safeText = text.trim().slice(0, 500);
    if (!safeText) return;
    const senderName = getSocketDisplayName(socket.id);
    const recipientSocket = io.sockets.sockets.get(to);
    // Also allow sending to bots
    const isBotRecipient = bots.has(to);
    if (!recipientSocket && !isBotRecipient) return;
    const msg = {
      from: socket.id,
      fromName: senderName,
      to,
      text: safeText,
      timestamp: Date.now()
    };
    // Send to recipient
    if (recipientSocket) {
      recipientSocket.emit('private-message', msg);
    }
    // Echo back to sender
    socket.emit('private-message', msg);
    // If recipient is a bot, generate an AI reply
    if (isBotRecipient) {
      const botProfile = botProfiles.get(to) || {};
      const botName = getSocketDisplayName(to);
      setTimeout(async () => {
        try {
          const replyBody = await getPublicRoomBotReply(safeText, botProfile);
          const botMsg = {
            from: to,
            fromName: botName,
            to: socket.id,
            text: replyBody,
            timestamp: Date.now()
          };
          socket.emit('private-message', botMsg);
        } catch (e) {
          console.warn('Bot DM reply error:', e.message);
        }
      }, 800 + Math.random() * 1200);
    }
  });

  // ── Public Stream handlers ──
  socket.on('start-public-stream', () => {
    if (publicStreamers.includes(socket.id)) return; // already streaming

    // If this is Suki going live, use the dedicated partner-room logic
    if (isSukiSocket(socket)) {
      sukiGoLive(socket.id);
      emitPublicOnlineUsers();
      return;
    }

    // If this user was watching another stream as a viewer, cleanly pull them out first
    const oldViewerIdx = viewerStreamIndex.get(socket.id);
    if (oldViewerIdx != null && oldViewerIdx >= 0 && oldViewerIdx < publicStreamers.length) {
      const oldStreamerId = publicStreamers[oldViewerIdx];
      const oldEffective = (oldStreamerId === SUKI_BOT_ID && sukiLiveSocketId) ? sukiLiveSocketId : oldStreamerId;
      const oldStreamerSocket = io.sockets.sockets.get(oldEffective);
      if (oldStreamerSocket) oldStreamerSocket.emit('public-stream-viewer-left', { viewerId: socket.id });
    }
    leaveAllStreamRooms(socket);           // leave previous viewer room (no-op if not watching)
    viewerStreamIndex.delete(socket.id);   // clear viewer index

    publicStreamers.push(socket.id);
    const streamerName = getSocketDisplayName(socket.id);
    console.log(`>>> ${socket.id} started public stream (${streamerName})`);
    // Pull all virtual bots out of publicStreamers and move their viewers to this streamer
    consolidateBotsToStreamer(socket.id);
    // Put the streamer in their own chat room so they receive chat messages
    joinStreamRoom(socket, socket.id);
    // Tell the streamer's client which slot they're at so the TT feed can navigate there
    const myIdx = publicStreamers.indexOf(socket.id);
    socket.emit('public-stream-ready', {
      streamerId: socket.id,
      streamerName,
      streamerIndex: myIdx,
      botVideoUrl: null,
      viewerCount: 0,
      isSelf: true
    });
    // Notify all clients of the updated streamer list
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
    emitPublicOnlineUsers();
  });

  // ── Streamer sends a thumbnail capture of their webcam ──
  socket.on('stream-thumbnail', ({ data } = {}) => {
    if (!data || typeof data !== 'string') return;
    // Allow Suki's live socket even though she's not in publicStreamers
    if (!publicStreamers.includes(socket.id) && socket.id !== sukiLiveSocketId) return;
    // Limit size (~100KB max base64)
    if (data.length > 150000) return;
    streamerThumbnails.set(socket.id, data);
  });

  socket.on('stop-public-stream', () => {
    // If Suki stops broadcasting, restore her offline slot
    if (socket.id === sukiLiveSocketId) {
      sukiGoOffline();
      streamChatEvents.delete(socket.id);
      streamerThumbnails.delete(socket.id);
      emitPublicOnlineUsers();
      return;
    }

    const idx = publicStreamers.indexOf(socket.id);
    if (idx === -1) return;
    publicStreamers.splice(idx, 1);
    console.log(`>>> ${socket.id} stopped public stream`);
    // Notify viewers who were watching this streamer
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
    emitPublicOnlineUsers();
    // Disconnect all viewers watching this streamer and leave their stream rooms
    for (const [viewerId, viewerIdx] of viewerStreamIndex.entries()) {
      if (viewerIdx === idx) {
        viewerStreamIndex.delete(viewerId);
        const viewerSocket = io.sockets.sockets.get(viewerId);
        if (viewerSocket) {
          leaveAllStreamRooms(viewerSocket);
          // Don't send public-stream-ended to virtual bots — they'll get re-added as streamers
          if (!botProfiles.has(viewerId)) {
            viewerSocket.emit('public-stream-ended');
          }
        }
      } else if (viewerIdx > idx) {
        // Shift indexes down
        viewerStreamIndex.set(viewerId, viewerIdx - 1);
      }
    }
    // Clean up chat history and thumbnail for this streamer
    streamChatEvents.delete(socket.id);
    streamerThumbnails.delete(socket.id);
    // If no real users left, restore bots as streamers
    if (!hasRealStreamers()) {
      setTimeout(() => triggerAllBotStreams(), 500);
    }
  });

  socket.on('watch-public-stream', ({ streamerIndex } = {}) => {
    if (!socket.data.publicRoomJoined) return; // must have set profile first
    // Viewer wants to watch a specific streamer by index
    const idx = typeof streamerIndex === 'number' ? streamerIndex : 0;
    if (idx < 0 || idx >= publicStreamers.length) {
      socket.emit('public-stream-ended');
      return;
    }
    const streamerId = publicStreamers[idx];
    if (streamerId === socket.id) {
      // Skip self — go to next
      const nextIdx = (idx + 1) % publicStreamers.length;
      if (nextIdx === idx || publicStreamers[nextIdx] === socket.id) {
        socket.emit('public-stream-ended');
        return;
      }
      return socket.emit('watch-public-stream-redirect', { streamerIndex: nextIdx });
    }
    viewerStreamIndex.set(socket.id, idx);
    const streamerName = getSocketDisplayName(streamerId);
    const bp = botProfiles.get(streamerId);
    // For Suki's slot: use her live socket ID while she's on air
    const effectiveStreamerId = (streamerId === SUKI_BOT_ID && sukiLiveSocketId) ? sukiLiveSocketId : streamerId;
    const botVideoUrl = (effectiveStreamerId !== streamerId) ? null : (bp ? bp.botVideoUrl : null);
    const viewerCount = getViewerCount(effectiveStreamerId);
    // Join this streamer's chat room (always stream:partner-suki for Suki's slot)
    joinStreamRoom(socket, streamerId);
    // Tell the viewer to connect to this streamer
    socket.emit('public-stream-ready', { streamerId: effectiveStreamerId, streamerName, streamerIndex: idx, botVideoUrl, viewerCount });
    // Broadcast updated viewer counts
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
    // If real streamer, tell them to send an offer to this viewer
    if (!botVideoUrl) {
      const streamerSocket = io.sockets.sockets.get(effectiveStreamerId);
      if (streamerSocket) {
        streamerSocket.emit('public-stream-viewer-joined', { viewerId: socket.id });
      }
    }
  });

  // ── Watch specific streamer by socket ID (QR / share link) ──
  socket.on('watch-public-stream-by-id', ({ streamerId } = {}) => {
    if (!socket.data.publicRoomJoined) return; // must have set profile first
    if (!streamerId) { socket.emit('public-stream-ended'); return; }
    // Resolve SUKI_BOT_ID alias in case the grid sends the bot ID while she's live
    const resolvedId = (streamerId === SUKI_BOT_ID && sukiLiveSocketId) ? sukiLiveSocketId : streamerId;
    // Find the slot index using SUKI_BOT_ID (since that always stays in publicStreamers)
    const lookupId = (streamerId === SUKI_BOT_ID || resolvedId === sukiLiveSocketId) ? SUKI_BOT_ID : streamerId;
    const idx = publicStreamers.indexOf(lookupId);
    if (idx === -1) { socket.emit('public-stream-ended'); return; }
    if (resolvedId === socket.id) { socket.emit('public-stream-ended'); return; }
    viewerStreamIndex.set(socket.id, idx);
    const streamerName = getSocketDisplayName(lookupId);
    const bp = botProfiles.get(lookupId);
    const effectiveStreamerId = (lookupId === SUKI_BOT_ID && sukiLiveSocketId) ? sukiLiveSocketId : lookupId;
    const botVideoUrl = (effectiveStreamerId !== lookupId) ? null : (bp ? bp.botVideoUrl : null);
    const viewerCount = getViewerCount(effectiveStreamerId);
    // Join the canonical room for this slot (always stream:partner-suki for Suki)
    joinStreamRoom(socket, lookupId);
    socket.emit('public-stream-ready', { streamerId: effectiveStreamerId, streamerName, streamerIndex: idx, botVideoUrl, viewerCount });
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
    if (!botVideoUrl) {
      const streamerSocket = io.sockets.sockets.get(effectiveStreamerId);
      if (streamerSocket) {
        streamerSocket.emit('public-stream-viewer-joined', { viewerId: socket.id });
      }
    }
  });

  socket.on('next-public-streamer', () => {
    const currentIdx = viewerStreamIndex.get(socket.id) ?? -1;
    if (publicStreamers.length === 0) {
      socket.emit('public-stream-ended');
      return;
    }
    let nextIdx = (currentIdx + 1) % publicStreamers.length;
    // Skip self
    if (publicStreamers[nextIdx] === socket.id) {
      if (publicStreamers.length <= 1) {
        socket.emit('public-stream-ended');
        return;
      }
      nextIdx = (nextIdx + 1) % publicStreamers.length;
    }
    // Disconnect from current streamer
    if (currentIdx >= 0 && currentIdx < publicStreamers.length) {
      const oldStreamerId = publicStreamers[currentIdx];
      // For Suki's slot, notify her live socket if on air
      const oldEffective = (oldStreamerId === SUKI_BOT_ID && sukiLiveSocketId) ? sukiLiveSocketId : oldStreamerId;
      const oldStreamerSocket = io.sockets.sockets.get(oldEffective);
      if (oldStreamerSocket) {
        oldStreamerSocket.emit('public-stream-viewer-left', { viewerId: socket.id });
      }
    }
    viewerStreamIndex.set(socket.id, nextIdx);
    const streamerId = publicStreamers[nextIdx];
    const streamerName = getSocketDisplayName(streamerId);
    const bp = botProfiles.get(streamerId);
    // For Suki's slot: use her live socket ID while she's on air
    const effectiveStreamerId = (streamerId === SUKI_BOT_ID && sukiLiveSocketId) ? sukiLiveSocketId : streamerId;
    const botVideoUrl = (effectiveStreamerId !== streamerId) ? null : (bp ? bp.botVideoUrl : null);
    const viewerCount = getViewerCount(effectiveStreamerId);
    // Join new streamer's chat room (always stream:partner-suki for Suki's slot)
    joinStreamRoom(socket, streamerId);
    socket.emit('public-stream-ready', { streamerId: effectiveStreamerId, streamerName, streamerIndex: nextIdx, botVideoUrl, viewerCount });
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
    if (!botVideoUrl) {
      const streamerSocket = io.sockets.sockets.get(effectiveStreamerId);
      if (streamerSocket) {
        streamerSocket.emit('public-stream-viewer-joined', { viewerId: socket.id });
      }
    }
  });

  socket.on('public-stream-signal', ({ to, data }) => {
    if (!to) return;
    const dest = io.sockets.sockets.get(to);
    if (dest) dest.emit('public-stream-signal', { from: socket.id, data });
  });

  socket.on('stop-watching-public-stream', () => {
    const idx = viewerStreamIndex.get(socket.id);
    if (idx != null && idx >= 0 && idx < publicStreamers.length) {
      const streamerId = publicStreamers[idx];
      // For Suki's slot, notify her live socket if she's on air
      const effectiveStreamerId = (streamerId === SUKI_BOT_ID && sukiLiveSocketId) ? sukiLiveSocketId : streamerId;
      const streamerSocket = io.sockets.sockets.get(effectiveStreamerId);
      if (streamerSocket) {
        streamerSocket.emit('public-stream-viewer-left', { viewerId: socket.id });
      }
    }
    // Leave stream chat room
    leaveAllStreamRooms(socket);
    viewerStreamIndex.delete(socket.id);
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });
  });

  socket.on('request-public-streamers', () => {
    if (publicStreamers.length > 0) {
      socket.emit('public-stream-update', { streamers: getPublicStreamersList() });
    }
  });

  socket.on('find', ({ isBot } = {}) => {
    console.log('>>> find event received from', socket.id, isBot ? '(BOT)' : '(USER)');
    
    // Don't search if already paired
    if (pairs.has(socket.id)) {
      console.log('>>> already paired, ignoring');
      return;
    }

    // Suki is a partner broadcaster — she does not enter random chat
    if (isSukiSocket(socket)) {
      console.log('>>> Suki socket blocked from random chat find');
      return;
    }
    
    // Mark as bot if specified
    if (isBot) {
      socket.data.isBot = true;
      bots.add(socket.id);
    }
    
    // Mark this socket as actively searching
    searching.add(socket.id);
    console.log(`>>> ${socket.id} added to searching pool`);
    emitAdminOnlineUsers();
    emitPublicOnlineUsers();
    
    // Helper function to check if two users match each other's filters
    const checkFiltersMatch = (socketId1, socketId2) => {
      const user1Data = userProfiles.get(socketId1);
      const user2Data = userProfiles.get(socketId2);
      
      // Need profiles for both users/bots
      if (!user1Data || !user2Data) return false;
      
      const { profile: p1, filters: f1 } = user1Data;
      const { profile: p2, filters: f2 } = user2Data;
      
      const id1IsBot = bots.has(socketId1);
      const id2IsBot = bots.has(socketId2);
      
      // Bots accept anyone — skip the bot's filter check against the other user
      // Only apply filters from real users
      if (!id2IsBot) {
        // Check if user1 meets user2's filters
        if (f2.gender !== 'any' && p1.gender !== f2.gender) return false;
        if (f2.country !== 'any' && p1.country !== f2.country) return false;
        if (p1.age < f2.minAge || p1.age > f2.maxAge) return false;
      }
      
      if (!id1IsBot) {
        // Check if user2 meets user1's filters
        if (f1.gender !== 'any' && p2.gender !== f1.gender) {
          console.log(`>>> Filter mismatch: ${socketId1} wants gender=${f1.gender}, ${socketId2} is gender=${p2.gender}`);
          return false;
        }
        if (f1.country !== 'any' && p2.country !== f1.country) {
          console.log(`>>> Filter mismatch: ${socketId1} wants country=${f1.country}, ${socketId2} is country=${p2.country}`);
          return false;
        }
        if (p2.age < f1.minAge || p2.age > f1.maxAge) {
          console.log(`>>> Filter mismatch: ${socketId1} wants age ${f1.minAge}-${f1.maxAge}, ${socketId2} is age ${p2.age}`);
          return false;
        }
      }
      
      return true;
    };

    const normalizeText = (value) => String(value || '').trim().toLowerCase();

    const getClientIp = (socketObj) => {
      const forwarded = socketObj?.handshake?.headers?.['x-forwarded-for'];
      if (forwarded) {
        return String(forwarded).split(',')[0].trim();
      }
      return normalizeText(socketObj?.handshake?.address);
    };

    // Prevent matching two concurrent connections that are likely the same person.
    const isLikelySamePerson = (socketId1, socketId2) => {
      const socket1 = io.sockets.sockets.get(socketId1);
      const socket2 = io.sockets.sockets.get(socketId2);
      if (!socket1 || !socket2) return false;
      if (socket1.data.isBot || socket2.data.isBot) return false;

      const profile1 = userProfiles.get(socketId1)?.profile;
      const profile2 = userProfiles.get(socketId2)?.profile;
      if (!profile1 || !profile2) return false;

      const sameName = normalizeText(profile1.name) && normalizeText(profile1.name) === normalizeText(profile2.name);
      const sameAge = Number(profile1.age) === Number(profile2.age);
      const sameGender = normalizeText(profile1.gender) === normalizeText(profile2.gender);
      const sameCountry = normalizeText(profile1.country) === normalizeText(profile2.country);
      const sameProfile = sameName && sameAge && sameGender && sameCountry;

      const ip1 = getClientIp(socket1);
      const ip2 = getClientIp(socket2);
      const sameIp = !!ip1 && ip1 === ip2;

      if (sameProfile && sameIp) {
        console.log(`>>> skip likely self-match between ${socketId1} and ${socketId2}`);
        return true;
      }

      return false;
    };
    
    // Get all available people (not paired, not self, not last partner, matching filters)
    const availableUsers = [];
    const availableBots = [];
    
    // Check real connected users
    for (const otherSocket of io.sockets.sockets.values()) {
      const sid = otherSocket.id;
      if (sid === socket.id) continue; // skip self
      if (pairs.has(sid)) continue; // skip already paired
      if (!searching.has(sid)) continue; // skip users not actively searching
      if (lastPartner.get(socket.id) === sid || lastPartner.get(sid) === socket.id) continue; // skip immediate rematch in either direction
      if (isLikelySamePerson(socket.id, sid)) continue; // skip likely same person concurrent connection
      
      // Check if filters match
      if (!checkFiltersMatch(socket.id, sid)) continue;
      
      availableUsers.push(sid);
    }

    // Check virtual bots (not real sockets)
    if (!isBot) {
      for (const botId of virtualBotIds) {
        if (pairs.has(botId)) continue;
        if (!searching.has(botId)) continue;
        if (lastPartner.get(socket.id) === botId || lastPartner.get(botId) === socket.id) continue;
        if (!checkFiltersMatch(socket.id, botId)) continue;
        availableBots.push(botId);
      }
    }
    
    console.log(`>>> available users: ${availableUsers.length}, available bots: ${availableBots.length}`);
    
    let otherId = null;
    
    // Priority 1: match with random user
    if (availableUsers.length > 0) {
      otherId = availableUsers[Math.floor(Math.random() * availableUsers.length)];
      console.log(`>>> MATCHED! ${socket.id} with user ${otherId}`);
    }
    // Priority 2: match with random bot (only if requester is a real user)
    else if (!isBot && availableBots.length > 0) {
      otherId = availableBots[Math.floor(Math.random() * availableBots.length)];
      console.log(`>>> MATCHED USER WITH BOT! ${socket.id} with bot ${otherId}`);
    }
    
    if (otherId) {
      // Make the match
      pairs.set(socket.id, otherId);
      pairs.set(otherId, socket.id);
      
      // Clear lastPartner entries: both their own entries AND anyone who has them as lastPartner
      lastPartner.delete(socket.id);
      lastPartner.delete(otherId);
      
      // Also clear any entries where the VALUE is socket.id or otherId
      for (const [key, value] of lastPartner.entries()) {
        if (value === socket.id || value === otherId) {
          lastPartner.delete(key);
          console.log(`>>> cleared lastPartner[${key}] = ${value}`);
        }
      }
      console.log(`>>> cleared lastPartner for ${socket.id} and ${otherId}`);
      
      // Remove both from searching pool
      searching.delete(socket.id);
      searching.delete(otherId);
      console.log(`>>> removed ${socket.id} and ${otherId} from searching pool`);
      emitAdminOnlineUsers();
      emitPublicOnlineUsers();
      
      const isMatchWithBot = bots.has(otherId);
      let botProfile = null;
      let botVideoUrl = null;
      if (isMatchWithBot) {
        const profile = botProfiles.get(otherId);
        if (profile) {
          botProfile = {
            name: profile.name,
            age: profile.age,
            country: profile.countryName
          };
          botVideoUrl = profile.botVideoUrl;
        }
      }

      const toClientPartnerProfile = (profile) => {
        if (!profile) return null;
        return {
          name: profile.name || 'Partner',
          age: profile.age ?? 'N/A',
          country: formatCountryName(profile.country)
        };
      };

      const requesterPartnerProfile = toClientPartnerProfile(userProfiles.get(otherId)?.profile);
      const otherPartnerProfile = toClientPartnerProfile(userProfiles.get(socket.id)?.profile);

      const session = startChatSession(socket.id, otherId);

      io.to(socket.id).emit('matched', {
        otherId,
        initiator: true,
        isBot: isMatchWithBot,
        botProfile,
        botVideoUrl,
        partnerProfile: requesterPartnerProfile
      });
      // Virtual bots don't have a real socket, so don't emit to them
      if (!isMatchWithBot) {
        io.to(otherId).emit('matched', {
          otherId: socket.id,
          initiator: false,
          isBot: false,
          partnerProfile: otherPartnerProfile
        });
      }
    } else {
      console.log(`>>> ${socket.id} has no available partners`);
      socket.emit('waiting');
    }
  });

  socket.on('signal', ({ to, data }) => {
    if (!to) return;
    const dest = io.sockets.sockets.get(to);
    if (dest) dest.emit('signal', { from: socket.id, data });
  });

  socket.on('chat-message', ({ to, text }) => {
    if (!to || !text) return;
    // If the recipient is a virtual bot, handle AI response server-side
    if (bots.has(to)) {
      recordChatMessage(socket.id, to, text);
      const profile = botProfiles.get(to);
      if (!profile) return;
      setTimeout(async () => {
        try {
          const response = await getGroqResponse(text, profile);
          if (response) {
            socket.emit('chat-message', { from: to, text: response });
            recordChatMessage(to, socket.id, response);
          }
        } catch (err) {
          console.warn('Bot chat response error:', err.message);
        }
      }, 500 + Math.random() * 1500);
      return;
    }
    const dest = io.sockets.sockets.get(to);
    if (dest) {
      dest.emit('chat-message', { from: socket.id, text });
      recordChatMessage(socket.id, to, text);
    }
  });

  socket.on('report-safety', ({ details, partnerId, statusText } = {}) => {
    const safeDetails = typeof details === 'string' ? details.trim().slice(0, 2000) : '';
    if (!safeDetails) return;

    const activePartner = pairs.get(socket.id) || partnerId || null;
    const reportEntry = {
      timestamp: new Date().toISOString(),
      reporterSocketId: socket.id,
      reportedSocketId: activePartner,
      status: typeof statusText === 'string' ? statusText.slice(0, 200) : '',
      details: safeDetails,
      userAgent: socket.handshake?.headers?.['user-agent'] || ''
    };

    const reportPath = path.join(__dirname, 'reports.log');
    fs.appendFile(reportPath, `${JSON.stringify(reportEntry)}\n`, (err) => {
      if (err) {
        console.error('Failed to write safety report:', err);
        return;
      }
      console.log('[SAFETY REPORT]', reportEntry);
    });

    socket.emit('report-received');
  });

  socket.on('stop-searching', () => {
    console.log('>>> stop-searching event received from', socket.id);
    searching.delete(socket.id);
    console.log(`>>> removed ${socket.id} from searching pool`);
    emitAdminOnlineUsers();
    emitPublicOnlineUsers();
  });

  socket.on('next', () => {
    console.log('>>> next event received from', socket.id);
    const partner = pairs.get(socket.id);
    
    if (partner) {
      // Only remember the immediate last partner to avoid rematch
      // Clear any OLD lastPartner entries for this user first
      lastPartner.delete(socket.id);
      
      // Now set the current partner as lastPartner
      lastPartner.set(socket.id, partner);
      lastPartner.set(partner, socket.id);
      console.log(`>>> set lastPartner: ${socket.id} -> ${partner}`);
      
      // If partner is a virtual bot, add it back to searching pool (not Suki's slot)
      if (virtualBotIds.includes(partner)) {
        searching.add(partner);
        console.log(`>>> re-added bot ${partner} to searching pool`);
      }
      
      // notify partner
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      io.to(partner).emit('peer-left', { id: socket.id, reason: 'peer-requested-next' });
      
      pairs.delete(socket.id);
      pairs.delete(partner);
      endChatSessionForSocket(socket.id, 'next');
      emitAdminOnlineUsers();
      emitPublicOnlineUsers();
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    const publicRoomName = socket.data.publicRoomName || getSocketDisplayName(socket.id);
    const wasInPublicRoom = socket.data.publicRoomJoined;
    closeLoginSession(socket.id);
    endChatSessionForSocket(socket.id, 'disconnect');
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      pairs.delete(partner);
      pairs.delete(socket.id);
      
      // If partner is a virtual bot, add it back to searching pool (not Suki's slot)
      if (virtualBotIds.includes(partner)) {
        searching.add(partner);
        console.log(`>>> re-added bot ${partner} to searching pool after disconnect`);
      }
    }
    
    // Clean up all traces of this user
    if (socket.id === publicRoomSpeakerBotId) {
      publicRoomSpeakerBotId = null;
    }
    bots.delete(socket.id);
    botProfiles.delete(socket.id);
    userProfiles.delete(socket.id);
    searching.delete(socket.id);
    lastPartner.delete(socket.id);
    notifiedJoins.delete(socket.id);
    // Don't delete userBalances - they persist by userId now
    socketToUserId.delete(socket.id);

    // Clean up public stream state
    leaveAllStreamRooms(socket);

    // If Suki disconnects while live, restore her offline bot slot
    if (socket.id === sukiLiveSocketId) {
      sukiGoOffline();
      streamChatEvents.delete(socket.id);
      streamerThumbnails.delete(socket.id);
    }

    const streamerIdx = publicStreamers.indexOf(socket.id);
    if (streamerIdx !== -1) {
      publicStreamers.splice(streamerIdx, 1);
      // Notify viewers who were watching this streamer and leave their stream rooms
      for (const [viewerId, viewerIdx] of viewerStreamIndex.entries()) {
        if (viewerIdx === streamerIdx) {
          viewerStreamIndex.delete(viewerId);
          const viewerSocket = io.sockets.sockets.get(viewerId);
          if (viewerSocket) {
            leaveAllStreamRooms(viewerSocket);
            // Don't send public-stream-ended to virtual bots — they'll get re-added as streamers
            if (!botProfiles.has(viewerId)) {
              viewerSocket.emit('public-stream-ended');
            }
          }
        } else if (viewerIdx > streamerIdx) {
          viewerStreamIndex.set(viewerId, viewerIdx - 1);
        }
      }
      // Clean up chat history and thumbnail for this streamer
      streamChatEvents.delete(socket.id);
      streamerThumbnails.delete(socket.id);
      io.emit('public-stream-update', { streamers: getPublicStreamersList() });
      // If no real users left, restore bots
      if (!hasRealStreamers()) {
        setTimeout(() => triggerAllBotStreams(), 500);
      }
    }
    viewerStreamIndex.delete(socket.id);
    io.emit('public-stream-update', { streamers: getPublicStreamersList() });

    if (wasInPublicRoom && publicRoomName && publicRoomName !== 'Guest') {
      pushPublicRoomEvent(buildPublicRoomEvent({
        type: 'system',
        text: `${publicRoomName} left the public room`
      }));
    }
    
    // Also remove this user from anyone's lastPartner
    for (const [key, value] of lastPartner.entries()) {
      if (value === socket.id) {
        lastPartner.delete(key);
      }
    }
    
    // Broadcast updated count when someone disconnects
    broadcastUserCount();
    emitAdminOnlineUsers();
    emitPublicOnlineUsers();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://10.100.102.18:${PORT}`);
  console.log(`Groq URL: ${GROQ_AI_URL}`);
  console.log(`Groq model: ${GROQ_MODEL}`);
  console.log(`Groq timeout: ${GROQ_TIMEOUT}ms`);
  console.log(`Groq key configured: ${Boolean(GROQ_API_KEY)}`);
  console.log(`Number of bots: ${NUM_BOTS}`);
  console.log(`Cleanup interval: ${CLEANUP_INTERVAL}ms`);
  
  // Initialize virtual bots (no Puppeteer needed)
  initVirtualBots();
  // Initialize Suki's partner slot (always first, shows suki.mp4 when offline)
  initSukiSlot();

  // Clean up when server stops
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    clearInterval(cleanupInterval);
    saveBalancesToDisk();
    process.exit(0);
  });
});
