// Generate or retrieve persistent user ID
function getPersistentUserId() {
  let userId = localStorage.getItem('flashlive_userId') || localStorage.getItem('palpair_userId');
  if (!userId) {
    userId = 'u_' + crypto.randomUUID();
    localStorage.setItem('flashlive_userId', userId);
  }
  return userId;
}
const persistentUserId = getPersistentUserId();

const socket = io({ auth: { userId: persistentUserId } });
console.log('Socket.IO client initialized, userId:', persistentUserId);

const i18n = window.FLASHLIVE_I18N;
const translate = i18n ? i18n.t : (key, params = {}) => {
  const dictionary = {
    alertFillProfile: 'Please fill in all profile fields',
    alertAgeRange: 'Age must be between 18 and 100',
    alertMinMax: 'Minimum age cannot be greater than maximum age',
    statusFindingPartner: 'Finding partner...',
    statusCameraError: 'Could not start camera',
    statusStopped: 'Stopped',
    statusFindingNext: 'Finding next...',
    statusWaiting: 'Waiting for a partner...',
    statusConnected: 'Connected',
    statusConnectedBot: 'Connected to {name}, {age}, from {country}',
    reportPrompt: 'Report safety concern (child safety, harassment, explicit content, etc.). Please include useful details:',
    reportSubmitted: 'Safety report submitted. Thank you for helping keep FlashLive safe.',
    start: 'Start',
    stop: 'Stop'
  };
  let text = dictionary[key] || key;
  Object.keys(params).forEach((paramName) => {
    text = text.replaceAll(`{${paramName}}`, String(params[paramName]));
  });
  return text;
};

// Shared AudioContext — warmed up on first user gesture
let _audioCtx = null;
async function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') await _audioCtx.resume();
  return _audioCtx;
}
// Unlock on first interaction
function _unlockAudio() { getAudioCtx(); }
document.addEventListener('click', _unlockAudio, { once: true });
document.addEventListener('keydown', _unlockAudio, { once: true });
document.addEventListener('touchstart', _unlockAudio, { once: true });

// Ascending two-tone "ding" played when a partner joins
async function playMatchSound() {
  try {
    const ctx = await getAudioCtx();
    [[880, 0, 0.15], [1320, 0.16, 0.32]].forEach(([freq, start, end]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + end);
    });
  } catch (e) { console.log('playMatchSound error:', e); }
}

// Short blip sound for incoming messages
async function playMessageSound() {
  try {
    const ctx = await getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) { console.log('playMessageSound error:', e); }
}

socket.on('connect', () => console.log('Connected to server'));
socket.on('disconnect', (reason) => console.log('Disconnected from server:', reason));

// Update user counter (real users + bots)
socket.on('user-count', ({ total = 0, humans = 0, bots = 0 }) => {
  const userCountEl = document.getElementById('userCount');
  if (userCountEl) {
    userCountEl.textContent = total || (humans + bots);
  }
});

async function refreshUserCountFallback() {
  try {
    const response = await fetch('/api/debug', { cache: 'no-store' });
    if (!response.ok) return;

    const payload = await response.json();
    const userCountEl = document.getElementById('userCount');
    if (userCountEl) {
      userCountEl.textContent = payload.totalConnected || ((payload.users || 0) + (payload.bots || 0));
    }
  } catch (error) {
    // ignore fallback polling errors
  }
}

setInterval(refreshUserCountFallback, 3000);
refreshUserCountFallback();

// Profile form elements
const profileContainer = document.getElementById('profileContainer');
const profileForm = document.getElementById('profileForm');
const chatInterface = document.getElementById('chatInterface');
const privateChatInterface = document.getElementById('privateChatInterface');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const userCounterWrap = document.getElementById('userCounter');

const goRandomBtn = document.getElementById('goRandomBtn');
const stopRandomBtn = document.getElementById('stopRandomBtn');
const nextBtn = document.getElementById('nextBtn');
const reportBtn = document.getElementById('reportBtn');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const statusEl = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const aiPartnerBadge = document.getElementById('aiPartnerBadge');
const chatContainer = document.querySelector('.chat-container');

// Chat elements
// Chat history buffers
let publicChatHistory = '';
let privateChatHistory = '';
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const privateChatMessages = document.getElementById('privateChatMessages');
const onlineUsersList = document.getElementById('onlineUsersList');
const onlineUsersPanel = document.getElementById('onlineUsersPanel');
const usersToggleBtn = document.getElementById('usersToggleBtn');
const publicChatSection = document.getElementById('publicChatSection');
const privateChatSection = document.getElementById('privateChatSection');
const chatModeLabel = document.getElementById('chatModeLabel');
const chatModeSub = document.getElementById('chatModeSub');
const privateChatInput = document.getElementById('privateChatInput');
const privateSendBtn = document.getElementById('privateSendBtn');

// DM panel elements
const dmPanel = document.getElementById('dmPanel');
const dmMessages = document.getElementById('dmMessages');
const dmInput = document.getElementById('dmInput');
const dmSendBtn = document.getElementById('dmSendBtn');
const dmPartnerName = document.getElementById('dmPartnerName');
const dmBackBtn = document.getElementById('dmBackBtn');
const dmCloseBtn = document.getElementById('dmCloseBtn');
let currentDmPartnerId = null;
let currentDmPartnerDisplayName = '';
const dmConversations = new Map(); // partnerId -> [{from, fromName, text, timestamp}]
const dmUnread = new Map(); // partnerId -> count
const AI_PARTNER_LABEL = '🤖 AI Partner';

// Public stream elements
const goLiveBtn = document.getElementById('goLiveBtn');
const publicStreamArea = document.getElementById('publicStreamArea');
const publicStreamVideo = document.getElementById('publicStreamVideo');
const publicStreamName = document.getElementById('publicStreamName');
const publicStreamViewerCount = document.getElementById('publicStreamViewerCount');
const ttOverlayViewers= document.getElementById('ttOverlayViewers');
const ttViewerPopup   = document.getElementById('ttViewerPopup');
const ttViewerList    = document.getElementById('ttViewerList');
const nextStreamerBtn = document.getElementById('nextStreamerBtn');
const hideStreamBtn = document.getElementById('hideStreamBtn');
const coinCountEl = document.getElementById('coinCount');
const coinBalanceEl = document.getElementById('coinBalance');
let streamHiddenByUser = false;
let myCoins = 0;

// Streamers discovery grid elements
const streamersGrid = document.getElementById('streamersGrid');
const streamersCards = document.getElementById('streamersCards');
const streamersCountEl = document.getElementById('streamersCount');
const noStreamersMsg = document.getElementById('noStreamersMsg');
const collapseGridBtn = document.getElementById('collapseGridBtn');
let lastKnownStreamers = [];

// TikTok feed elements (declared here to avoid TDZ when enterTtMode is called early)
const ttFeed          = document.getElementById('ttFeed');
const ttSlideContainer= document.getElementById('ttSlideContainer');
const ttEmptyEl       = document.getElementById('ttEmpty');
const ttOverlayName   = document.getElementById('ttOverlayName');
const ttChatEl        = document.getElementById('ttChat');
const ttInputEl       = document.getElementById('ttInput');
const ttSendBtnEl     = document.getElementById('ttSendBtn');
const ttPrevBtnEl     = document.getElementById('ttPrevBtn');
const ttNextBtnEl     = document.getElementById('ttNextBtn');
const ttDotsEl        = document.getElementById('ttDots');
const ttCoinCountEl   = document.getElementById('ttCoinCount');

// Collapse / expand streamers grid
if (collapseGridBtn && streamersCards) {
  collapseGridBtn.addEventListener('click', () => {
    const collapsed = streamersCards.classList.toggle('collapsed');
    collapseGridBtn.classList.toggle('collapsed', collapsed);
    collapseGridBtn.title = collapsed ? 'Expand' : 'Collapse';
  });
}

// Online users panel toggle
if (usersToggleBtn && onlineUsersPanel) {
  usersToggleBtn.addEventListener('click', () => {
    onlineUsersPanel.classList.toggle('open');
  });
}

function syncViewportHeight() {
  const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight);
  const appHeight = Math.round(viewportHeight * 0.95);
  document.documentElement.style.setProperty('--app-height', `${appHeight}px`);

  let chatScale = 0.9;
  if (viewportHeight <= 700) {
    chatScale = 0.82;
  } else if (viewportHeight <= 820) {
    chatScale = 0.86;
  }
  document.documentElement.style.setProperty('--chat-scale', String(chatScale));
}

syncViewportHeight();
window.addEventListener('resize', syncViewportHeight);
window.addEventListener('orientationchange', () => {
  setTimeout(syncViewportHeight, 120);
});

// Initialize video display state
if (remoteVideo) remoteVideo.style.display = 'none';
if (remotePlaceholder) {
  remotePlaceholder.style.display = 'block';
}

let localStream = null;
let pc = null;
let isActive = false;
let useFrontCamera = true; // true = front (user), false = rear (environment)
const pendingPublicMessageIds = new Set();

// Public stream state
let isStreaming = false;
let publicStreamLocalStream = null;
const publicStreamPCs = new Map(); // viewerId → RTCPeerConnection (streamer-side)

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:129.159.135.182:3478' },
    {
      urls: [
        'turn:129.159.135.182:3478?transport=udp',
        'turn:129.159.135.182:3478?transport=tcp'
      ],
      username: 'flashlive',
      credential: 'TurnRelay2026!'
    },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
let publicStreamViewerPC = null;    // single PC for viewer-side
let currentWatchingStreamerId = null;
let isStreamMuted = localStorage.getItem('streamMuted') === 'true';
let pendingWatchByIdActive = false;

// Beautify filter state
let isBeautifyOn = false;
let isLongLegsOn = false;
let beautifyRaf = null;
let beautifyHiddenVid = null;
let beautifyCanvas = null;
let beautifyCanvasStream = null;

// User profile and filters
let userProfile = null;
let userFilters = null;
let profileReady = false; // true only after user submits the login form

// Load saved form values from localStorage
function loadSavedFormValues() {
  const saved = localStorage.getItem('videochatProfile');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.name) document.getElementById('userName').value = data.name;
      if (data.age) document.getElementById('userAge').value = data.age;
      if (data.gender) document.getElementById('userGender').value = data.gender;
      if (data.country) document.getElementById('userCountry').value = data.country;
      if (data.minAge) document.getElementById('minAge').value = data.minAge;
      if (data.maxAge) document.getElementById('maxAge').value = data.maxAge;
      if (data.filterGender) document.getElementById('filterGender').value = data.filterGender;
      if (data.filterCountry) document.getElementById('filterCountry').value = data.filterCountry;
    } catch (e) {
      console.error('Error loading saved profile:', e);
    }
  }
}

// Load saved values when page loads
loadSavedFormValues();

// Profile form handler
const profileError = document.getElementById('profileError');
function showProfileError(msg) {
  if (profileError) {
    profileError.textContent = msg;
    profileError.style.display = 'block';
    profileError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
function clearProfileError() {
  if (profileError) profileError.style.display = 'none';
}

saveProfileBtn.addEventListener('click', () => {
  clearProfileError();
  const name = document.getElementById('userName').value.trim();
  const age = parseInt(document.getElementById('userAge').value);
  const gender = document.getElementById('userGender').value;
  const country = document.getElementById('userCountry').value;
  const minAge = parseInt(document.getElementById('minAge').value);
  const maxAge = parseInt(document.getElementById('maxAge').value);
  const filterGender = document.getElementById('filterGender').value;
  const filterCountry = document.getElementById('filterCountry').value;

  // Validation
  if (!name || !age || !gender || !country) {
    showProfileError(translate('alertFillProfile'));
    return;
  }

  if (age < 18 || age > 100) {
    showProfileError(translate('alertAgeRange'));
    return;
  }

  if (minAge > maxAge) {
    showProfileError(translate('alertMinMax'));
    return;
  }

  // Save to localStorage
  localStorage.setItem('videochatProfile', JSON.stringify({
    name,
    age,
    gender,
    country,
    minAge,
    maxAge,
    filterGender,
    filterCountry
  }));

  // Save profile
  userProfile = { name, age, gender, country };
  userFilters = {
    minAge,
    maxAge,
    gender: filterGender,
    country: filterCountry
  };

  // Send profile to server
  socket.emit('set-profile', { profile: userProfile, filters: userFilters });
  profileReady = true;

  // Show chat interface and hide profile view
  if (profileContainer) {
    profileContainer.style.display = 'none';
  } else if (profileForm) {
    profileForm.style.display = 'none';
  }
  chatInterface.style.display = 'flex';
  document.body.classList.add('chat-active');
  setRandomMode(false);
  enterTtMode();
  chatInput.disabled = false;
  sendBtn.disabled = false;
  status('');

  // ── If user arrived via ?watch= link, start watching that stream now ──
  if (pendingWatchId) {
    const wid = pendingWatchId;
    pendingWatchId = null;
    pendingWatchByIdActive = true;
    socket.emit('watch-public-stream-by-id', { streamerId: wid });
  }
});
let otherId = null;
let isRunning = false;
let isChatCollapsed = true;
let localNextInProgress = false;

function setChatCollapsed(collapsed) {
    // Always enable send button when chat is visible
    if (chatInterface && chatInterface.style.display !== 'none') {
      sendBtn.disabled = false;
      chatInput.disabled = false;
    }
  isChatCollapsed = collapsed;
  // Toggle collapsed class on the correct interface
  if (isRunning && privateChatInterface) {
    privateChatInterface.classList.toggle('chat-collapsed', collapsed);
  } else if (chatInterface) {
    chatInterface.classList.toggle('chat-collapsed', collapsed);
  }
  if (chatToggleBtn) {
    chatToggleBtn.textContent = '💬';
    chatToggleBtn.setAttribute('aria-label', collapsed ? 'Expand chat' : 'Collapse chat');
    chatToggleBtn.setAttribute('title', collapsed ? 'Expand Chat' : 'Collapse Chat');
  }
  // Switch chat context: show/hide correct chat div
  if (!collapsed) {
    if (isRunning) {
      chatMessages.style.display = 'none';
      privateChatMessages.style.display = 'block';
    } else {
      chatMessages.style.display = 'block';
      if (privateChatMessages) privateChatMessages.style.display = 'none';
      chatMessages.innerHTML = publicChatHistory;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
}

function setRandomMode(active) {
  if (!active) {
    isRunning = false;
    enterTtMode();
    document.body.classList.remove('random-active');
  } else {
    isRunning = true;
    exitTtMode();
    document.body.classList.add('random-active');
  }

  // Switch between public chat interface and private chat interface
  if (active) {
    // Stop public stream if active
    if (isStreaming) stopPublicStream();
    // Stop watching if viewing
    if (currentWatchingStreamerId) {
      socket.emit('stop-watching-public-stream');
      currentWatchingStreamerId = null;
      if (publicStreamViewerPC) { publicStreamViewerPC.close(); publicStreamViewerPC = null; }
    }
    if (publicStreamArea) publicStreamArea.style.display = 'none';
    if (streamersGrid) streamersGrid.style.display = 'none';
    streamHiddenByUser = false; // reset so stream auto-shows when returning

    chatInterface.style.display = 'none';
    if (privateChatInterface) {
      privateChatInterface.style.display = 'flex';
      privateChatInterface.classList.toggle('chat-collapsed', isChatCollapsed);
    }
    // Show private messages, hide public
    chatMessages.style.display = 'none';
    if (privateChatMessages) privateChatMessages.style.display = 'block';
    // Clear private chat for fresh start
    privateChatHistory = '';
    if (privateChatMessages) privateChatMessages.innerHTML = '';
    // Enable private chat input
    if (privateChatInput) privateChatInput.disabled = false;
    if (privateSendBtn) privateSendBtn.disabled = false;
    if (chatModeLabel) chatModeLabel.textContent = 'Private random chat';
    if (chatModeSub) chatModeSub.textContent = '1:1 video chat with a random partner';
  } else {
    chatInterface.style.display = 'flex';
    if (privateChatInterface) privateChatInterface.style.display = 'none';
    // Show public messages, hide private
    chatMessages.style.display = 'block';
    if (privateChatMessages) privateChatMessages.style.display = 'none';
    chatMessages.innerHTML = publicChatHistory;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    // Disable private chat input
    if (privateChatInput) { privateChatInput.disabled = true; privateChatInput.value = ''; }
    if (privateSendBtn) privateSendBtn.disabled = true;
    // Re-check for active public streamers when stopping random mode
    if (streamersGrid) streamersGrid.style.display = '';
    socket.emit('request-public-streamers');
  }

  if (goRandomBtn) {
    goRandomBtn.style.display = active ? 'none' : '';
  }
  if (goLiveBtn) {
    goLiveBtn.style.display = active ? 'none' : '';
  }
  if (stopRandomBtn) {
    stopRandomBtn.style.display = active ? 'flex' : 'none';
  }

  if (!active) {
    if (nextBtn) nextBtn.disabled = true;
    if (reportBtn) reportBtn.disabled = true;
    if (pc) {
      pc.close();
      pc = null;
    }
    otherId = null;
    clearRemoteVideo();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    if (localVideo) localVideo.srcObject = null;
    setAiPartnerBadge(false);
  }
}

function setAiPartnerBadge(visible) {
  if (!aiPartnerBadge) return;
  aiPartnerBadge.style.display = visible ? 'inline-flex' : 'none';
}

function stopRandomMode({ notifyPartner = false, notifySearching = true, statusText = '' } = {}) {
  if (!isRunning) return;

  if (notifyPartner && otherId) {
    socket.emit('next');
  }
  if (notifySearching) {
    socket.emit('stop-searching');
  }

  setRandomMode(false);
  status(statusText);
}

if (chatToggleBtn) {
  chatToggleBtn.onclick = () => {
    setChatCollapsed(!isChatCollapsed);
  };
}

if (goRandomBtn) {
  goRandomBtn.onclick = async () => {
    if (!isRunning) {
      try {
        otherId = null;
        setRandomMode(true);
        nextBtn.disabled = true;
        reportBtn.disabled = false;

        localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: useFrontCamera ? 'user' : 'environment' }, audio: true });
        localVideo.srcObject = localStream;
        
        // Ensure remote video is hidden when starting
        if (remoteVideo) remoteVideo.style.display = 'none';
        if (remotePlaceholder) {
          remotePlaceholder.style.display = 'block';
        }

        status(translate('statusFindingPartner'));
        socket.emit('find');
      } catch (e) {
        console.error(e);
        setRandomMode(false);
        status(translate('statusCameraError'));
      }
    }
  };
}

if (stopRandomBtn) {
  stopRandomBtn.onclick = () => {
    stopRandomMode({ notifyPartner: true, notifySearching: true });
  };
}

if (nextBtn) nextBtn.onclick = () => {
  if (!isRunning) return;
  // Find next partner while already connected
  console.log('>>> Find Next button clicked, otherId:', otherId);
  localNextInProgress = true;
  // Clear private chat for new match
  privateChatHistory = '';
  if (privateChatMessages) privateChatMessages.innerHTML = '';
  status(translate('statusFindingNext'));
  socket.emit('next');
  if (pc) pc.close();
  pc = null;
  otherId = null;
  if (nextBtn) nextBtn.disabled = true;
  clearRemoteVideo();
  socket.emit('find');
};


socket.on('waiting', () => {
  localNextInProgress = false;
  if (!isRunning) {
    status('');
    return;
  }
  setAiPartnerBadge(false);
  console.log('>>> waiting event received');
  status(translate('statusWaiting'));
});

// ── Per-streamer chat room events ──
socket.on('stream-chat-init', ({ streamerId, events = [] } = {}) => {
  clearChat();
  events.forEach((event) => addPublicRoomEvent(event));
});

socket.on('stream-chat-event', ({ streamerId, event } = {}) => {
  addPublicRoomEvent(event);
  if (event && event.socketId !== socket.id && event.type !== 'system' && event.type !== 'tip') playMessageSound();
});

socket.on('stream-room-users', ({ streamerId, users = [] } = {}) => {
  renderOnlineUsers(users);
  renderTtViewerList(users);
});

// Ignore global online-users when in a stream room — room-scoped events handle it
socket.on('online-users', ({ users = [] } = {}) => {
  // Only render if not currently in a stream room
  if (!currentWatchingStreamerId) {
    renderOnlineUsers(users);
  }
});

socket.on('matched', async ({ otherId: id, initiator, isBot, botProfile, botVideoUrl, partnerProfile }) => {
  localNextInProgress = false;
  if (!isRunning) {
    status('');
    return;
  }
  console.log('>>> Matched event received, otherId:', id, 'initiator:', initiator, 'isBot:', isBot);
  
  // Clear private chat for fresh conversation
  privateChatHistory = '';
  if (privateChatMessages) privateChatMessages.innerHTML = '';
  
  // Play sound notification
  playMatchSound();
  
  // Close old peer connection if exists
  if (pc) {
    pc.close();
    pc = null;
  }
  clearRemoteVideo();
  
  // Ensure remote video is hidden until track arrives
  if (remoteVideo) remoteVideo.style.display = 'none';
  if (remotePlaceholder) {
    remotePlaceholder.innerHTML = '';
    remotePlaceholder.style.display = 'block';
  }
  
  otherId = id;
  nextBtn.disabled = false;
  setAiPartnerBadge(!!isBot);
  console.log('>>> Setting status to Connected');

  if (isBot) {
    const source = partnerProfile || botProfile;
    const details = source
      ? translate('statusConnectedBot', {
          name: source.name,
          age: source.age,
          country: source.country
        })
      : translate('statusConnected');
    status(`${AI_PARTNER_LABEL} · ${details}`);
  } else if (partnerProfile) {
    status(translate('statusConnectedBot', {
      name: partnerProfile.name,
      age: partnerProfile.age,
      country: partnerProfile.country
    }));
  } else {
    status(translate('statusConnected'));
  }
  
  // stop any pending auto-reconnect attempts
  cancelAutoReconnect();
  
  // If matched with a bot, play video directly (no WebRTC needed)
  if (botVideoUrl) {
    remoteVideo.srcObject = null;
    remoteVideo.src = botVideoUrl;
    remoteVideo.loop = false;
    remoteVideo.style.display = 'block';
    if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    remoteVideo.play().catch(e => console.log('Bot video play failed:', e));
  } else {
    // Show partner profile card in placeholder while WebRTC negotiates
    if (remotePlaceholder && partnerProfile) {
      const genderEmoji = partnerProfile.gender === 'female' ? '👩' : partnerProfile.gender === 'male' ? '👨' : '🧑';
      remotePlaceholder.innerHTML = `
        <div class="partner-preview-card">
          <div class="partner-preview-avatar">${genderEmoji}</div>
          <div class="partner-preview-name">${String(partnerProfile.name || '').slice(0, 30)}</div>
          <div class="partner-preview-meta">${partnerProfile.age ? partnerProfile.age + ' · ' : ''}${String(partnerProfile.country || '').slice(0, 30)}</div>
          <div class="partner-preview-connecting">Connecting…</div>
        </div>`;
    }
    // Create peer connection for real users
    await createPeerConnection(id, initiator);
  }
});

socket.on('signal', async ({ from, data }) => {
  if (!isRunning) return;
  console.log('>>> signal received from', from, 'type:', data.type);
  if (data.type === 'offer') {
    if (!pc) await createPeerConnection(from, false);
    console.log('>>> setting remote description (offer)');
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    console.log('>>> creating answer');
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('>>> sending answer');
    socket.emit('signal', { to: from, data: { type: 'answer', sdp: pc.localDescription } });
  } else if (data.type === 'answer') {
    console.log('>>> setting remote description (answer)');
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } else if (data.type === 'candidate') {
    try { 
      console.log('>>> adding ice candidate');
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); 
    } catch (e) { console.warn(e); }
  }
});

socket.on('peer-disconnected', ({ id }) => {
  if (localNextInProgress) {
    return;
  }
  if (!isRunning) {
    status('');
    return;
  }
  console.log('*** peer-disconnected event received from', id, '***');
  stopRandomMode({ notifyPartner: false, notifySearching: false });
});

// some server flows emit `peer-left` to ensure clients handle forced leaves
socket.on('peer-left', ({ id, reason }) => {
  if (localNextInProgress) {
    return;
  }
  if (!isRunning) {
    status('');
    return;
  }
  console.log('*** peer-left event received *** id:', id, 'reason:', reason);
  stopRandomMode({ notifyPartner: false, notifySearching: false });
});

// Chat events
socket.on('chat-message', ({ from, text }) => {
  addChatMessage(text, 'remote');
  playMessageSound();
});

socket.on('report-received', () => {
  addChatMessage(translate('reportSubmitted'), 'system');
});

if (reportBtn) reportBtn.onclick = () => {
  const details = prompt(translate('reportPrompt'));
  if (!details || !details.trim()) return;

  socket.emit('report-safety', {
    details: details.trim(),
    partnerId: otherId,
    statusText: statusEl.textContent
  });
};

sendBtn.onclick = () => {
  const text = chatInput.value.trim();
  if (!text) return;

  if (!isRunning) {
    const clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingPublicMessageIds.add(clientMsgId);
    addChatMessage(text, 'local');
    socket.emit('public-chat-message', { text, clientMsgId });
    chatInput.value = '';
  }
};

chatInput.onkeypress = (e) => {
  if (e.key === 'Enter') {
    sendBtn.onclick();
  }
};

// Private chat send
function sendPrivateMessage() {
  if (!privateChatInput) return;
  const text = privateChatInput.value.trim();
  if (!text || !isRunning || !otherId) return;
  socket.emit('chat-message', { to: otherId, text });
  addChatMessage(text, 'local');
  privateChatInput.value = '';
}

if (privateSendBtn) {
  privateSendBtn.onclick = sendPrivateMessage;
}

if (privateChatInput) {
  privateChatInput.onkeypress = (e) => {
    if (e.key === 'Enter') sendPrivateMessage();
  };
}


function cancelAutoReconnect() {
  // no-op
}

function clearRemoteVideo() {
  try {
    const s = remoteVideo.srcObject;
    if (s && s.getTracks) {
      s.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) { /* ignore */ }
      });
    }
  } catch (e) {
    // ignore
  }
  try {
    // also stop any receiver tracks on the RTCPeerConnection (defensive)
    try {
      if (pc && pc.getReceivers) {
        pc.getReceivers().forEach((r) => { if (r && r.track) { try { r.track.stop(); } catch (e) {} } });
      }
    } catch (e) { /* ignore */ }

    // hide video element and show black placeholder to avoid frozen frame
    try { remoteVideo.pause(); } catch (e) {}
    try { remoteVideo.removeAttribute('src'); } catch (e) {}
    try { remoteVideo.srcObject = null; } catch (e) {}
    try { remoteVideo.muted = false; remoteVideo.loop = false; } catch (e) {}
    try { remoteVideo.load(); } catch (e) {} // reset media state machine so next srcObject assignment works
    try { remoteVideo.style.display = 'none'; } catch (e) {}
    try { remoteVideo.style.backgroundColor = '#000'; } catch (e) {}
    setAiPartnerBadge(false);
    if (remotePlaceholder) {
      try { remotePlaceholder.innerHTML = ''; } catch (e) {}
      try { remotePlaceholder.style.display = 'block'; } catch (e) {}
    }
  } catch (e) {
    // ignore
  }
}

// ── Flip Camera ──
const flipCameraBtn = document.getElementById('flipCameraBtn');
if (flipCameraBtn) {
  flipCameraBtn.onclick = async () => {
    if (!localStream) return;
    useFrontCamera = !useFrontCamera;
    try {
      // Get new stream with the other camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? 'user' : 'environment' },
        audio: true
      });
      // Replace video track in peer connection
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (pc) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(newVideoTrack);
      }
      // Stop old video tracks (keep audio from old stream)
      localStream.getVideoTracks().forEach(t => t.stop());
      // Replace video track in localStream
      localStream.removeTrack(localStream.getVideoTracks()[0]);
      localStream.addTrack(newVideoTrack);
      // Stop new audio track since we keep the original
      newStream.getAudioTracks().forEach(t => t.stop());
      // Update local preview
      localVideo.srcObject = localStream;
    } catch (e) {
      console.error('Failed to flip camera:', e);
      useFrontCamera = !useFrontCamera; // revert
    }
  };
}

async function createPeerConnection(targetId, initiator) {
  pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', { to: targetId, data: { type: 'candidate', candidate: e.candidate } });
    }
  };

  pc.ontrack = (e) => {
    console.log('>>> ontrack event received', e.track.kind);
    if (e.streams && e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
    } else {
      // Unified Plan: track not attached to a named stream — build one manually
      if (!remoteVideo.srcObject || !(remoteVideo.srcObject instanceof MediaStream)) {
        remoteVideo.srcObject = new MediaStream();
      }
      remoteVideo.srcObject.addTrack(e.track);
    }
    remoteVideo.style.display = 'block';
    if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    remoteVideo.play().catch(() => {});
  };

  // Add local tracks FIRST
  if (localStream) {
    localStream.getTracks().forEach((t) => {
      console.log('>>> adding track:', t.kind);
      pc.addTrack(t, localStream);
    });
  }

  // Then create offer if initiator
  if (initiator) {
    console.log('>>> creating offer as initiator');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { to: targetId, data: { type: 'offer', sdp: pc.localDescription } });
  }
}

function status(s) {
  console.log('>>> STATUS:', s);
  if (!statusEl) return;
  if (!s) {
    statusEl.style.display = 'none';
  } else {
    statusEl.style.display = '';
    statusEl.textContent = s;
  }
}

function addPublicRoomEvent(event = {}) {
  if (!event || !event.text) return;

  if (event.clientMsgId && event.socketId === socket.id && pendingPublicMessageIds.has(event.clientMsgId)) {
    pendingPublicMessageIds.delete(event.clientMsgId);
    return;
  }

  if (event.type === 'system') {
    addChatMessage(event.text, 'system', 'public', event.timestamp);
    return;
  }

  if (event.type === 'tip') {
    addChatMessage(event.text, 'tip', 'public', event.timestamp);
    return;
  }

  const isMine = event.socketId === socket.id;
  const sender = isMine ? 'local' : 'remote';
  const prefix = isMine ? '' : `${event.name || 'Guest'}: `;
  addChatMessage(`${prefix}${event.text}`, sender, 'public', event.timestamp);
}

function addChatMessage(text, sender, target, serverTimestamp) {
  const div = document.createElement('div');
  div.className = `chat-message ${sender}`;
  // Use correct chat div
  let targetDiv;
  if (target === 'public') {
    targetDiv = chatMessages;
  } else if (target === 'private') {
    targetDiv = privateChatMessages;
  } else {
    targetDiv = (isRunning && otherId) ? privateChatMessages : chatMessages;
  }

  const messageText = String(text || '');

  // Timestamp — use server timestamp if available, else current time
  const ts = serverTimestamp ? new Date(serverTimestamp) : new Date();
  const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-timestamp';
  timeSpan.textContent = timeStr;

  // Always set full content BEFORE appending to DOM.
  // This prevents the MutationObserver (mirrorTtChat) from ever seeing an empty div.
  div.textContent = messageText;
  div.appendChild(timeSpan);
  targetDiv.appendChild(div);

  // Update chat history buffer
  if (targetDiv === chatMessages) {
    publicChatHistory += div.outerHTML;
  } else {
    privateChatHistory += div.outerHTML;
  }
  requestAnimationFrame(() => { targetDiv.scrollTop = targetDiv.scrollHeight; });
}

function clearChat() {
  if (chatMessages) chatMessages.innerHTML = '';
  if (privateChatMessages) privateChatMessages.innerHTML = '';
  publicChatHistory = '';
  privateChatHistory = '';
  if (chatInput) chatInput.value = '';
  if (privateChatInput) privateChatInput.value = '';
}

function renderOnlineUsers(users = []) {
  if (!onlineUsersList) return;
  onlineUsersList.innerHTML = '';

  if (!users.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'online-user-item empty';
    emptyItem.textContent = currentWatchingStreamerId ? 'No viewers yet' : 'Select a streamer';
    onlineUsersList.appendChild(emptyItem);
    return;
  }

  users.forEach((user) => {
    if (user.isBot && user.socketId !== socket.id) return; // hide bots
    if (user.streaming && user.socketId !== socket.id) return; // streamer shown in feed, not list
    const item = document.createElement('li');
    item.className = 'online-user-item';

    const nameEl = document.createElement('span');
    nameEl.className = 'online-user-name';
    const genderValue = String(user.gender || '').toLowerCase();
    const genderEmoji = user.isBot ? '🤖' : (genderValue === 'male' ? '👨' : (genderValue === 'female' ? '👩‍🦰' : '👤'));
    const baseName = user.socketId === socket.id ? `${user.name} (You)` : user.name;
    nameEl.textContent = `${genderEmoji} ${baseName}`;

    const stateEl = document.createElement('span');
    stateEl.className = 'online-user-state';
    if (user.streaming) {
      stateEl.textContent = '📡 Broadcasting';
      stateEl.classList.add('state-broadcasting');
    } else if (user.paired) {
      stateEl.textContent = 'In random';
    } else if (user.searching) {
      stateEl.textContent = 'Searching';
    } else {
      stateEl.textContent = 'In room';
    }

    item.appendChild(nameEl);
    item.appendChild(stateEl);

    // Click on a broadcasting user to switch to their stream
    if (user.streaming && user.socketId !== socket.id) {
      item.style.cursor = 'pointer';
      item.title = `Watch ${user.name}'s broadcast`;
      item.addEventListener('click', () => {
        socket.emit('watch-public-stream-by-id', { streamerId: user.socketId });
      });
    } else if (user.socketId !== socket.id) {
      // Click to open DM
      item.style.cursor = 'pointer';
      item.title = `Message ${user.name}`;
      item.addEventListener('click', () => {
        openDmPanel(user.socketId, user.name);
      });
    }

    // Show unread badge
    const unread = dmUnread.get(user.socketId) || 0;
    if (unread > 0 && user.socketId !== socket.id) {
      const badge = document.createElement('span');
      badge.className = 'dm-unread-badge';
      badge.textContent = unread > 99 ? '99+' : unread;
      item.appendChild(badge);
    }

    onlineUsersList.appendChild(item);
  });
}

function renderTtViewerList(users = []) {
  if (!ttViewerList) return;
  ttViewerList.innerHTML = '';
  const viewers = users.filter(u => !u.streaming && !u.isBot);
  if (!viewers.length) {
    const li = document.createElement('li');
    li.textContent = 'No viewers yet';
    li.style.color = 'rgba(255,255,255,.5)';
    ttViewerList.appendChild(li);
    return;
  }
  viewers.forEach(u => {
    const li = document.createElement('li');
    const gender = String(u.gender || '').toLowerCase();
    const emoji = u.isBot ? '🤖' : (gender === 'male' ? '👨' : (gender === 'female' ? '👩‍🦰' : '👤'));
    li.textContent = `${emoji} ${u.socketId === socket.id ? u.name + ' (You)' : u.name}`;
    if (u.socketId !== socket.id) {
      li.style.cursor = 'pointer';
      li.title = `Message ${u.name}`;
      li.addEventListener('click', () => {
        if (ttViewerPopup) ttViewerPopup.style.display = 'none';
        openDmPanel(u.socketId, u.name);
      });
    }
    ttViewerList.appendChild(li);
  });
}

// Toggle TT viewer popup on eye click
if (ttOverlayViewers && ttViewerPopup) {
  ttOverlayViewers.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = ttViewerPopup.style.display !== 'none';
    ttViewerPopup.style.display = isOpen ? 'none' : 'block';
  });
  // Close when clicking elsewhere in the overlay
  document.addEventListener('click', (e) => {
    if (ttViewerPopup && ttViewerPopup.style.display !== 'none') {
      if (!ttViewerPopup.contains(e.target) && e.target !== ttOverlayViewers) {
        ttViewerPopup.style.display = 'none';
      }
    }
  });
}

// ═══════════════════════════════════
//  Private Direct Messages (DM)
// ═══════════════════════════════════

function openDmPanel(partnerId, partnerName) {
  currentDmPartnerId = partnerId;
  currentDmPartnerDisplayName = partnerName;
  if (dmPartnerName) dmPartnerName.textContent = partnerName;
  // Clear unread
  dmUnread.delete(partnerId);
  // Render conversation history
  renderDmMessages();
  // Show panel
  if (dmPanel) dmPanel.classList.add('open');
  if (onlineUsersPanel) onlineUsersPanel.classList.remove('open');
  if (dmInput) { dmInput.disabled = false; dmInput.focus(); }
}

function closeDmPanel() {
  currentDmPartnerId = null;
  currentDmPartnerDisplayName = '';
  if (dmPanel) dmPanel.classList.remove('open');
}

function renderDmMessages() {
  if (!dmMessages) return;
  dmMessages.innerHTML = '';
  const msgs = dmConversations.get(currentDmPartnerId) || [];
  msgs.forEach(msg => {
    const el = document.createElement('div');
    const isSent = msg.from === socket.id;
    el.className = `dm-msg ${isSent ? 'sent' : 'received'}`;
    const senderEl = document.createElement('div');
    senderEl.className = 'dm-msg-sender';
    senderEl.textContent = isSent ? 'You' : (msg.fromName || 'User');
    const textEl = document.createElement('div');
    textEl.textContent = msg.text;
    el.appendChild(senderEl);
    el.appendChild(textEl);
    dmMessages.appendChild(el);
  });
  dmMessages.scrollTop = dmMessages.scrollHeight;
}

function addDmMessage(msg) {
  const partnerId = msg.from === socket.id ? msg.to : msg.from;
  if (!dmConversations.has(partnerId)) {
    dmConversations.set(partnerId, []);
  }
  const convo = dmConversations.get(partnerId);
  convo.push(msg);
  // Keep last 200 messages per conversation
  if (convo.length > 200) convo.shift();
  // If this conversation is open, re-render
  if (currentDmPartnerId === partnerId) {
    renderDmMessages();
  } else if (msg.from !== socket.id) {
    // Increment unread count
    dmUnread.set(partnerId, (dmUnread.get(partnerId) || 0) + 1);
  }
}

function sendDm() {
  if (!currentDmPartnerId || !dmInput) return;
  const text = dmInput.value.trim();
  if (!text) return;
  socket.emit('private-message', { to: currentDmPartnerId, text });
  dmInput.value = '';
  dmInput.focus();
}

// DM send button
if (dmSendBtn) dmSendBtn.addEventListener('click', sendDm);
if (dmInput) {
  dmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendDm(); }
  });
}
// DM back button → show users list
if (dmBackBtn) {
  dmBackBtn.addEventListener('click', () => {
    closeDmPanel();
    if (onlineUsersPanel) onlineUsersPanel.classList.add('open');
  });
}
// DM close button → close everything
if (dmCloseBtn) {
  dmCloseBtn.addEventListener('click', () => {
    closeDmPanel();
  });
}

// Receive private messages
socket.on('private-message', (msg) => {
  if (!msg || !msg.from || !msg.text) return;
  addDmMessage(msg);
  playMessageSound();
  // Auto-open the DM panel when a message arrives
  const partnerId = msg.from === socket.id ? msg.to : msg.from;
  const partnerName = msg.fromName || msg.toName || partnerId;
  if (!currentDmPartnerId) {
    openDmPanel(partnerId, partnerName);
  }
});

// ═══════════════════════════════════
//  Public Stream — Go Live / Watch
// ═══════════════════════════════════

// ── Go Live button ──
if (goLiveBtn) {
  goLiveBtn.onclick = async () => {
    if (isStreaming) {
      stopPublicStream();
    } else {
      await startPublicStream();
    }
  };
}

// ── Mute Mic (live broadcast) ──
const muteMicBtnLive = document.getElementById('muteMicBtnLive');
if (muteMicBtnLive) {
  muteMicBtnLive.onclick = () => {
    if (!publicStreamLocalStream) return;
    const audioTrack = publicStreamLocalStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    const muted = !audioTrack.enabled;
    muteMicBtnLive.textContent = '\uD83C\uDF99\uFE0F';
    muteMicBtnLive.classList.toggle('muted', muted);
    muteMicBtnLive.title = muted ? 'Unmute mic' : 'Mute mic';
  };
}

// ── Flip Camera (live broadcast) ──
const flipCameraBtnLive = document.getElementById('flipCameraBtnLive');
if (flipCameraBtnLive) {
  flipCameraBtnLive.onclick = async () => {
    if (!publicStreamLocalStream) return;
    useFrontCamera = !useFrontCamera;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? 'user' : 'environment' },
        audio: true
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      // Replace track in all viewer peer connections
      for (const [, viewerPC] of publicStreamPCs) {
        const sender = viewerPC.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(newVideoTrack);
      }
      // Stop old video tracks
      publicStreamLocalStream.getVideoTracks().forEach(t => t.stop());
      publicStreamLocalStream.removeTrack(publicStreamLocalStream.getVideoTracks()[0]);
      publicStreamLocalStream.addTrack(newVideoTrack);
      newStream.getAudioTracks().forEach(t => t.stop());
      // Update preview
      if (publicStreamVideo) publicStreamVideo.srcObject = publicStreamLocalStream;
    } catch (e) {
      console.error('Failed to flip camera (live):', e);
      useFrontCamera = !useFrontCamera;
    }
  };
}

let thumbnailInterval = null;

// ── Beautify / Longer-legs canvas processing ──
function startBeautifyProcessing() {
  if (!publicStreamLocalStream) return;
  const track = publicStreamLocalStream.getVideoTracks()[0];
  if (!track) return;
  const settings = track.getSettings();
  const W = settings.width || 640;
  const H = settings.height || 480;
  beautifyHiddenVid = document.createElement('video');
  beautifyHiddenVid.srcObject = publicStreamLocalStream;
  beautifyHiddenVid.muted = true;
  beautifyHiddenVid.setAttribute('playsinline', '');
  beautifyHiddenVid.play().catch(() => {});
  beautifyCanvas = document.createElement('canvas');
  beautifyCanvas.width = W;
  beautifyCanvas.height = H;
  const ctx = beautifyCanvas.getContext('2d');
  function drawFrame() {
    if (!beautifyHiddenVid) return;
    ctx.filter = isBeautifyOn
      ? 'blur(0.6px) brightness(1.08) contrast(0.88) saturate(1.12)'
      : 'none';
    if (isLongLegsOn) {
      // Split point in canvas output (where torso ends / legs begin)
      const splitY = Math.round(H * 0.52);
      // Source split: compress upper body slightly so legs can be stretched
      // within the same canvas height. legStretch = 1.18 (~18% longer).
      const sourceSplitY = Math.round(H - (H - splitY) / 1.18);
      // Upper body: source [0..sourceSplitY] → canvas [0..splitY]
      ctx.drawImage(beautifyHiddenVid, 0, 0, W, sourceSplitY, 0, 0, W, splitY);
      // Legs: source [sourceSplitY..H] → canvas [splitY..H] (stretched)
      ctx.drawImage(beautifyHiddenVid, 0, sourceSplitY, W, H - sourceSplitY, 0, splitY, W, H - splitY);
    } else {
      ctx.drawImage(beautifyHiddenVid, 0, 0, W, H);
    }
    beautifyRaf = requestAnimationFrame(drawFrame);
  }
  drawFrame();
  beautifyCanvasStream = beautifyCanvas.captureStream(30);
  const beautifiedTrack = beautifyCanvasStream.getVideoTracks()[0];
  for (const [, viewerPC] of publicStreamPCs) {
    const sender = viewerPC.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender && beautifiedTrack) sender.replaceTrack(beautifiedTrack).catch(() => {});
  }
  if (publicStreamVideo) publicStreamVideo.style.filter = isBeautifyOn ? 'brightness(1.08) contrast(0.88) saturate(1.12)' : '';
  const ttSelfVid = document.getElementById('ttSelfVideo');
  if (ttSelfVid) ttSelfVid.style.filter = isBeautifyOn ? 'brightness(1.08) contrast(0.88) saturate(1.12)' : '';
}

function stopBeautifyProcessing() {
  if (beautifyRaf) { cancelAnimationFrame(beautifyRaf); beautifyRaf = null; }
  if (beautifyHiddenVid) { beautifyHiddenVid.pause(); beautifyHiddenVid.srcObject = null; beautifyHiddenVid = null; }
  if (beautifyCanvasStream) { beautifyCanvasStream.getTracks().forEach(t => t.stop()); beautifyCanvasStream = null; }
  beautifyCanvas = null;
  if (publicStreamLocalStream) {
    const rawTrack = publicStreamLocalStream.getVideoTracks()[0];
    if (rawTrack) {
      for (const [, viewerPC] of publicStreamPCs) {
        const sender = viewerPC.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(rawTrack).catch(() => {});
      }
    }
  }
  if (publicStreamVideo) publicStreamVideo.style.filter = '';
  const ttSelfVid = document.getElementById('ttSelfVideo');
  if (ttSelfVid) ttSelfVid.style.filter = '';
}

function toggleBeautify() {
  isBeautifyOn = !isBeautifyOn;
  document.querySelectorAll('#beautifyBtnLive, #ttBeautifyBtn').forEach(btn => {
    btn.classList.toggle('active', isBeautifyOn);
  });
  if (isStreaming) {
    if (isBeautifyOn || isLongLegsOn) {
      if (beautifyCanvasStream) {
        // Pipeline already running — just update CSS filter on previews
        if (publicStreamVideo) publicStreamVideo.style.filter = 'brightness(1.08) contrast(0.88) saturate(1.12)';
        const ttSelfVid = document.getElementById('ttSelfVideo');
        if (ttSelfVid) ttSelfVid.style.filter = 'brightness(1.08) contrast(0.88) saturate(1.12)';
      } else {
        startBeautifyProcessing();
      }
    } else {
      stopBeautifyProcessing();
    }
  }
}

function toggleLongLegs() {
  isLongLegsOn = !isLongLegsOn;
  document.querySelectorAll('#longLegsBtnLive, #ttLongLegsBtn').forEach(btn => {
    btn.classList.toggle('active', isLongLegsOn);
  });
  if (isStreaming) {
    if (isBeautifyOn || isLongLegsOn) {
      if (!beautifyCanvasStream) startBeautifyProcessing();
    } else {
      stopBeautifyProcessing();
    }
  }
}

const beautifyBtnLive = document.getElementById('beautifyBtnLive');
if (beautifyBtnLive) beautifyBtnLive.onclick = toggleBeautify;
const ttBeautifyBtnEl = document.getElementById('ttBeautifyBtn');
if (ttBeautifyBtnEl) ttBeautifyBtnEl.onclick = toggleBeautify;
const longLegsBtnLive = document.getElementById('longLegsBtnLive');
if (longLegsBtnLive) longLegsBtnLive.onclick = toggleLongLegs;
const ttLongLegsBtnEl = document.getElementById('ttLongLegsBtn');
if (ttLongLegsBtnEl) ttLongLegsBtnEl.onclick = toggleLongLegs;

async function startPublicStream() {
  try {
    publicStreamLocalStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: useFrontCamera ? 'user' : 'environment' }, audio: true });
    isStreaming = true;
    goLiveBtn.textContent = translate('stopLive');
    goLiveBtn.classList.add('is-live');
    const ttGoLiveBtnEl = document.getElementById('ttGoLiveBtn');
    if (ttGoLiveBtnEl) ttGoLiveBtnEl.textContent = translate('stopLive');
    // Show own stream fullscreen (in tt-mode this covers the slide layer)
    if (publicStreamArea) publicStreamArea.style.display = 'flex';
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = publicStreamLocalStream;
      publicStreamVideo.muted = true; // mute own playback
    }
    if (publicStreamName) publicStreamName.textContent = 'You (Live)';
    if (flipCameraBtnLive) flipCameraBtnLive.style.display = 'flex';
    if (muteMicBtnLive) { muteMicBtnLive.style.display = 'flex'; muteMicBtnLive.textContent = '🎙️'; muteMicBtnLive.classList.remove('muted'); }
    { const el = document.getElementById('beautifyBtnLive'); if (el) el.style.display = 'flex'; }
    { const el = document.getElementById('ttBeautifyBtn'); if (el) el.style.display = 'inline-flex'; }
    { const el = document.getElementById('longLegsBtnLive'); if (el) el.style.display = 'flex'; }
    { const el = document.getElementById('ttLongLegsBtn'); if (el) el.style.display = 'inline-flex'; }
    if (isBeautifyOn || isLongLegsOn) startBeautifyProcessing();
    if (ttFeed) ttFeed.classList.add('tt-is-streaming');
    // In TikTok mode: show camera in the dedicated self-view element and pause slide videos
    if (ttActive) {
      const ttSelfVideo = document.getElementById('ttSelfVideo');
      if (ttSelfVideo) {
        ttSelfVideo.srcObject = publicStreamLocalStream;
        ttSelfVideo.style.display = '';
      }
      if (ttOverlayName) ttOverlayName.textContent = 'You (Live)';
      if (ttOverlayViewers) ttOverlayViewers.textContent = '� 0';
      const ttMuteMicBtnEl = document.getElementById('ttMuteMicBtn');
      if (ttMuteMicBtnEl) { ttMuteMicBtnEl.style.display = 'flex'; ttMuteMicBtnEl.textContent = '🎙️'; ttMuteMicBtnEl.classList.remove('muted'); }
      ttSlideEls.forEach(slide => {
        const v = slide.querySelector('video');
        if (v) v.pause();
      });
      // TT feed navigation to our own slot is handled by the isSelf public-stream-ready event from server
    }
    const shareBtn = document.getElementById('shareStreamBtn');
    if (shareBtn) shareBtn.style.display = 'inline-flex';
    const ttShareBtn = document.getElementById('ttShareBtn');
    if (ttShareBtn) ttShareBtn.style.display = 'inline-flex';
    // Hide nav arrows/dots and disable random buttons while broadcasting
    ttUpdateDots();
    if (goRandomBtn) goRandomBtn.disabled = true;
    const ttRandomEl2 = document.getElementById('ttRandomBtn');
    if (ttRandomEl2) ttRandomEl2.disabled = true;
    // If we were watching someone else, close that connection before going live
    if (publicStreamViewerPC) {
      publicStreamViewerPC.close();
      publicStreamViewerPC = null;
    }
    currentWatchingStreamerId = null;
    socket.emit('start-public-stream');
    // Start periodic thumbnail capture
    startThumbnailCapture();
  } catch (e) {
    console.error('Failed to start public stream:', e);
  }
}

function stopPublicStream() {
  isStreaming = false;
  goLiveBtn.textContent = translate('goLive');
  goLiveBtn.classList.remove('is-live');
  const ttGoLiveBtnEl = document.getElementById('ttGoLiveBtn');
  if (ttGoLiveBtnEl) ttGoLiveBtnEl.textContent = translate('goLive');
  if (flipCameraBtnLive) flipCameraBtnLive.style.display = 'none';
  if (muteMicBtnLive) { muteMicBtnLive.style.display = 'none'; muteMicBtnLive.textContent = '🎙️'; muteMicBtnLive.classList.remove('muted'); }
  stopBeautifyProcessing();
  { const el = document.getElementById('beautifyBtnLive'); if (el) el.style.display = 'none'; }
  { const el = document.getElementById('ttBeautifyBtn'); if (el) el.style.display = 'none'; }
  { const el = document.getElementById('longLegsBtnLive'); if (el) el.style.display = 'none'; }
  { const el = document.getElementById('ttLongLegsBtn'); if (el) el.style.display = 'none'; }
  if (ttFeed) ttFeed.classList.remove('tt-is-streaming');
  const shareBtn = document.getElementById('shareStreamBtn');
  if (shareBtn) shareBtn.style.display = 'none';
  const ttShareBtn = document.getElementById('ttShareBtn');
  if (ttShareBtn) ttShareBtn.style.display = 'none';
  // Restore nav arrows/dots and random buttons after broadcasting stops
  ttUpdateDots();
  if (goRandomBtn) goRandomBtn.disabled = false;
  const ttRandomEl2 = document.getElementById('ttRandomBtn');
  if (ttRandomEl2) ttRandomEl2.disabled = false;
  // Stop thumbnail capture
  stopThumbnailCapture();
  socket.emit('stop-public-stream');
  // Close all viewer peer connections
  for (const [viewerId, viewerPC] of publicStreamPCs) {
    viewerPC.close();
  }
  publicStreamPCs.clear();
  // Stop local stream tracks
  if (publicStreamLocalStream) {
    publicStreamLocalStream.getTracks().forEach((t) => t.stop());
    publicStreamLocalStream = null;
  }
  // If not watching anyone, hide stream area
  if (!currentWatchingStreamerId) {
    if (publicStreamArea) publicStreamArea.style.display = 'none';
    if (publicStreamVideo) publicStreamVideo.srcObject = null;
  }
  // In TikTok mode: remove fullscreen live overlay and resume current slide video
  if (ttActive) {
    const ttSelfVideo = document.getElementById('ttSelfVideo');
    if (ttSelfVideo) { ttSelfVideo.style.display = 'none'; ttSelfVideo.srcObject = null; }
    // Hide mute button and restore mic
    const ttMuteMicBtn = document.getElementById('ttMuteMicBtn');
    if (ttMuteMicBtn) ttMuteMicBtn.style.display = 'none';
    if (publicStreamLocalStream) publicStreamLocalStream.getAudioTracks().forEach(t => t.enabled = true);
    if (publicStreamArea) publicStreamArea.classList.remove('tt-stream-live');
    const curSlide = ttSlideEls[ttIndex];
    if (curSlide) {
      const v = curSlide.querySelector('video');
      if (v && v.src) v.play().catch(() => {});
    }
    // Reset overlay to current streamer info
    ttUpdateOverlay(ttStreamers[ttIndex]);
  }
  if (!isRunning) enterTtMode();
}

function startThumbnailCapture() {
  stopThumbnailCapture();
  // Capture immediately, then every 5 seconds
  captureThumbnail();
  thumbnailInterval = setInterval(captureThumbnail, 5000);
}

function stopThumbnailCapture() {
  if (thumbnailInterval) {
    clearInterval(thumbnailInterval);
    thumbnailInterval = null;
  }
}

function captureThumbnail() {
  if (!isStreaming) return;
  // In TT mode the broadcaster preview lives in ttSelfVideo; fall back to publicStreamVideo
  let video = publicStreamVideo;
  const ttSelfVideo = document.getElementById('ttSelfVideo');
  if (ttSelfVideo && ttSelfVideo.srcObject && (!video || !video.videoWidth)) {
    video = ttSelfVideo;
  }
  if (!video || !video.videoWidth || !video.videoHeight) return;
  try {
    const canvas = document.createElement('canvas');
    // Small thumbnail: 160px wide, keep aspect ratio
    const scale = 160 / video.videoWidth;
    canvas.width = 160;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    socket.emit('stream-thumbnail', { data: dataUrl });
  } catch (e) {
    // Canvas tainted or other error — ignore
  }
}

// ── Streamer: handle new viewer joining ──
socket.on('public-stream-viewer-joined', async ({ viewerId }) => {
  if (!isStreaming || !publicStreamLocalStream) return;
  playMatchSound();
  // Create a peer connection for this viewer
  const viewerPC = new RTCPeerConnection(ICE_SERVERS);
  publicStreamPCs.set(viewerId, viewerPC);

  viewerPC.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('public-stream-signal', { to: viewerId, data: { type: 'candidate', candidate: e.candidate } });
    }
  };

  // Add local stream tracks
  publicStreamLocalStream.getTracks().forEach((t) => {
    viewerPC.addTrack(t, publicStreamLocalStream);
  });

  // If beautify is active, swap in the beautified canvas video track
  if (isBeautifyOn && beautifyCanvasStream) {
    const beautifiedTrack = beautifyCanvasStream.getVideoTracks()[0];
    const sender = viewerPC.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender && beautifiedTrack) sender.replaceTrack(beautifiedTrack).catch(() => {});
  }

  // Create offer
  const offer = await viewerPC.createOffer();
  await viewerPC.setLocalDescription(offer);
  socket.emit('public-stream-signal', { to: viewerId, data: { type: 'offer', sdp: viewerPC.localDescription } });
});

// ── Streamer: viewer requests ICE restart (transient disconnect recovery) ──
socket.on('public-stream-ice-restart-request', async ({ viewerId }) => {
  if (!isStreaming || !publicStreamLocalStream) return;
  const viewerPC = publicStreamPCs.get(viewerId);
  if (!viewerPC || viewerPC.signalingState === 'closed') return;
  try {
    const offer = await viewerPC.createOffer({ iceRestart: true });
    await viewerPC.setLocalDescription(offer);
    socket.emit('public-stream-signal', { to: viewerId, data: { type: 'offer', sdp: viewerPC.localDescription } });
  } catch (e) {
    console.warn('[public-stream] ICE restart offer failed:', e.message);
  }
});

// ── Streamer: viewer left ──
socket.on('public-stream-viewer-left', ({ viewerId }) => {
  const viewerPC = publicStreamPCs.get(viewerId);
  if (viewerPC) {
    viewerPC.close();
    publicStreamPCs.delete(viewerId);
  }
});

// ── Viewer: server tells us which streamer to connect to ──
socket.on('public-stream-ready', ({ streamerId, streamerName, streamerIndex, botVideoUrl, viewerCount, isSelf }) => {
  // Server confirmed our own stream is live — navigate TT feed to our slot
  if (isSelf) {
    if (ttActive) {
      ttGoTo(streamerIndex, true);
      // Restore our labels since ttGoTo → ttUpdateOverlay overwrites them
      if (ttOverlayName) ttOverlayName.textContent = 'You (Live)';
      if (ttOverlayViewers) ttOverlayViewers.textContent = `👁 ${viewerCount || 0}`;
    }
    return;
  }
  // If user has hidden the stream, don't show it
  if (streamHiddenByUser) {
    socket.emit('stop-watching-public-stream');
    return;
  }
  // Don't become a viewer while broadcasting — ignore inbound stream-ready
  if (isStreaming) {
    socket.emit('stop-watching-public-stream');
    return;
  }
  // Close existing viewer PC
  if (publicStreamViewerPC) {
    publicStreamViewerPC.close();
    publicStreamViewerPC = null;
  }
  currentWatchingStreamerId = streamerId;
  pendingWatchByIdActive = false;
  if (publicStreamArea) publicStreamArea.style.display = 'flex';
  const _ttShareBtnV = document.getElementById('ttShareBtn');
  if (_ttShareBtnV) _ttShareBtnV.style.display = 'inline-flex';
  if (publicStreamName) {
    publicStreamName.textContent = streamerName;
    if (streamerId !== socket.id) {
      publicStreamName.style.cursor = 'pointer';
      publicStreamName.title = `Message ${streamerName}`;
      publicStreamName.onclick = () => openDmPanel(streamerId, streamerName);
    } else {
      publicStreamName.style.cursor = '';
      publicStreamName.title = '';
      publicStreamName.onclick = null;
    }
  }
  if (publicStreamViewerCount) publicStreamViewerCount.textContent = `👁 ${viewerCount || 0}`;
  if (publicStreamVideo && !isStreaming) publicStreamVideo.muted = false;

  // If bot stream, play MP4 directly (no WebRTC)
  if (botVideoUrl) {
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = null;
      publicStreamVideo.src = botVideoUrl;
      publicStreamVideo.loop = false;
      publicStreamVideo.muted = isStreamMuted;
      publicStreamVideo.play().catch(e => console.log('Bot stream play failed:', e));
    }
    return;
  }

  // Create viewer peer connection (receive only) for real streamers
  publicStreamViewerPC = new RTCPeerConnection(ICE_SERVERS);

  // Keep a local reference so the handlers below close over the right PC instance
  const thisPC = publicStreamViewerPC;
  const thisStreamerId = streamerId;

  publicStreamViewerPC.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('public-stream-signal', { to: streamerId, data: { type: 'candidate', candidate: e.candidate } });
    }
  };

  // When ICE fails or disconnects, try to recover gracefully
  publicStreamViewerPC.oniceconnectionstatechange = () => {
    const state = thisPC.iceConnectionState;
    if (state === 'disconnected') {
      // Transient — ask streamer to restart ICE instead of full teardown
      console.warn('[public-stream] ICE disconnected — requesting ICE restart from', thisStreamerId);
      if (thisPC === publicStreamViewerPC) {
        setTimeout(() => {
          if (thisPC !== publicStreamViewerPC) return;
          if (thisPC.iceConnectionState === 'connected' || thisPC.iceConnectionState === 'completed') return; // already recovered
          if (thisPC.iceConnectionState === 'failed') return; // handled below
          // Still disconnected — ask streamer to send a new offer with iceRestart
          socket.emit('public-stream-ice-restart', { streamerId: thisStreamerId });
        }, 4000);
      }
    } else if (state === 'failed') {
      // Unrecoverable — full reconnect
      console.warn('[public-stream] ICE failed — full reconnect to', thisStreamerId);
      if (thisPC === publicStreamViewerPC) {
        setTimeout(() => {
          if (thisPC === publicStreamViewerPC && thisPC.iceConnectionState === 'failed') {
            socket.emit('watch-public-stream-by-id', { streamerId: thisStreamerId });
          }
        }, 2000);
      }
    }
  };

  publicStreamViewerPC.ontrack = (e) => {
    // Handle Unified Plan: e.streams[0] may be undefined — build stream manually
    let stream;
    if (e.streams && e.streams[0]) {
      stream = e.streams[0];
    } else {
      if (!publicStreamVideo.srcObject || !(publicStreamVideo.srcObject instanceof MediaStream)) {
        publicStreamVideo.srcObject = new MediaStream();
      }
      publicStreamVideo.srcObject.addTrack(e.track);
      stream = publicStreamVideo.srcObject;
    }
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = stream;
      if (!isStreaming) publicStreamVideo.muted = isStreamMuted;
      publicStreamVideo.play().catch(() => {});
    }
    // In TikTok mode: show stream inside ttFeed so it participates in the swipe gesture
    if (ttActive) {
      const ttStreamVideo = document.getElementById('ttStreamVideo');
      if (ttStreamVideo) {
        ttStreamVideo.srcObject = stream;
        ttStreamVideo.muted = isStreamMuted;
        ttStreamVideo.style.transform = ''; // clear any leftover drag offset
        ttStreamVideo.style.display = '';
        ttStreamVideo.play().catch(() => {});
      }
    }
  };
});

socket.on('watch-public-stream-redirect', ({ streamerIndex }) => {
  socket.emit('watch-public-stream', { streamerIndex });
});

// ── Viewer: stream ended ──
socket.on('public-stream-ended', () => {
  currentWatchingStreamerId = null;
  pendingWatchByIdActive = false;
  if (!isStreaming) { const _ttShareBtnV = document.getElementById('ttShareBtn'); if (_ttShareBtnV) _ttShareBtnV.style.display = 'none'; }
  if (publicStreamViewerPC) {
    publicStreamViewerPC.close();
    publicStreamViewerPC = null;
  }
  // Clear TikTok in-feed stream video
  const ttStreamVideo = document.getElementById('ttStreamVideo');
  if (ttStreamVideo) { ttStreamVideo.style.display = 'none'; ttStreamVideo.srcObject = null; }
  // Clear room users and close panel
  renderOnlineUsers([]);
  if (onlineUsersPanel) onlineUsersPanel.classList.remove('open');
  // If we're streaming ourselves, show own stream; otherwise hide
  if (isStreaming) {
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = publicStreamLocalStream;
      publicStreamVideo.muted = true;
    }
    if (publicStreamName) publicStreamName.textContent = 'You (Live)';
  } else {
    if (publicStreamArea) publicStreamArea.style.display = 'none';
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = null;
      publicStreamVideo.removeAttribute('src');
      publicStreamVideo.loop = false;
    }
  }
});

// ── WebRTC signaling for public stream ──
socket.on('public-stream-signal', async ({ from, data }) => {
  // Determine if we're the streamer or viewer
  if (isStreaming && publicStreamPCs.has(from)) {
    // We're the streamer, this signal is from a viewer
    const viewerPC = publicStreamPCs.get(from);
    if (data.type === 'answer') {
      await viewerPC.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.type === 'candidate') {
      try { await viewerPC.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn(e); }
    }
  } else if (publicStreamViewerPC && from === currentWatchingStreamerId) {
    // We're the viewer, this signal is from the streamer
    if (data.type === 'offer') {
      try {
        // Only process offer if PC is in a state that can accept it
        if (publicStreamViewerPC.signalingState !== 'stable' && publicStreamViewerPC.signalingState !== 'have-local-offer') {
          console.warn('Ignoring offer in state:', publicStreamViewerPC.signalingState);
          return;
        }
        await publicStreamViewerPC.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await publicStreamViewerPC.createAnswer();
        await publicStreamViewerPC.setLocalDescription(answer);
        socket.emit('public-stream-signal', { to: from, data: { type: 'answer', sdp: publicStreamViewerPC.localDescription } });
      } catch (e) {
        console.warn('Stream offer handling error:', e.message);
      }
    } else if (data.type === 'candidate') {
      try { await publicStreamViewerPC.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn(e); }
    }
  }
});

// ── Stream update: new streamer list from server ──
socket.on('public-stream-update', ({ streamers }) => {
  lastKnownStreamers = streamers || [];
  // Update viewer count if currently watching or streaming
  if (currentWatchingStreamerId) {
    const current = streamers.find(s => s.socketId === currentWatchingStreamerId);
    if (current && publicStreamViewerCount) {
      publicStreamViewerCount.textContent = `👁 ${current.viewerCount || 0}`;
    }
  }
  if (isStreaming) {
    const self = streamers.find(s => s.socketId === socket.id);
    if (self && ttOverlayViewers) ttOverlayViewers.textContent = `👁 ${self.viewerCount || 0}`;
  }
  // Render the streamers discovery grid
  renderStreamersGrid(streamers);
  renderTikTokFeed(streamers);
  // If not currently watching and not streaming, and there are streamers, auto-watch first
  // Skip auto-watch if we have a pending watch-by-id request in flight
  if (profileReady && !isStreaming && !currentWatchingStreamerId && !streamHiddenByUser && !pendingWatchByIdActive && streamers.length > 0) {
    socket.emit('watch-public-stream', { streamerIndex: 0 });
  }
  // If no streamers left, reset the hidden flag so next stream auto-shows
  if (streamers.length === 0) streamHiddenByUser = false;
});

function renderStreamersGrid(streamers) {
  if (!streamersCards || !streamersCountEl) return;

  // Update count
  streamersCountEl.textContent = `${streamers.length} live`;

  if (streamers.length === 0) {
    const existingCards = streamersCards.querySelectorAll('.streamer-card');
    existingCards.forEach(c => c.remove());
    if (noStreamersMsg) noStreamersMsg.style.display = '';
    return;
  }

  if (noStreamersMsg) noStreamersMsg.style.display = 'none';

  // If only viewer counts changed (same streamers, same URLs), update in-place
  // to avoid restarting the preview videos in each card.
  const existingCards = Array.from(streamersCards.querySelectorAll('.streamer-card'));
  const structureUnchanged =
    existingCards.length === streamers.length &&
    streamers.every((s, i) => existingCards[i]?.dataset.streamerId === s.socketId);

  if (structureUnchanged) {
    streamers.forEach((streamer, i) => {
      const viewersEl = existingCards[i].querySelector('.streamer-card-viewers');
      if (viewersEl) viewersEl.textContent = `👁 ${streamer.viewerCount || 0}`;
      if (streamer.socketId === currentWatchingStreamerId) {
        existingCards[i].classList.add('watching');
      } else {
        existingCards[i].classList.remove('watching');
      }
    });
    return;
  }

  // Full rebuild (streamer joined, left, or changed)
  existingCards.forEach(c => c.remove());
  streamers.forEach((streamer) => {
    const card = document.createElement('div');
    card.className = 'streamer-card';
    card.dataset.streamerId = streamer.socketId;
    if (streamer.socketId === currentWatchingStreamerId) {
      card.classList.add('watching');
    }
    
    // Build card background: video preview for bots, thumbnail/gradient for real streamers
    if (streamer.botVideoUrl) {
      card.innerHTML = `
        <video class="streamer-card-video" src="${streamer.botVideoUrl}" muted playsinline loop autoplay poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></video>
        <span class="streamer-card-live">LIVE</span>
        <div class="streamer-card-overlay">
          <div class="streamer-card-name">${escapeHtml(streamer.name || 'Unknown')}</div>
          <div class="streamer-card-viewers">👁 ${streamer.viewerCount || 0}</div>
        </div>
      `;
    } else if (streamer.thumbnail) {
      card.innerHTML = `
        <img class="streamer-card-video" src="${streamer.thumbnail}" alt="${escapeHtml(streamer.name || '')}" />
        <span class="streamer-card-live">LIVE</span>
        <div class="streamer-card-overlay">
          <div class="streamer-card-name">${escapeHtml(streamer.name || 'Unknown')}</div>
          <div class="streamer-card-viewers">👁 ${streamer.viewerCount || 0}</div>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="streamer-card-bg"><span class="avatar-emoji">📷</span></div>
        <span class="streamer-card-live">LIVE</span>
        <div class="streamer-card-overlay">
          <div class="streamer-card-name">${escapeHtml(streamer.name || 'Unknown')}</div>
          <div class="streamer-card-viewers">👁 ${streamer.viewerCount || 0}</div>
        </div>
      `;
    }
    
    card.addEventListener('click', () => {
      streamHiddenByUser = false;
      socket.emit('watch-public-stream-by-id', { streamerId: streamer.socketId });
    });
    
    streamersCards.appendChild(card);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Next streamer button ──
if (nextStreamerBtn) {
  nextStreamerBtn.onclick = () => {
    streamHiddenByUser = false;
    socket.emit('next-public-streamer');
  };
}

// ── Hide stream button ──
const muteStreamBtn = document.getElementById('muteStreamBtn');
if (muteStreamBtn) {
  muteStreamBtn.addEventListener('click', () => {
    if (!publicStreamVideo) return;
    isStreamMuted = !isStreamMuted;
    publicStreamVideo.muted = isStreamMuted;
    localStorage.setItem('streamMuted', isStreamMuted);
    muteStreamBtn.textContent = isStreamMuted ? '🔇' : '🔊';
    muteStreamBtn.title = isStreamMuted ? 'Unmute stream' : 'Mute stream';
  });
}

if (hideStreamBtn) {
  hideStreamBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    streamHiddenByUser = true;
    if (publicStreamArea) publicStreamArea.style.display = 'none';
    if (currentWatchingStreamerId) {
      socket.emit('stop-watching-public-stream');
      currentWatchingStreamerId = null;
      if (publicStreamViewerPC) { publicStreamViewerPC.close(); publicStreamViewerPC = null; }
    }
    // Clear room users and close panel
    renderOnlineUsers([]);
    if (onlineUsersPanel) onlineUsersPanel.classList.remove('open');
    if (publicStreamVideo) {
      publicStreamVideo.pause();
      publicStreamVideo.srcObject = null;
      publicStreamVideo.removeAttribute('src');
      publicStreamVideo.load();
    }
  });
}

// ═══════════════════════════════════
//  Virtual Coins / Tips
// ═══════════════════════════════════

socket.on('coin-balance', ({ balance }) => {
  myCoins = balance;
  if (coinCountEl) coinCountEl.textContent = balance;
  if (coinBalanceEl) {
    coinBalanceEl.classList.remove('coin-pop');
    void coinBalanceEl.offsetWidth; // force reflow
    coinBalanceEl.classList.add('coin-pop');
  }
});

socket.on('tip-error', ({ message }) => {
  addChatMessage(`⚠️ ${message}`, 'system', 'public');
});

// Tip buttons
document.querySelectorAll('.tip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = parseInt(btn.dataset.amount);
    if (!currentWatchingStreamerId) return;
    if (myCoins < amount) {
      addChatMessage('⚠️ Not enough coins!', 'system', 'public');
      return;
    }
    socket.emit('send-tip', { toSocketId: currentWatchingStreamerId, amount });
  });
});

// ═══════════════════════════════════
//  Buy Coins — PayPal Integration
// ═══════════════════════════════════

const buyCoinsBtn = document.getElementById('buyCoinsBtn');
const buyCoinsModal = document.getElementById('buyCoinsModal');
const closeBuyModal = document.getElementById('closeBuyModal');
const coinPackagesEl = document.getElementById('coinPackages');
const paypalContainer = document.getElementById('paypalButtonContainer');
const googlePlayBuyBtn = document.getElementById('googlePlayBuyBtn');
const buyStatus = document.getElementById('buyStatus');

let selectedPackage = null;
let paypalLoaded = false;
let paypalClientId = null;

// Detect if running inside Android WebView app
const isNativeApp = !!(window.FlashLiveApp || window.PalpairApp);

// Open modal
const ttCoinBalanceEl = document.getElementById('ttCoinBalance');
if (ttCoinBalanceEl) {
  ttCoinBalanceEl.style.cursor = 'pointer';
  ttCoinBalanceEl.addEventListener('click', () => { if (buyCoinsBtn) buyCoinsBtn.click(); });
}

if (buyCoinsBtn) {
  buyCoinsBtn.addEventListener('click', async () => {
    buyCoinsModal.style.display = 'flex';
    buyStatus.textContent = '';
    buyStatus.className = 'buy-status';
    // Reset selection
    document.querySelectorAll('.coin-package').forEach(p => p.classList.remove('selected'));
    paypalContainer.style.display = 'none';
    paypalContainer.innerHTML = '';
    selectedPackage = null;

    // Fetch config if needed
    if (!paypalClientId) {
      try {
        const res = await fetch('/api/coin-packages');
        const data = await res.json();
        paypalClientId = data.paypalClientId;
      } catch (e) {
        buyStatus.textContent = 'Failed to load payment config';
        buyStatus.className = 'buy-status error';
      }
    }
  });
}

// Close modal
if (closeBuyModal) {
  closeBuyModal.addEventListener('click', () => {
    buyCoinsModal.style.display = 'none';
  });
}
if (buyCoinsModal) {
  buyCoinsModal.addEventListener('click', (e) => {
    if (e.target === buyCoinsModal) buyCoinsModal.style.display = 'none';
  });
}

// Package selection
document.querySelectorAll('.coin-package').forEach(pkg => {
  pkg.addEventListener('click', async () => {
    const pkgId = pkg.dataset.package;
    selectedPackage = pkgId;

    document.querySelectorAll('.coin-package').forEach(p => p.classList.remove('selected'));
    pkg.classList.add('selected');

    // Load PayPal SDK if needed
    if (!paypalLoaded && paypalClientId) {
      buyStatus.textContent = 'Loading payment...';
      buyStatus.className = 'buy-status';
      try {
        await loadPayPalSDK(paypalClientId);
        paypalLoaded = true;
        buyStatus.textContent = '';
      } catch (e) {
        buyStatus.textContent = 'Failed to load PayPal';
        buyStatus.className = 'buy-status error';
        return;
      }
    }

    // Native app: show Google Play button instead of PayPal
    if (isNativeApp) {
      paypalContainer.style.display = 'none';
      if (googlePlayBuyBtn) {
        googlePlayBuyBtn.style.display = 'block';
        googlePlayBuyBtn.onclick = () => {
          buyStatus.textContent = 'Opening Google Play...';
          buyStatus.className = 'buy-status';
          (window.FlashLiveApp || window.PalpairApp).purchaseCoins(selectedPackage, socket.id);
        };
      }
      return;
    }

    if (!paypalClientId) {
      buyStatus.textContent = 'PayPal not configured on server';
      buyStatus.className = 'buy-status error';
      return;
    }

    // Render PayPal buttons
    paypalContainer.style.display = 'block';
    paypalContainer.innerHTML = '';

    if (window.paypal) {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'pill',
          label: 'pay',
          height: 40
        },
        createOrder: async () => {
          buyStatus.textContent = 'Creating order...';
          buyStatus.className = 'buy-status';
          const res = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ packageId: selectedPackage, socketId: socket.id })
          });
          const data = await res.json();
          if (data.error) {
            buyStatus.textContent = data.error;
            buyStatus.className = 'buy-status error';
            throw new Error(data.error);
          }
          buyStatus.textContent = '';
          return data.orderId;
        },
        onApprove: async (data) => {
          buyStatus.textContent = 'Processing payment...';
          buyStatus.className = 'buy-status';
          const res = await fetch('/api/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.orderID })
          });
          const result = await res.json();
          if (result.success) {
            buyStatus.textContent = `✅ +${result.coins} coins added!`;
            buyStatus.className = 'buy-status success';
            setTimeout(() => {
              buyCoinsModal.style.display = 'none';
            }, 2000);
          } else {
            buyStatus.textContent = result.error || 'Payment failed';
            buyStatus.className = 'buy-status error';
          }
        },
        onError: (err) => {
          console.error('PayPal error:', err);
          buyStatus.textContent = 'Payment error. Please try again.';
          buyStatus.className = 'buy-status error';
        },
        onCancel: () => {
          buyStatus.textContent = 'Payment cancelled';
          buyStatus.className = 'buy-status';
        }
      }).render(paypalContainer);
    }
  });
});

function loadPayPalSDK(clientId) {
  return new Promise((resolve, reject) => {
    if (window.paypal) return resolve();
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Google Play Billing callback (called from native Android app) ──
window.onGooglePlayPurchaseResult = async function(packageId, purchaseToken, orderId, success) {
  const buyStatusEl = document.getElementById('buyStatus');
  const modal = document.getElementById('buyCoinsModal');

  if (!success) {
    buyStatusEl.textContent = 'Purchase cancelled or failed';
    buyStatusEl.className = 'buy-status error';
    return;
  }

  buyStatusEl.textContent = 'Verifying purchase...';
  buyStatusEl.className = 'buy-status';

  try {
    const res = await fetch('/api/verify-google-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socketId: socket.id, packageId, purchaseToken, orderId })
    });
    const result = await res.json();
    if (result.success) {
      buyStatusEl.textContent = `\u2705 +${result.coins} coins added!`;
      buyStatusEl.className = 'buy-status success';
      setTimeout(() => { modal.style.display = 'none'; }, 2000);
    } else {
      buyStatusEl.textContent = result.error || 'Verification failed';
      buyStatusEl.className = 'buy-status error';
    }
  } catch (err) {
    console.error('Google purchase verify error:', err);
    buyStatusEl.textContent = 'Network error. Try again.';
    buyStatusEl.className = 'buy-status error';
  }
};

// ── Cashout ──
const cashoutBtn = document.getElementById('cashoutBtn');
const cashoutModal = document.getElementById('cashoutModal');
const closeCashoutModal = document.getElementById('closeCashoutModal');
const cashoutCoinsInput = document.getElementById('cashoutCoins');
const cashoutEmailInput = document.getElementById('cashoutEmail');
const cashoutPayoutEl = document.getElementById('cashoutPayout');
const cashoutCoinCountEl = document.getElementById('cashoutCoinCount');
const cashoutSubmitBtn = document.getElementById('cashoutSubmitBtn');
const cashoutStatus = document.getElementById('cashoutStatus');

const CASHOUT_RATE = 0.007; // $0.007 per coin
const CASHOUT_MIN = 1000;

if (cashoutBtn) {
  cashoutBtn.addEventListener('click', () => {
    cashoutModal.style.display = 'flex';
    cashoutCoinCountEl.textContent = myCoins;
    cashoutCoinsInput.value = '';
    cashoutEmailInput.value = '';
    cashoutPayoutEl.textContent = '0.00';
    cashoutStatus.textContent = '';
    cashoutStatus.className = 'cashout-status';
    cashoutSubmitBtn.disabled = false;
  });
}

if (closeCashoutModal) {
  closeCashoutModal.addEventListener('click', () => {
    cashoutModal.style.display = 'none';
  });
}

if (cashoutCoinsInput) {
  cashoutCoinsInput.addEventListener('input', () => {
    const val = parseInt(cashoutCoinsInput.value) || 0;
    const payout = (val * CASHOUT_RATE).toFixed(2);
    cashoutPayoutEl.textContent = payout;
  });
}

if (cashoutSubmitBtn) {
  cashoutSubmitBtn.addEventListener('click', async () => {
    const coins = parseInt(cashoutCoinsInput.value) || 0;
    const email = (cashoutEmailInput.value || '').trim();

    cashoutStatus.textContent = '';
    cashoutStatus.className = 'cashout-status';

    if (coins < CASHOUT_MIN) {
      cashoutStatus.textContent = `Minimum cashout is ${CASHOUT_MIN} coins`;
      cashoutStatus.className = 'cashout-status error';
      return;
    }
    if (coins > myCoins) {
      cashoutStatus.textContent = 'Not enough coins';
      cashoutStatus.className = 'cashout-status error';
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      cashoutStatus.textContent = 'Enter a valid PayPal email';
      cashoutStatus.className = 'cashout-status error';
      return;
    }

    cashoutSubmitBtn.disabled = true;
    cashoutStatus.textContent = 'Submitting request...';

    try {
      const res = await fetch('/api/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socketId: socket.id, paypalEmail: email, coins })
      });
      const result = await res.json();
      if (result.success) {
        cashoutStatus.textContent = `✅ Cashout requested! $${result.payout} will be sent to ${email}`;
        cashoutStatus.className = 'cashout-status success';
        cashoutCoinCountEl.textContent = result.balance;
        setTimeout(() => {
          cashoutModal.style.display = 'none';
        }, 3000);
      } else {
        cashoutStatus.textContent = result.error || 'Cashout failed';
        cashoutStatus.className = 'cashout-status error';
        cashoutSubmitBtn.disabled = false;
      }
    } catch (err) {
      console.error('Cashout error:', err);
      cashoutStatus.textContent = 'Network error. Try again.';
      cashoutStatus.className = 'cashout-status error';
      cashoutSubmitBtn.disabled = false;
    }
  });
}

// ═══════════════════════════════════
//  TikTok-style Live Feed
// ═══════════════════════════════════

let ttStreamers    = [];
let ttIndex        = 0;
let ttSlideEls     = [];
let ttFeedH        = window.innerHeight;
// Dark 2×2 PNG poster set on every bot <video> so the pre-frame state shows our
// background color instead of Android WebView's native gray placeholder.
const _pc = document.createElement('canvas'); _pc.width = _pc.height = 2;
_pc.getContext('2d').fillStyle = '#0a0a14'; _pc.getContext('2d').fillRect(0,0,2,2);
const SLIDE_DARK_POSTER = _pc.toDataURL('image/png');
let ttDragStartY   = 0;
let ttDragDeltaY   = 0;
let ttIsDragging   = false;
let ttChatObserver    = null;
let ttActive          = false;
let ttChatUserScrolled = false; // true when user has scrolled up in chat

function ttSyncSlideHeights() {
  // On Android WebView, 100dvh (CSS) can differ from the actual container
  // height (JS), making translateY misaligned so the next slide never peeks in.
  // Force every slide to exactly ttFeedH pixels so CSS and JS always agree.
  if (!ttFeed) return;
  ttFeedH = ttFeed.clientHeight || window.innerHeight;
  const h = ttFeedH + 'px';
  ttSlideEls.forEach(s => { if (s.style.height !== h) s.style.height = h; });
}

function ttUpdatePos(animated, delta = 0) {
  if (!ttSlideContainer) return;
  ttSyncSlideHeights();
  const y = -ttIndex * ttFeedH + delta;
  const transition = animated ? 'transform 0.32s cubic-bezier(.4,0,.2,1)' : 'none';
  ttSlideContainer.style.transition = transition;
  ttSlideContainer.style.transform = `translateY(${y}px)`;
  // Keep the live-stream overlay in sync during drag so it slides with the current slide
  const ttSV = document.getElementById('ttStreamVideo');
  if (ttSV) {
    ttSV.style.transition = transition;
    ttSV.style.transform = delta ? `translateY(${delta}px)` : 'none';
  }
}

function ttUpdateDots() {
  if (!ttDotsEl) return;
  // Hide nav UI entirely while broadcasting
  if (isStreaming) {
    ttDotsEl.style.display = 'none';
    if (ttPrevBtnEl) ttPrevBtnEl.style.display = 'none';
    if (ttNextBtnEl) ttNextBtnEl.style.display = 'none';
    return;
  }
  ttDotsEl.style.display = '';
  ttDotsEl.innerHTML = '';
  // Only show dots if ≤12 streamers (otherwise too many)
  if (ttStreamers.length > 1 && ttStreamers.length <= 12) {
    ttStreamers.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'tt-dot' + (i === ttIndex ? ' active' : '');
      ttDotsEl.appendChild(dot);
    });
  }
  // Show/hide nav arrows based on position
  if (ttPrevBtnEl) ttPrevBtnEl.style.display = (ttIndex > 0) ? 'flex' : 'none';
  if (ttNextBtnEl) ttNextBtnEl.style.display = (ttIndex < ttStreamers.length - 1) ? 'flex' : 'none';
}

function ttUpdateOverlay(streamer) {
  if (!streamer) return;
  if (ttOverlayName) {
    ttOverlayName.textContent = streamer.name || '—';
    if (streamer.socketId !== socket.id) {
      ttOverlayName.style.cursor = 'pointer';
      ttOverlayName.title = `Message ${streamer.name}`;
      ttOverlayName.onclick = () => openDmPanel(streamer.socketId, streamer.name);
    } else {
      ttOverlayName.style.cursor = '';
      ttOverlayName.title = '';
      ttOverlayName.onclick = null;
    }
  }
  if (ttOverlayViewers) ttOverlayViewers.textContent = `👁 ${streamer.viewerCount || 0}`;
  // Close viewer popup when switching slides
  if (ttViewerPopup) ttViewerPopup.style.display = 'none';
}

function ttGoTo(index, animated = true) {
  if (!ttStreamers.length) return;
  const prev = ttIndex;
  ttIndex = Math.max(0, Math.min(ttStreamers.length - 1, index));

  // Do NOT pause the previous slide's video here — pausing then immediately
  // re-playing in ttLoadAdjacentVideos triggers Android's native gray overlay
  // for that one frame. Let ttLoadAdjacentVideos own all play/pause decisions.

  ttUpdatePos(animated);
  ttUpdateDots();

  const streamer = ttStreamers[ttIndex];
  if (!streamer) return;
  ttUpdateOverlay(streamer);

  // Play bot video in new active slide (only when not broadcasting)
  ttLoadAdjacentVideos(ttIndex);

  // Watch the new streamer (never while broadcasting — would compete for bandwidth)
  if (!isStreaming && (ttIndex !== prev || !currentWatchingStreamerId)) {
    streamHiddenByUser = false;
    // Set currentWatchingStreamerId eagerly so renderTikTokFeed (triggered by
    // the public-stream-update broadcast that follows watch-public-stream-by-id)
    // doesn't reset ttIndex back to the old streamer's position mid-navigation.
    currentWatchingStreamerId = streamer.socketId;
    // Delay hiding the stream overlay until the slide animation finishes (320ms)
    // so there's no black flash mid-swipe. We fade it out, then clear srcObject.
    const ttStreamVideo = document.getElementById('ttStreamVideo');
    if (ttStreamVideo && ttStreamVideo.srcObject) {
      ttStreamVideo.style.opacity = '0';
      setTimeout(() => {
        ttStreamVideo.style.display = 'none';
        ttStreamVideo.style.opacity = '';
        ttStreamVideo.srcObject = null;
      }, 350);
    }
    // Clear old stream video
    if (publicStreamArea) publicStreamArea.classList.remove('tt-stream-live');
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = null;
      publicStreamVideo.removeAttribute('src');
      publicStreamVideo.load();
    }
    socket.emit('watch-public-stream-by-id', { streamerId: streamer.socketId });
  }
}

function renderTikTokFeed(streamers) {
  if (!ttFeed || !ttSlideContainer) return;
  const newStreamers = streamers || [];

  if (newStreamers.length === 0) {
    ttStreamers = newStreamers;
    if (ttEmptyEl) ttEmptyEl.style.display = 'flex';
    ttSlideContainer.innerHTML = '';
    ttSlideEls = [];
    if (ttOverlayName)    ttOverlayName.textContent    = '';
    if (ttOverlayViewers) ttOverlayViewers.textContent = '';
    ttUpdateDots();
    return;
  }
  if (ttEmptyEl) ttEmptyEl.style.display = 'none';

  // If only viewer counts / thumbnails changed (same streamers, same video URLs), skip
  // full rebuild — a full rebuild destroys and re-creates <video> elements, causing
  // every watching device to restart the stream from scratch.
  const structureUnchanged =
    newStreamers.length === ttStreamers.length &&
    newStreamers.every((s, i) =>
      ttStreamers[i] &&
      s.socketId    === ttStreamers[i].socketId &&
      s.botVideoUrl === ttStreamers[i].botVideoUrl
    );

  if (structureUnchanged && ttSlideEls.length > 0) {
    // Update thumbnails in-place for real-user slides (no full rebuild)
    newStreamers.forEach((s, i) => {
      if (s.botVideoUrl || s.thumbnail === ttStreamers[i].thumbnail) return;
      const slide = ttSlideEls[i];
      if (!slide) return;
      if (s.thumbnail) {
        // Update or create blurred background
        let bg = slide.querySelector('.tt-slide-blur-bg');
        if (!bg) {
          bg = document.createElement('div');
          bg.className = 'tt-slide-blur-bg';
          slide.appendChild(bg);
        }
        bg.style.backgroundImage = `url('${s.thumbnail}')`;
        // Update or create sharp thumbnail
        let img = slide.querySelector('img.tt-slide-video');
        if (!img) {
          img = document.createElement('img');
          img.className = 'tt-slide-video';
          img.alt = s.name || '';
          slide.appendChild(img);
        }
        img.src = s.thumbnail;
      }
    });
    ttStreamers = newStreamers;
    ttUpdateOverlay(ttStreamers[ttIndex]);
    return;
  }

  ttStreamers = newStreamers;

  ttFeedH = (ttFeed && ttFeed.clientHeight) || window.innerHeight;

  // Keep current streamer in view if it's still in list
  if (currentWatchingStreamerId) {
    const newIdx = ttStreamers.findIndex(s => s.socketId === currentWatchingStreamerId);
    if (newIdx !== -1) ttIndex = newIdx;
  }
  if (ttIndex >= ttStreamers.length) ttIndex = ttStreamers.length - 1;

  // Rebuild slides
  ttSlideContainer.innerHTML = '';
  ttSlideEls = [];

  ttStreamers.forEach((streamer, i) => {
    const slide = document.createElement('div');
    slide.className = 'tt-slide';
    slide.dataset.id = streamer.socketId;

    if (streamer.botVideoUrl) {
      const vid = document.createElement('video');
      vid.className = 'tt-slide-video';
      vid.dataset.src = streamer.botVideoUrl; // lazy — src set only when nearby
      vid.muted = true;
      vid.loop  = true;
      vid.preload = 'none';
      vid.setAttribute('playsinline', '');
      // poster = dark data URL so Android shows our background color (not gray)
      // during buffering. Video stays display:block at all times — never hidden —
      // so the compositor keeps it alive and adjacent slides are pre-rendered
      // before the user swipes to them.
      vid.poster = SLIDE_DARK_POSTER;
      slide.appendChild(vid);
    } else {
      // Real-user slide: show thumbnail while stream loads
      if (streamer.thumbnail) {
        const bg = document.createElement('div');
        bg.className = 'tt-slide-blur-bg';
        bg.style.backgroundImage = `url('${streamer.thumbnail}')`;
        slide.appendChild(bg);
        const img = document.createElement('img');
        img.className = 'tt-slide-video';
        img.src = streamer.thumbnail;
        img.alt = streamer.name || '';
        slide.appendChild(img);
      }
    }

    ttSlideContainer.appendChild(slide);
    ttSlideEls.push(slide);
  });

  ttUpdatePos(false);
  ttUpdateDots();
  ttUpdateOverlay(ttStreamers[ttIndex]);
  startTtChatMirror();
  ttLoadAdjacentVideos(ttIndex);
}

// Load src only for current slide and its immediate neighbours; unload the rest
function ttLoadAdjacentVideos(index) {
  ttSlideEls.forEach((slide, i) => {
    const v = slide.querySelector('video[data-src]');
    if (!v) return;
    const nearby = Math.abs(i - index) <= 1;
    if (nearby) {
      if (!v.src || v.src !== v.dataset.src) {
        // Lazy-load: only set src when this slide is current or adjacent.
        // poster (dark data URL) shows during buffering — no gray flash.
        v.src = v.dataset.src;
        v.load();
        const onCanPlay = () => {
          v.removeEventListener('canplay', onCanPlay);
          v.play().catch(() => {});
        };
        v.addEventListener('canplay', onCanPlay);
      } else if (v.paused) {
        v.play().catch(() => {});
      }
    } else {
      // Unload to free bandwidth/memory; poster (dark) shows while unloaded
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  });
}

function startTtChatMirror() {
  if (ttChatObserver) { ttChatObserver.disconnect(); ttChatObserver = null; }
  const src = document.getElementById('chatMessages');
  if (!src || !ttChatEl) return;
  ttChatObserver = new MutationObserver(() => mirrorTtChat());
  ttChatObserver.observe(src, { childList: true });
  mirrorTtChat();
}

function mirrorTtChat() {
  if (!ttChatEl) return;
  const src = document.getElementById('chatMessages');
  if (!src) return;
  const msgs = src.querySelectorAll('.chat-message');
  ttChatEl.innerHTML = '';
  const h = window.innerHeight;
  const limit = h <= 500 ? 5 : h <= 700 ? 10 : 25;
  const start = Math.max(0, msgs.length - limit);
  for (let i = start; i < msgs.length; i++) {
    ttChatEl.appendChild(msgs[i].cloneNode(true));
  }
  if (!ttChatUserScrolled) ttChatEl.scrollTop = ttChatEl.scrollHeight;
}

function enterTtMode() {
  if (!ttFeed) return;
  ttActive = true;
  ttFeed.style.display = 'flex';
  document.body.classList.add('tt-mode');
  // Sync coin balance display
  if (ttCoinCountEl && coinCountEl) ttCoinCountEl.textContent = coinCountEl.textContent;
}

function exitTtMode() {
  if (!ttFeed) return;
  ttActive = false;
  ttFeed.style.display = 'none';
  document.body.classList.remove('tt-mode');
}

// ── Drag / Swipe gesture ──
function onTtStart(y) {
  if (!ttActive || isStreaming) return;
  ttIsDragging = true;
  ttDragStartY = y;
  ttDragDeltaY = 0;
  if (ttSlideContainer) ttSlideContainer.style.transition = 'none';
}
function onTtMove(y) {
  if (!ttIsDragging) return;
  ttDragDeltaY = y - ttDragStartY;
  ttUpdatePos(false, ttDragDeltaY);
}
function onTtEnd() {
  if (!ttIsDragging) return;
  ttIsDragging = false;
  const threshold = ttFeedH * 0.22;
  if (ttDragDeltaY < -threshold)       ttGoTo(ttIndex + 1);
  else if (ttDragDeltaY > threshold)   ttGoTo(ttIndex - 1);
  else                                  ttUpdatePos(true);
  ttDragDeltaY = 0;
}

// ── TikTok chat drag-to-scroll ──
if (ttChatEl) {
  let chatDragStartY = 0;
  let chatDragScrollTop = 0;
  let chatDragging = false;

  function chatAtBottom() {
    return ttChatEl.scrollTop >= ttChatEl.scrollHeight - ttChatEl.clientHeight - 10;
  }

  // Touch
  ttChatEl.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    chatDragStartY = e.touches[0].clientY;
    chatDragScrollTop = ttChatEl.scrollTop;
    chatDragging = true;
  }, { passive: true });

  ttChatEl.addEventListener('touchmove', e => {
    if (!chatDragging || e.touches.length !== 1) return;
    e.stopPropagation(); // prevent TikTok slide-swipe
    e.preventDefault();  // prevent page scroll
    const dy = chatDragStartY - e.touches[0].clientY;
    ttChatEl.scrollTop = chatDragScrollTop + dy;
    ttChatUserScrolled = !chatAtBottom();
  }, { passive: false });

  ttChatEl.addEventListener('touchend', () => {
    chatDragging = false;
    ttChatUserScrolled = !chatAtBottom();
  }, { passive: true });

  // Mouse (desktop)
  ttChatEl.addEventListener('mousedown', e => {
    chatDragStartY = e.clientY;
    chatDragScrollTop = ttChatEl.scrollTop;
    chatDragging = true;
    e.stopPropagation(); // prevent TikTok slide-swipe
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!chatDragging) return;
    const dy = chatDragStartY - e.clientY;
    ttChatEl.scrollTop = chatDragScrollTop + dy;
    ttChatUserScrolled = !chatAtBottom();
  });

  window.addEventListener('mouseup', () => {
    if (!chatDragging) return;
    chatDragging = false;
    ttChatUserScrolled = !chatAtBottom();
  });
}

if (ttFeed) {
  // Touch
  ttFeed.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    // Don't start a slide-drag from scrollable child elements or nav buttons
    if (e.target.closest('.tt-tip-row') || e.target.closest('.tt-chat-messages') || e.target.closest('.tt-nav-btn') || e.target.closest('.tt-topbar')) return;
    onTtStart(e.touches[0].clientY);
  }, { passive: true });
  ttFeed.addEventListener('touchmove', e => {
    if (e.touches.length !== 1) return;
    // Allow native horizontal scroll inside the tip row
    if (e.target.closest('.tt-tip-row')) return;
    // Allow the chat's own drag handler to run
    if (e.target.closest('.tt-chat-messages')) return;
    // If drag didn't start (e.g. touch on a nav button), don't cancel the tap
    if (!ttIsDragging) return;
    e.preventDefault();
    onTtMove(e.touches[0].clientY);
  }, { passive: false });
  ttFeed.addEventListener('touchend', onTtEnd, { passive: true });

  // Mouse (desktop)
  ttFeed.addEventListener('mousedown', e => { if (!e.target.closest('.tt-overlay') && !e.target.closest('.tt-nav-btn')) onTtStart(e.clientY); });
  window.addEventListener('mousemove', e => { if (ttIsDragging) onTtMove(e.clientY); });
  window.addEventListener('mouseup',   () => { if (ttIsDragging) onTtEnd(); });

  // Nav buttons — mousedown for reliable desktop, touchend for mobile
  function ttPrevAction(e) { e.stopPropagation(); ttGoTo(ttIndex - 1); }
  function ttNextAction(e) { e.stopPropagation(); ttGoTo(ttIndex + 1); }
  if (ttPrevBtnEl) {
    ttPrevBtnEl.addEventListener('mousedown', e => { if (e.button === 0) { e.stopPropagation(); ttPrevAction(e); } });
    ttPrevBtnEl.addEventListener('touchend', e => { e.preventDefault(); ttPrevAction(e); }, { passive: false });
  }
  if (ttNextBtnEl) {
    ttNextBtnEl.addEventListener('mousedown', e => { if (e.button === 0) { e.stopPropagation(); ttNextAction(e); } });
    ttNextBtnEl.addEventListener('touchend', e => { e.preventDefault(); ttNextAction(e); }, { passive: false });
  }

  // Chat send
  function sendTtChat() {
    if (!ttInputEl) return;
    const text = ttInputEl.value.trim();
    if (!text) return;
    // Allow sending when broadcasting (use own socket as stream room) or watching
    if (!currentWatchingStreamerId && !isStreaming) return;
    const clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingPublicMessageIds.add(clientMsgId);
    addChatMessage(text, 'local');
    socket.emit('public-chat-message', { text, clientMsgId });
    ttInputEl.value = '';
  }
  if (ttSendBtnEl) ttSendBtnEl.addEventListener('click', sendTtChat);
  if (ttInputEl)   ttInputEl.addEventListener('keypress', e => { if (e.key === 'Enter') sendTtChat(); });

  // Go Live / Random / Mute buttons inside TikTok feed
  const ttGoLiveEl  = document.getElementById('ttGoLiveBtn');
  const ttRandomEl  = document.getElementById('ttRandomBtn');
  const ttMuteMicEl = document.getElementById('ttMuteMicBtn');
  const ttMuteStreamEl = document.getElementById('ttMuteStreamBtn');
  if (ttMuteStreamEl) {
    ttMuteStreamEl.textContent = isStreamMuted ? '🔇' : '🔊';
    ttMuteStreamEl.title = isStreamMuted ? 'Unmute stream' : 'Mute stream';
  }
  if (ttGoLiveEl)  ttGoLiveEl.addEventListener('click',  () => { if (goLiveBtn) goLiveBtn.click(); });
  if (ttRandomEl)  ttRandomEl.addEventListener('click',  () => { exitTtMode(); if (goRandomBtn) goRandomBtn.click(); });
  if (ttMuteStreamEl) ttMuteStreamEl.addEventListener('click', () => {
    // Mute the viewer stream video (ttStreamVideo or publicStreamVideo in TT mode)
    const streamVid = document.getElementById('ttStreamVideo') || publicStreamVideo;
    if (!streamVid) return;
    isStreamMuted = !isStreamMuted;
    streamVid.muted = isStreamMuted;
    if (publicStreamVideo) publicStreamVideo.muted = isStreamMuted;
    localStorage.setItem('streamMuted', isStreamMuted);
    ttMuteStreamEl.textContent = isStreamMuted ? '🔇' : '🔊';
    ttMuteStreamEl.title = isStreamMuted ? 'Unmute stream' : 'Mute stream';
  });
  if (ttMuteMicEl) ttMuteMicEl.addEventListener('click', () => {
    if (!publicStreamLocalStream) return;
    const audioTrack = publicStreamLocalStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    const muted = !audioTrack.enabled;
    ttMuteMicEl.textContent = '\uD83C\uDF99\uFE0F';
    ttMuteMicEl.classList.toggle('muted', muted);
    ttMuteMicEl.title = muted ? 'Unmute mic' : 'Mute mic';
  });

  // Resize: update slide heights (also fires on Android soft-keyboard show/hide)
  window.addEventListener('resize', () => {
    ttSyncSlideHeights();
    ttUpdatePos(false);
  });
  // visualViewport covers Android address-bar / keyboard resize events
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      ttSyncSlideHeights();
      ttUpdatePos(false);
    });
  }

  // Tip buttons inside TikTok feed — reuse existing tip-btn logic
  ttFeed.querySelectorAll('.tip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseInt(btn.dataset.amount, 10);
      if (!amount || !currentWatchingStreamerId) return;
      socket.emit('send-tip', { streamerId: currentWatchingStreamerId, amount });
    });
  });
}

// ── Mark stream as live when video is actually playing ──
if (publicStreamVideo) {
  publicStreamVideo.addEventListener('playing', () => {
    if (ttActive && publicStreamArea) publicStreamArea.classList.add('tt-stream-live');
  });
  publicStreamVideo.addEventListener('pause', () => {
    if (publicStreamArea) publicStreamArea.classList.remove('tt-stream-live');
  });
  publicStreamVideo.addEventListener('emptied', () => {
    if (publicStreamArea) publicStreamArea.classList.remove('tt-stream-live');
  });
}

// ── Nudity detection ──────────────────────────────────────────────────────────
// Scans the user's own local video feed every few seconds.
// If explicit content is detected, notifies the server which will ban and kick.
(function initNudityScanner() {
  const SCAN_INTERVAL_MS = 3000;      // scan every 3 seconds
  const PORN_THRESHOLD = 0.70;        // flag if "Porn" class confidence ≥ 70%
  const CANVAS_SIZE = 224;            // NSFWJS MobileNet expects 224×224

  let nsfwModel = null;
  let scanTimer = null;
  let violationReported = false;

  // Load model lazily once the page is idle
  async function loadModel() {
    if (nsfwModel || typeof nsfwjs === 'undefined') return;
    try {
      nsfwModel = await nsfwjs.load();
      console.log('[nudity-scan] model loaded');
    } catch (e) {
      console.warn('[nudity-scan] model load failed:', e);
    }
  }

  if (window.requestIdleCallback) {
    requestIdleCallback(loadModel, { timeout: 10000 });
  } else {
    setTimeout(loadModel, 5000);
  }

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = CANVAS_SIZE;
  offscreenCanvas.height = CANVAS_SIZE;
  const ctx2d = offscreenCanvas.getContext('2d');

  async function scanFrame() {
    if (violationReported) return;
    if (!nsfwModel) return;
    if (!localVideo || !localVideo.srcObject || localVideo.readyState < 2) return;
    if (localVideo.videoWidth === 0 || localVideo.videoHeight === 0) return;

    try {
      ctx2d.drawImage(localVideo, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const predictions = await nsfwModel.classify(offscreenCanvas);
      const pornEntry = predictions.find(p => p.className === 'Porn');
      if (pornEntry && pornEntry.probability >= PORN_THRESHOLD) {
        violationReported = true;
        console.warn('[nudity-scan] explicit content detected, probability:', pornEntry.probability);
        socket.emit('nudity-detected', { probability: pornEntry.probability });
      }
    } catch (e) {
      console.warn('[nudity-scan] classify error:', e);
    }
  }

  function startScanner() {
    if (scanTimer) return;
    scanTimer = setInterval(scanFrame, SCAN_INTERVAL_MS);
  }

  function stopScanner() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  }

  // Start scanning when local camera stream begins, stop when it ends
  const _origSetRandomMode = typeof setRandomMode !== 'undefined' ? setRandomMode : null;
  socket.on('connect', () => { violationReported = false; });

  // Poll isRunning state to start/stop the scanner
  setInterval(() => {
    if (typeof isRunning !== 'undefined' && isRunning && localVideo && localVideo.srcObject) {
      startScanner();
    } else {
      stopScanner();
    }
  }, 1000);

  // Handle server-initiated kick for nudity violation
  socket.on('nudity-kick', ({ reason } = {}) => {
    stopScanner();
    if (typeof stopRandomMode === 'function') {
      stopRandomMode({ notifyPartner: false, notifySearching: false, statusText: 'Removed: explicit content detected' });
    }
    alert('Your session was ended because explicit content was detected on your camera.\nRepeated violations will result in a permanent ban.');
  });
})();

// Sync coin balance into TikTok overlay
const _origCoinBalance = socket.listeners ? null : null;
socket.on('coin-balance', () => {
  if (ttCoinCountEl && coinCountEl) ttCoinCountEl.textContent = coinCountEl.textContent;
});

// ═══════════════════════════════════
//  Fullscreen Stream
// ═══════════════════════════════════


const fullscreenStreamBtn = document.getElementById('fullscreenStreamBtn');
const fullscreenChat = document.getElementById('fullscreenChat');
const fullscreenChatInputWrap = document.querySelector('.fullscreen-chat-input-wrap');
const fullscreenChatInput = document.getElementById('fullscreenChatInput');
const fullscreenSendBtn = document.getElementById('fullscreenSendBtn');
let isStreamFullscreen = false;

function mirrorChatToFullscreen() {
  if (!fullscreenChat || !isStreamFullscreen) return;
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;
  // Clone last 15 messages
  const msgs = chatMessages.querySelectorAll('.chat-message');
  fullscreenChat.innerHTML = '';
  const start = Math.max(0, msgs.length - 15);
  for (let i = start; i < msgs.length; i++) {
    const clone = msgs[i].cloneNode(true);
    fullscreenChat.appendChild(clone);
  }
  fullscreenChat.scrollTop = fullscreenChat.scrollHeight;
  // Show input in fullscreen
  if (fullscreenChatInputWrap) {
    fullscreenChatInputWrap.style.display = isStreamFullscreen ? 'flex' : 'none';
  }
}

// Mirror new messages in real-time when fullscreen
let fsChatObserver = null;

function startFullscreenChatMirror() {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages || fsChatObserver) return;
  fsChatObserver = new MutationObserver(() => mirrorChatToFullscreen());
  fsChatObserver.observe(chatMessages, { childList: true });
  mirrorChatToFullscreen();
}

function stopFullscreenChatMirror() {
  if (fsChatObserver) {
    fsChatObserver.disconnect();
    fsChatObserver = null;
  }
  if (fullscreenChat) fullscreenChat.innerHTML = '';
}

if (fullscreenStreamBtn && publicStreamArea) {
  let isFakeFullscreen = false;

  function enterFullscreenUI() {
    isStreamFullscreen = true;
    publicStreamArea.classList.add('stream-fullscreen');
    fullscreenStreamBtn.textContent = '⛶';
    fullscreenStreamBtn.title = 'Exit fullscreen';
    startFullscreenChatMirror();
    if (fullscreenChatInputWrap) fullscreenChatInputWrap.style.display = 'flex';
  }

  function exitFullscreenUI() {
    isStreamFullscreen = false;
    publicStreamArea.classList.remove('stream-fullscreen', 'stream-fake-fullscreen');
    document.body.classList.remove('stream-fake-fullscreen-active');
    // Remove JS-applied inline sizing
    publicStreamArea.style.top = '';
    publicStreamArea.style.left = '';
    publicStreamArea.style.width = '';
    publicStreamArea.style.height = '';
    // Stop visualViewport listeners
    if (fakeFullscreenVPListener && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', fakeFullscreenVPListener);
      window.visualViewport.removeEventListener('scroll', fakeFullscreenVPListener);
      fakeFullscreenVPListener = null;
    }
    fullscreenStreamBtn.textContent = '⛶';
    fullscreenStreamBtn.title = 'Fullscreen';
    stopFullscreenChatMirror();
    if (fullscreenChatInputWrap) fullscreenChatInputWrap.style.display = 'none';
    isFakeFullscreen = false;
  }

  let fakeFullscreenVPListener = null;

  function applyFakeFullscreenSize() {
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0;
    const left = vv ? vv.offsetLeft : 0;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    publicStreamArea.style.top = top + 'px';
    publicStreamArea.style.left = left + 'px';
    publicStreamArea.style.width = w + 'px';
    publicStreamArea.style.height = h + 'px';
  }

  function enterFakeFullscreen() {
    isFakeFullscreen = true;
    publicStreamArea.classList.add('stream-fake-fullscreen');
    document.body.classList.add('stream-fake-fullscreen-active');
    applyFakeFullscreenSize();
    // Keep size in sync when browser bars show/hide or keyboard opens
    if (window.visualViewport) {
      fakeFullscreenVPListener = () => applyFakeFullscreenSize();
      window.visualViewport.addEventListener('resize', fakeFullscreenVPListener);
      window.visualViewport.addEventListener('scroll', fakeFullscreenVPListener);
    }
    enterFullscreenUI();
  }

  fullscreenStreamBtn.addEventListener('click', () => {
    // Exit path
    if (isFakeFullscreen) {
      exitFullscreenUI();
      return;
    }
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    // Enter path — try native fullscreen, fall back to CSS fake
    const reqFS = publicStreamArea.requestFullscreen ||
                  publicStreamArea.webkitRequestFullscreen ||
                  publicStreamArea.mozRequestFullScreen;
    if (reqFS) {
      const p = reqFS.call(publicStreamArea);
      if (p && p.catch) {
        p.catch(() => enterFakeFullscreen());
      }
    } else {
      enterFakeFullscreen();
    }
  });

  function onNativeFullscreenChange() {
    if (isFakeFullscreen) return;
    const active = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (active) {
      enterFullscreenUI();
    } else {
      exitFullscreenUI();
    }
  }
  document.addEventListener('fullscreenchange', onNativeFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onNativeFullscreenChange);
// Fullscreen chat send
if (fullscreenSendBtn && fullscreenChatInput) {
  fullscreenSendBtn.onclick = () => {
    const text = fullscreenChatInput.value.trim();
    if (!text) return;
    const clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingPublicMessageIds.add(clientMsgId);
    addChatMessage(text, 'local');
    socket.emit('public-chat-message', { text, clientMsgId });
    fullscreenChatInput.value = '';
  };
  fullscreenChatInput.onkeypress = (e) => {
    if (e.key === 'Enter') fullscreenSendBtn.onclick();
  };
}
}

// ═══════════════════════════════════
//  QR Code — Share Live Stream
// ═══════════════════════════════════

const shareStreamBtn = document.getElementById('shareStreamBtn');
const qrModal = document.getElementById('qrModal');
const closeQrModal = document.getElementById('closeQrModal');
const qrCanvas = document.getElementById('qrCanvas');
const qrLinkEl = document.getElementById('qrLink');
const copyStreamLink = document.getElementById('copyStreamLink');

if (shareStreamBtn) {
  shareStreamBtn.addEventListener('click', () => {
    if (!isStreaming) return;
    const streamUrl = `${window.location.origin}?watch=${socket.id}`;
    qrCanvas.innerHTML = '';
    if (window.QRCode) {
      new QRCode(qrCanvas, {
        text: streamUrl,
        width: 220,
        height: 220,
        colorDark: '#E6E1E5',
        colorLight: '#1C1B1F',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
    qrLinkEl.textContent = streamUrl;
    qrModal.style.display = 'flex';
  });
}

const ttShareBtnEl = document.getElementById('ttShareBtn');
if (ttShareBtnEl) {
  ttShareBtnEl.addEventListener('click', () => {
    const shareId = isStreaming ? socket.id : currentWatchingStreamerId;
    if (!shareId) return;
    const streamUrl = `${window.location.origin}?watch=${shareId}`;
    if (qrCanvas) qrCanvas.innerHTML = '';
    if (window.QRCode && qrCanvas) {
      new QRCode(qrCanvas, {
        text: streamUrl,
        width: 220,
        height: 220,
        colorDark: '#E6E1E5',
        colorLight: '#1C1B1F',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
    if (qrLinkEl) qrLinkEl.textContent = streamUrl;
    if (qrModal) qrModal.style.display = 'flex';
  });
}

if (closeQrModal) {
  closeQrModal.addEventListener('click', () => { qrModal.style.display = 'none'; });
}
if (qrModal) {
  qrModal.addEventListener('click', (e) => { if (e.target === qrModal) qrModal.style.display = 'none'; });
}
if (copyStreamLink) {
  copyStreamLink.addEventListener('click', () => {
    const link = qrLinkEl.textContent;
    navigator.clipboard.writeText(link).then(() => {
      copyStreamLink.textContent = '✅ Copied!';
      setTimeout(() => { copyStreamLink.textContent = '📋 Copy Link'; }, 2000);
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      copyStreamLink.textContent = '✅ Copied!';
      setTimeout(() => { copyStreamLink.textContent = '📋 Copy Link'; }, 2000);
    });
  });
}

// ── Auto-watch from URL param ──
let pendingWatchId = null;
(function checkAutoWatch() {
  const params = new URLSearchParams(window.location.search);
  const watchId = params.get('watch');
  if (watchId) {
    // Clean URL but save the ID for after sign-in
    window.history.replaceState({}, '', window.location.pathname);
    pendingWatchId = watchId;
  }
})();
