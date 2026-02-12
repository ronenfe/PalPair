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

// Ollama helper function
async function getOllamaResponse(userMessage, profile) {
  try {
    const personaName = profile?.name || 'Sarah';
    const personaAge = profile?.age || 25;
    const personaLocation = profile?.countryName || 'United States';
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
const userProfiles = new Map(); // socket -> {profile: {name, age, gender, country}, filters: {...}}
const searching = new Set(); // track which sockets are actively searching for a match

io.on('connection', (socket) => {
  console.log('connected', socket.id);
  
  // Handle profile setting
  socket.on('set-profile', ({ profile, filters }) => {
    userProfiles.set(socket.id, { profile, filters });
    console.log(`Profile set for ${socket.id}:`, profile, 'Filters:', filters);
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

  socket.on('stop-searching', () => {
    console.log('>>> stop-searching event received from', socket.id);
    searching.delete(socket.id);
    console.log(`>>> removed ${socket.id} from searching pool`);
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
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
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
    bots.delete(socket.id);
    botProfiles.delete(socket.id); // Clean up bot profile
    userProfiles.delete(socket.id); // Clean up user profile
    searching.delete(socket.id); // Clean up searching state
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
