const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const https = require('https');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const firstNames = ['Emma', 'Sophia', 'Olivia', 'Ava', 'Isabella', 'Charlotte', 'Amelia', 'Mia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Elizabeth', 'Sofia', 'Madison'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
const locations = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Miami', 'Denver', 'Seattle', 'Boston', 'Toronto', 'Vancouver', 'London', 'Paris', 'Berlin', 'Madrid', 'Amsterdam', 'Tokyo', 'Sydney', 'Mexico City'];

function randomBotProfile() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const age = 20 + Math.floor(Math.random() * 15); // 20-34
  const location = locations[Math.floor(Math.random() * locations.length)];
  
  return {
    name: firstName,
    fullName: `${firstName} ${lastName}`,
    age,
    location
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

// Ollama helper function
async function getOllamaResponse(userMessage, profile) {
  try {
    const personaName = profile?.name || 'Sarah';
    const personaAge = profile?.age || 25;
    const personaLocation = profile?.location || 'NYC';
    const personaStyle = profile?.style || 'Warm and friendly.';
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dolphin-mistral',
        prompt: `You are a woman named ${personaName}, ${personaAge} years old, from ${personaLocation}. You are chatting with a stranger in a random video chat. Style: ${personaStyle} Keep responses short (1-2 sentences max), friendly, and natural. NEVER mention you are an AI, a bot, or artificial unless directly asked "are you real?" or "are you AI?" Then tell the truth. Act completely like a real person. User said: "${userMessage}". Reply as ${personaName}:`,
        stream: false,
      })
    });
    
    const data = await response.json();
    if (!data.response) {
      console.error('Empty response from Ollama:', data);
      return null;
    }
    return data.response.trim();
  } catch (err) {
    console.error('Ollama error:', err.message);
    return null; // fallback to pattern-based if Ollama fails
  }
}

// Serve the socket.io client source map if present to avoid 404 in browser
app.get('/socket.io/socket.io.js.map', (req, res) => {
  const mapPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js.map');
  if (fs.existsSync(mapPath)) return res.sendFile(mapPath);
  res.status(404).end();
});
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

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

io.on('connection', (socket) => {
  console.log('connected', socket.id);
  socket.data.isBot = false; // default is real user

  socket.on('register-bot', () => {
    socket.data.isBot = true;
    bots.add(socket.id);
    // Generate random profile for this bot session
    const profile = randomBotProfile();
    const personaIdx = Math.floor(Math.random() * botPersonas.length);
    profile.style = botPersonas[personaIdx].style;
    botProfiles.set(socket.id, profile);
    console.log(`>>> ${socket.id} registered as bot - ${profile.name}, ${profile.age}, ${profile.location}`);
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
    
    // Get all available people (not paired, not self, not last partner)
    const availableUsers = [];
    const availableBots = [];
    
    for (const otherSocket of io.sockets.sockets.values()) {
      const sid = otherSocket.id;
      if (sid === socket.id) continue; // skip self
      if (pairs.has(sid)) continue; // skip already paired
      if (lastPartner.get(socket.id) === sid) continue; // skip last partner
      
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
      
      const isMatchWithBot = bots.has(otherId);
      io.to(socket.id).emit('matched', { otherId, initiator: true, isBot: isMatchWithBot });
      io.to(otherId).emit('matched', { otherId: socket.id, initiator: false });
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
    if (dest) dest.emit('chat-message', { from: socket.id, text });
  });

  socket.on('next', () => {
    console.log('>>> next event received from', socket.id);
    const partner = pairs.get(socket.id);
    
    if (partner) {
      // Remember who we just disconnected from
      lastPartner.set(socket.id, partner);
      console.log(`>>> set lastPartner: ${socket.id} -> ${partner}`);
      
      // notify partner
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      io.to(partner).emit('peer-left', { id: socket.id, reason: 'peer-requested-next' });
      io.to(socket.id).emit('peer-disconnected', { id: partner });
      io.to(socket.id).emit('peer-left', { id: partner, reason: 'you-left' });
      
      pairs.delete(socket.id);
      pairs.delete(partner);
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      pairs.delete(partner);
      pairs.delete(socket.id);
    }
    bots.delete(socket.id);
    botProfiles.delete(socket.id); // Clean up bot profile
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  
  // Start bots automatically
  console.log('Starting AI bots...');
  const botsProcess = spawn('node', ['bots.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  botsProcess.on('error', (err) => {
    console.error('Failed to start bots:', err);
  });
  
  // Clean up bots when server stops
  process.on('SIGINT', () => {
    console.log('\nShutting down server and bots...');
    botsProcess.kill();
    process.exit(0);
  });
});
