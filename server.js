const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const https = require('https');

// Environment variables
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '10000'); // 10 seconds (was 5)
const NUM_BOTS = parseInt(process.env.NUM_BOTS || '5');
const CLEANUP_INTERVAL = parseInt(process.env.CLEANUP_INTERVAL || '60000'); // 1 minute
const ADMIN_KEY = process.env.ADMIN_KEY || '';

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
  if (req.path !== '/admin.html') return next();

  const hostHeader = req.headers.host || '';
  const keyFromQuery = req.query?.key;
  const hasValidKey = !!ADMIN_KEY && keyFromQuery === ADMIN_KEY;

  if (isLocalHostHeader(hostHeader) || hasValidKey) {
    return next();
  }

  return res.status(403).send('Admin page is local-only.');
});

app.use(express.static(path.join(__dirname, 'public')));

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

// Store bot profiles: socket.id -> { name, fullName, age, location, personaStyle }
const botProfiles = new Map();

function getPersonaByBotId(botId) {
  const idx = Number(botId) - 1;
  if (Number.isInteger(idx) && idx >= 0 && idx < botPersonas.length) {
    return botPersonas[idx];
  }
  return botPersonas[0];
}

// Fallback responses when Ollama is unavailable - organized by common user inputs
const fallbackResponses = {
  greetings: ["Hey! How are you?", "Hi there! What's up?", "Hello! Nice to meet you!", "Hey! How's it going?"],
  questions: {
    name: "I'm {name}. What about you?",
    age: "I'm {age}. How old are you?",
    location: "I'm from {location}. Where are you from?",
    hobbies: "I like chatting with new people, watching movies, and hanging out with friends. What about you?",
  },
  generic: [
    "That's interesting! Tell me more.",
    "Oh really? I've never thought about it that way.",
    "Haha, I like that! What else?",
    "That's cool! How did that happen?",
    "Wow, you seem interesting!",
    "Ha, that made me laugh. You're funny!",
    "I totally agree with you on that.",
    "That's a good point.",
    "Tell me more about yourself!"
  ]
};

function getFallbackResponse(userMessage, profile) {
  const msg = userMessage.toLowerCase().trim();
  
  // Detect greetings
  if (/^(hi|hey|hello|yo|sup|hola|what's up|whats up)/.test(msg)) {
    return fallbackResponses.greetings[Math.floor(Math.random() * fallbackResponses.greetings.length)];
  }
  
  // Detect name questions
  if (/(your name|who are you|what.*name)/.test(msg)) {
    return fallbackResponses.questions.name
      .replace('{name}', profile?.name || 'Sarah');
  }
  
  // Detect age questions  
  if (/(how old|your age|age are you)/.test(msg)) {
    return fallbackResponses.questions.age
      .replace('{age}', profile?.age || '25');
  }
  
  // Detect location questions
  if (/(where.*from|where.*live|your location)/.test(msg)) {
    return fallbackResponses.questions.location
      .replace('{location}', profile?.countryName || 'United States');
  }
  
  // Detect hobby/interest questions
  if (/(hobby|hobbies|interests|do for fun|like to do)/.test(msg)) {
    return fallbackResponses.questions.hobbies;
  }
  
  // Generic response
  return fallbackResponses.generic[Math.floor(Math.random() * fallbackResponses.generic.length)];
}

// Ollama helper function with timeout and fallback
async function getOllamaResponse(userMessage, profile) {
  try {
    const personaName = profile?.name || 'Sarah';
    const personaAge = profile?.age || 25;
    const personaLocation = profile?.countryName || 'United States';
    const personaStyle = profile?.style || 'Warm and friendly.';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);
    
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dolphin-mistral',
        prompt: `You are ${personaName}, a ${personaAge}-year-old woman from ${personaLocation}. You're having a casual video chat with a stranger. Respond naturally as ${personaName} would.

Your personality: ${personaStyle}

Rules:
- Keep responses brief (1-2 sentences)
- Sound like a real person having a natural conversation
- Answer questions about yourself using your character info
- If asked if you're real/AI/bot, be honest but casual about it
- Match the vibe - if they're casual, be casual; if friendly, be friendly

User just said: "${userMessage}"

Respond as ${personaName}:`,
        stream: false,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!data.response) {
      console.warn('Empty response from Ollama, using fallback');
      return getFallbackResponse(userMessage, profile);
    }
    return data.response.trim();
  } catch (err) {
    console.warn('Ollama error:', err.message, '- using fallback response');
    return getFallbackResponse(userMessage, profile);
  }
}

// Serve the socket.io client source map if present to avoid 404 in browser
app.get('/socket.io/socket.io.js.map', (req, res) => {
  const mapPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js.map');
  if (fs.existsSync(mapPath)) return res.sendFile(mapPath);
  res.status(404).end();
});
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

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
    botsList,
    usersList,
    searchingList
  });
});

app.get('/api/admin-online-users', (req, res) => {
  res.json({ onlineUsers: buildOnlineUsersSnapshot() });
});

// Endpoint for bots to get AI responses
app.post('/api/ai-response', express.json(), async (req, res) => {
  const { message, botId, socketId } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  try {
    let profile = botProfiles.get(socketId);
    if (!profile) {
      // Create new profile if doesn't exist
      const baseProfile = randomBotProfile();
      const personaIdx = Number(botId) - 1;
      const style = botPersonas[personaIdx % botPersonas.length].style;
      profile = { ...baseProfile, style };
      botProfiles.set(socketId, profile);
    }
    
    const response = await getOllamaResponse(message, profile);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const pairs = new Map(); // current matches: socket -> partner
const lastPartner = new Map(); // socket -> last partner (to avoid immediate re-matching)
const bots = new Set(); // track which sockets are bots
const userProfiles = new Map(); // socket -> {profile: {name, age, gender, country}, filters: {...}}
const searching = new Set(); // track which sockets are actively searching for a match
const activeChatSessions = new Map(); // chatId -> session
const completedChatSessions = []; // ended sessions
const socketToChatSession = new Map(); // socketId -> chatId

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
  for (const socket of io.sockets.sockets.values()) {
    const socketId = socket.id;
    const isBot = !!socket.data?.isBot;
    const profileData = userProfiles.get(socketId);
    const botData = botProfiles.get(socketId);

    online.push({
      socketId,
      shortId: socketId.substring(0, 8),
      isBot,
      name: botData?.name || profileData?.profile?.name || null,
      age: botData?.age ?? profileData?.profile?.age ?? null,
      gender: botData?.gender || profileData?.profile?.gender || null,
      country: botData?.countryName || profileData?.profile?.country || null,
      hasProfile: userProfiles.has(socketId),
      searching: searching.has(socketId),
      paired: pairs.has(socketId)
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
    onlineUsers: buildOnlineUsersSnapshot()
  });
}

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
    onlineUsers: buildOnlineUsersSnapshot()
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
  
  // Clean up userProfiles for disconnected users
  for (const key of userProfiles.keys()) {
    if (!connectedSockets.has(key)) {
      userProfiles.delete(key);
      cleaned++;
    }
  }
  
  // Clean up searching for disconnected users
  for (const key of searching.keys()) {
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
  const botsOnline = connected.filter(s => s.data.isBot).length;
  const humansOnline = connected.filter(s => !s.data.isBot && userProfiles.has(s.id)).length;
  io.emit('user-count', {
    humans: humansOnline,
    bots: botsOnline,
    total: humansOnline + botsOnline
  });
}

io.on('connection', (socket) => {
  console.log('connected', socket.id);
  broadcastUserCount();
  emitAdminOnlineUsers();
  
  // Handle profile setting
  socket.on('set-profile', ({ profile, filters }) => {
    userProfiles.set(socket.id, { profile, filters });
    console.log(`Profile set for ${socket.id}:`, profile, 'Filters:', filters);
    emitAdminOnlineUsers();
  });
  socket.data.isBot = false; // default is real user

  socket.on('register-bot', () => {
    socket.data.isBot = true;
    bots.add(socket.id);
    // Generate random profile for this bot session
    const profile = randomBotProfile();
    const personaIdx = Math.floor(Math.random() * botPersonas.length);
    profile.style = botPersonas[personaIdx].style;
    
    // Add gender for matching (country already set by randomBotProfile)
    profile.gender = 'female'; // All bots are female personas
    
    botProfiles.set(socket.id, profile);
    
    // Set bot profile in userProfiles so it can be matched
    userProfiles.set(socket.id, {
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
    
    // Add bot to searching pool (bots are always available)
    searching.add(socket.id);
    console.log(`>>> ${socket.id} added to searching pool (bot)`);
    broadcastUserCount();
    emitAdminOnlineUsers();
    
    console.log(`>>> ${socket.id} registered as bot - Name: ${profile.name}, Age: ${profile.age}, Gender: ${profile.gender}, Country: ${profile.countryName} (${profile.country})`);
  });

  socket.on('find', ({ isBot } = {}) => {
    console.log('>>> find event received from', socket.id, isBot ? '(BOT)' : '(USER)');
    
    // Don't search if already paired
    if (pairs.has(socket.id)) {
      console.log('>>> already paired, ignoring');
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
    
    // Helper function to check if two users match each other's filters
    const checkFiltersMatch = (socketId1, socketId2) => {
      const user1Data = userProfiles.get(socketId1);
      const user2Data = userProfiles.get(socketId2);
      
      const socket1 = io.sockets.sockets.get(socketId1);
      const socket2 = io.sockets.sockets.get(socketId2);
      if (!socket1 || !socket2) return false;
      
      // Need profiles for both users/bots
      if (!user1Data || !user2Data) return false;
      
      const { profile: p1, filters: f1 } = user1Data;
      const { profile: p2, filters: f2 } = user2Data;
      
      // Check if user1 meets user2's filters
      if (f2.gender !== 'any' && p1.gender !== f2.gender) return false;
      if (f2.country !== 'any' && p1.country !== f2.country) return false;
      if (p1.age < f2.minAge || p1.age > f2.maxAge) return false;
      
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
      
      return true;
    };
    
    // Get all available people (not paired, not self, not last partner, matching filters)
    const availableUsers = [];
    const availableBots = [];
    
    for (const otherSocket of io.sockets.sockets.values()) {
      const sid = otherSocket.id;
      if (sid === socket.id) continue; // skip self
      if (pairs.has(sid)) continue; // skip already paired
      if (!searching.has(sid)) continue; // skip users not actively searching
      if (lastPartner.get(socket.id) === sid) continue; // skip last partner
      
      // Check if filters match
      if (!checkFiltersMatch(socket.id, sid)) continue;
      
      // Separate into users and bots based on socket.data.isBot
      if (otherSocket.data.isBot) {
        availableBots.push(sid);
      } else {
        availableUsers.push(sid);
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
      
      const isMatchWithBot = bots.has(otherId);
      let botProfile = null;
      if (isMatchWithBot) {
        const profile = botProfiles.get(otherId);
        if (profile) {
          botProfile = {
            name: profile.name,
            age: profile.age,
            country: profile.countryName
          };
        }
      }
      io.to(socket.id).emit('matched', { otherId, initiator: true, isBot: isMatchWithBot, botProfile });
      io.to(otherId).emit('matched', { otherId: socket.id, initiator: false });
      startChatSession(socket.id, otherId);
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
  });

  socket.on('next', () => {
    console.log('>>> next event received from', socket.id);
    const partner = pairs.get(socket.id);
    
    if (partner) {
      // Remember who we just disconnected from (unidirectional - only block for the person who clicked next)
      lastPartner.set(socket.id, partner);
      console.log(`>>> set lastPartner: ${socket.id} -> ${partner}`);
      
      // If partner is a bot, add it back to searching pool
      if (bots.has(partner)) {
        searching.add(partner);
        console.log(`>>> re-added bot ${partner} to searching pool`);
      }
      
      // notify partner
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      io.to(partner).emit('peer-left', { id: socket.id, reason: 'peer-requested-next' });
      io.to(socket.id).emit('peer-disconnected', { id: partner });
      io.to(socket.id).emit('peer-left', { id: partner, reason: 'you-left' });
      
      pairs.delete(socket.id);
      pairs.delete(partner);
      endChatSessionForSocket(socket.id, 'next');
      emitAdminOnlineUsers();
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    endChatSessionForSocket(socket.id, 'disconnect');
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      pairs.delete(partner);
      pairs.delete(socket.id);
      
      // If partner is a bot, add it back to searching pool
      if (bots.has(partner)) {
        searching.add(partner);
        console.log(`>>> re-added bot ${partner} to searching pool after disconnect`);
      }
    }
    
    // Clean up all traces of this user
    bots.delete(socket.id);
    botProfiles.delete(socket.id);
    userProfiles.delete(socket.id);
    searching.delete(socket.id);
    lastPartner.delete(socket.id);
    
    // Also remove this user from anyone's lastPartner
    for (const [key, value] of lastPartner.entries()) {
      if (value === socket.id) {
        lastPartner.delete(key);
      }
    }
    
    // Broadcast updated count when someone disconnects
    broadcastUserCount();
    emitAdminOnlineUsers();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://10.100.102.18:${PORT}`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
  console.log(`Ollama timeout: ${OLLAMA_TIMEOUT}ms`);
  console.log(`Number of bots: ${NUM_BOTS}`);
  console.log(`Cleanup interval: ${CLEANUP_INTERVAL}ms`);
  
  // Start bots automatically
  console.log('Starting AI bots...');
  const botsProcess = spawn('node', ['bots.js'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, NUM_BOTS: NUM_BOTS.toString() }
  });
  
  botsProcess.on('error', (err) => {
    console.error('Failed to start bots:', err);
  });
  
  // Clean up bots when server stops
  process.on('SIGINT', () => {
    console.log('\nShutting down server and bots...');
    botsProcess.kill();
    clearInterval(cleanupInterval);
    process.exit(0);
  });
});
