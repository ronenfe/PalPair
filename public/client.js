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
    statusPublicRoom: 'Public room',
    statusReturnedPublic: 'Back in public room',
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

// Sound notification for matches
const matchSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZURE');

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
const AI_PARTNER_LABEL = '🤖 AI Partner';

// Public stream elements
const goLiveBtn = document.getElementById('goLiveBtn');
const publicStreamArea = document.getElementById('publicStreamArea');
const publicStreamVideo = document.getElementById('publicStreamVideo');
const publicStreamName = document.getElementById('publicStreamName');
const publicStreamViewerCount = document.getElementById('publicStreamViewerCount');
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
let lastKnownStreamers = [];

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
remoteVideo.style.display = 'none';
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
let publicStreamViewerPC = null;    // single PC for viewer-side
let currentWatchingStreamerId = null;
let pendingWatchByIdActive = false;

// User profile and filters
let userProfile = null;
let userFilters = null;

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
saveProfileBtn.addEventListener('click', () => {
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
    alert(translate('alertFillProfile'));
    return;
  }

  if (age < 18 || age > 100) {
    alert(translate('alertAgeRange'));
    return;
  }

  if (minAge > maxAge) {
    alert(translate('alertMinMax'));
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

  // Show chat interface and hide profile view
  if (profileContainer) {
    profileContainer.style.display = 'none';
  } else if (profileForm) {
    profileForm.style.display = 'none';
  }
  chatInterface.style.display = 'flex';
  document.body.classList.add('chat-active');
  setRandomMode(false);
  chatInput.disabled = false;
  sendBtn.disabled = false;
  status(translate('statusPublicRoom'));

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
  isRunning = active;
  document.body.classList.toggle('random-active', active);

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
    // Re-check for active public streamers when returning to public room
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
    nextBtn.disabled = true;
    reportBtn.disabled = true;
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
    localVideo.srcObject = null;
    setAiPartnerBadge(false);
  }
}

function setAiPartnerBadge(visible) {
  if (!aiPartnerBadge) return;
  aiPartnerBadge.style.display = visible ? 'inline-flex' : 'none';
}

function stopRandomMode({ notifyPartner = false, notifySearching = true, statusText = translate('statusReturnedPublic') } = {}) {
  if (!isRunning) return;

  if (notifyPartner && otherId) {
    socket.emit('next');
  }
  if (notifySearching) {
    socket.emit('stop-searching');
  }

  setRandomMode(false);
  status(statusText === 'statusReturnedPublic' ? 'Back in public room' : statusText);
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
        remoteVideo.style.display = 'none';
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
    stopRandomMode({ notifyPartner: true, notifySearching: true, statusText: translate('statusReturnedPublic') });
  };
}

nextBtn.onclick = () => {
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
  nextBtn.disabled = true;
  clearRemoteVideo();
  socket.emit('find');
};


socket.on('waiting', () => {
  localNextInProgress = false;
  if (!isRunning) {
    status(translate('statusPublicRoom'));
    return;
  }
  setAiPartnerBadge(false);
  console.log('>>> waiting event received');
  status(translate('statusWaiting'));
});

socket.on('public-room-init', ({ events = [] } = {}) => {
  clearChat();
  events.forEach((event) => addPublicRoomEvent(event));
});

socket.on('public-room-event', (event) => {
  addPublicRoomEvent(event);
});

// ── Per-streamer chat room events ──
socket.on('stream-chat-init', ({ streamerId, events = [] } = {}) => {
  clearChat();
  events.forEach((event) => addPublicRoomEvent(event));
});

socket.on('stream-chat-event', ({ streamerId, event } = {}) => {
  addPublicRoomEvent(event);
});

socket.on('stream-room-users', ({ streamerId, users = [] } = {}) => {
  renderOnlineUsers(users);
});

socket.on('online-users', ({ users = [] } = {}) => {
  renderOnlineUsers(users);
});

socket.on('matched', async ({ otherId: id, initiator, isBot, botProfile, botVideoUrl, partnerProfile }) => {
  localNextInProgress = false;
  if (!isRunning) {
    status(translate('statusPublicRoom'));
    return;
  }
  console.log('>>> Matched event received, otherId:', id, 'initiator:', initiator, 'isBot:', isBot);
  
  // Clear private chat for fresh conversation
  privateChatHistory = '';
  if (privateChatMessages) privateChatMessages.innerHTML = '';
  
  // Play sound notification
  try {
    matchSound.currentTime = 0;
    matchSound.play().catch(e => console.log('Sound play failed:', e));
  } catch (e) {
    console.log('Sound error:', e);
  }
  
  // Close old peer connection if exists
  if (pc) {
    pc.close();
    pc = null;
  }
  clearRemoteVideo();
  
  // Ensure remote video is hidden until track arrives
  remoteVideo.style.display = 'none';
  if (remotePlaceholder) {
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
    remoteVideo.muted = true;
    remoteVideo.style.display = 'block';
    if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    remoteVideo.play().catch(e => console.log('Bot video play failed:', e));
  } else {
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
    status(translate('statusPublicRoom'));
    return;
  }
  console.log('*** peer-disconnected event received from', id, '***');
  stopRandomMode({ notifyPartner: false, notifySearching: false, statusText: translate('statusReturnedPublic') });
});

// some server flows emit `peer-left` to ensure clients handle forced leaves
socket.on('peer-left', ({ id, reason }) => {
  if (localNextInProgress) {
    return;
  }
  if (!isRunning) {
    status(translate('statusPublicRoom'));
    return;
  }
  console.log('*** peer-left event received *** id:', id, 'reason:', reason);
  stopRandomMode({ notifyPartner: false, notifySearching: false, statusText: translate('statusReturnedPublic') });
});

// Chat events
socket.on('chat-message', ({ from, text }) => {
  addChatMessage(text, 'remote');
});

socket.on('report-received', () => {
  addChatMessage(translate('reportSubmitted'), 'system');
});

reportBtn.onclick = () => {
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
    try { remoteVideo.srcObject = null; } catch (e) {}
    try { remoteVideo.muted = false; remoteVideo.loop = false; } catch (e) {}
    try { remoteVideo.pause(); remoteVideo.removeAttribute('src'); remoteVideo.removeAttribute('srcObject'); } catch (e) {}
    try { remoteVideo.style.display = 'none'; } catch (e) {}
    try { remoteVideo.style.backgroundColor = '#000'; } catch (e) {}
    setAiPartnerBadge(false);
    if (remotePlaceholder) {
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
  pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', { to: targetId, data: { type: 'candidate', candidate: e.candidate } });
    }
  };

  pc.ontrack = (e) => {
    console.log('>>> ontrack event received');
    remoteVideo.style.display = 'block';
    if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    remoteVideo.srcObject = e.streams[0];
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
  // Hide the whole status element when in public room
  if (s === translate('statusPublicRoom') || s === 'Back in public room') {
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
  targetDiv.appendChild(div);

  const messageText = String(text || '');
  const shouldType = sender === 'remote' && messageText.length > 0;

  // Timestamp — use server timestamp if available, else current time
  const ts = serverTimestamp ? new Date(serverTimestamp) : new Date();
  const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-timestamp';
  timeSpan.textContent = timeStr;

  if (!shouldType) {
    div.textContent = messageText;
    div.appendChild(timeSpan);
    // Update chat history buffer after content is set
    if (targetDiv === chatMessages) {
      publicChatHistory += div.outerHTML;
    } else {
      privateChatHistory += div.outerHTML;
    }
    targetDiv.scrollTop = targetDiv.scrollHeight;
    return;
  }

  const maxTypingDurationMs = 1400;
  const perCharDelay = Math.max(12, Math.min(36, Math.floor(maxTypingDurationMs / messageText.length)));
  let currentIndex = 0;

  const step = () => {
    currentIndex += 1;
    div.textContent = messageText.slice(0, currentIndex);
    div.appendChild(timeSpan);
    targetDiv.scrollTop = targetDiv.scrollHeight;
    // Update buffer for typing effect
    if (targetDiv === chatMessages) {
      publicChatHistory = targetDiv.innerHTML;
    } else {
      privateChatHistory = targetDiv.innerHTML;
    }

    if (currentIndex < messageText.length) {
      setTimeout(step, perCharDelay);
    }
  };

  setTimeout(step, 80);
}

function clearChat() {
  chatMessages.innerHTML = '';
  privateChatMessages.innerHTML = '';
  publicChatHistory = '';
  privateChatHistory = '';
  chatInput.value = '';
  if (privateChatInput) privateChatInput.value = '';
}

function renderOnlineUsers(users = []) {
  if (!onlineUsersList) return;
  onlineUsersList.innerHTML = '';

  if (!users.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'online-user-item empty';
    emptyItem.textContent = 'No users online';
    onlineUsersList.appendChild(emptyItem);
    return;
  }

  users.forEach((user) => {
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
    }

    onlineUsersList.appendChild(item);
  });
}

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

async function startPublicStream() {
  try {
    publicStreamLocalStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: useFrontCamera ? 'user' : 'environment' }, audio: true });
    isStreaming = true;
    goLiveBtn.textContent = translate('stopLive');
    goLiveBtn.classList.add('is-live');
    // Show own stream
    if (publicStreamArea) publicStreamArea.style.display = 'flex';
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = publicStreamLocalStream;
      publicStreamVideo.muted = true; // mute own playback
    }
    if (publicStreamName) publicStreamName.textContent = 'You (Live)';
    if (flipCameraBtnLive) flipCameraBtnLive.style.display = 'flex';
    const shareBtn = document.getElementById('shareStreamBtn');
    if (shareBtn) shareBtn.style.display = 'inline-flex';
    socket.emit('start-public-stream');
  } catch (e) {
    console.error('Failed to start public stream:', e);
  }
}

function stopPublicStream() {
  isStreaming = false;
  goLiveBtn.textContent = translate('goLive');
  goLiveBtn.classList.remove('is-live');
  if (flipCameraBtnLive) flipCameraBtnLive.style.display = 'none';
  const shareBtn = document.getElementById('shareStreamBtn');
  if (shareBtn) shareBtn.style.display = 'none';
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
}

// ── Streamer: handle new viewer joining ──
socket.on('public-stream-viewer-joined', async ({ viewerId }) => {
  if (!isStreaming || !publicStreamLocalStream) return;
  // Create a peer connection for this viewer
  const viewerPC = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
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

  // Create offer
  const offer = await viewerPC.createOffer();
  await viewerPC.setLocalDescription(offer);
  socket.emit('public-stream-signal', { to: viewerId, data: { type: 'offer', sdp: viewerPC.localDescription } });
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
socket.on('public-stream-ready', ({ streamerId, streamerName, streamerIndex, botVideoUrl, viewerCount }) => {
  // If user has hidden the stream, don't show it
  if (streamHiddenByUser) {
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
  if (publicStreamName) publicStreamName.textContent = streamerName;
  if (publicStreamViewerCount) publicStreamViewerCount.textContent = `👁 ${viewerCount || 0}`;
  if (publicStreamVideo && !isStreaming) publicStreamVideo.muted = false;

  // If bot stream, play MP4 directly (no WebRTC)
  if (botVideoUrl) {
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = null;
      publicStreamVideo.src = botVideoUrl;
      publicStreamVideo.loop = false;
      publicStreamVideo.muted = false;
      publicStreamVideo.play().catch(e => console.log('Bot stream play failed:', e));
    }
    return;
  }

  // Create viewer peer connection (receive only) for real streamers
  publicStreamViewerPC = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  publicStreamViewerPC.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('public-stream-signal', { to: streamerId, data: { type: 'candidate', candidate: e.candidate } });
    }
  };

  publicStreamViewerPC.ontrack = (e) => {
    if (publicStreamVideo) {
      publicStreamVideo.srcObject = e.streams[0];
      if (!isStreaming) publicStreamVideo.muted = false;
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
  if (publicStreamViewerPC) {
    publicStreamViewerPC.close();
    publicStreamViewerPC = null;
  }
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
  // Update viewer count if currently watching
  if (currentWatchingStreamerId) {
    const current = streamers.find(s => s.socketId === currentWatchingStreamerId);
    if (current && publicStreamViewerCount) {
      publicStreamViewerCount.textContent = `👁 ${current.viewerCount || 0}`;
    }
  }
  // Render the streamers discovery grid
  renderStreamersGrid(streamers);
  // If not currently watching and not streaming, and there are streamers, auto-watch first
  // Skip auto-watch if we have a pending watch-by-id request in flight
  if (!isStreaming && !currentWatchingStreamerId && !streamHiddenByUser && !pendingWatchByIdActive && streamers.length > 0) {
    socket.emit('watch-public-stream', { streamerIndex: 0 });
  }
  // If no streamers left, reset the hidden flag so next stream auto-shows
  if (streamers.length === 0) streamHiddenByUser = false;
});

function renderStreamersGrid(streamers) {
  if (!streamersCards || !streamersCountEl) return;
  
  // Update count
  streamersCountEl.textContent = `${streamers.length} live`;
  
  // Clear existing cards (except the no-streamers message)
  const existingCards = streamersCards.querySelectorAll('.streamer-card');
  existingCards.forEach(c => c.remove());
  
  if (streamers.length === 0) {
    if (noStreamersMsg) noStreamersMsg.style.display = '';
    return;
  }
  
  if (noStreamersMsg) noStreamersMsg.style.display = 'none';
  
  streamers.forEach((streamer) => {
    const card = document.createElement('div');
    card.className = 'streamer-card';
    if (streamer.socketId === currentWatchingStreamerId) {
      card.classList.add('watching');
    }
    
    // Build card background: video preview for bots, gradient + emoji for real streamers
    if (streamer.botVideoUrl) {
      card.innerHTML = `
        <video class="streamer-card-video" src="${streamer.botVideoUrl}" muted playsinline loop autoplay></video>
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
//  Fullscreen Stream
// ═══════════════════════════════════

const fullscreenStreamBtn = document.getElementById('fullscreenStreamBtn');
const fullscreenChat = document.getElementById('fullscreenChat');
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
}

// Mirror new messages in real-time when fullscreen
const _origPushPublicRoom = window._origPushPublicRoom; // not needed, use MutationObserver
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
  fullscreenStreamBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      publicStreamArea.requestFullscreen().catch(err => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    isStreamFullscreen = !!document.fullscreenElement;
    if (isStreamFullscreen) {
      publicStreamArea.classList.add('stream-fullscreen');
      fullscreenStreamBtn.textContent = '⛶';
      fullscreenStreamBtn.title = 'Exit fullscreen';
      startFullscreenChatMirror();
    } else {
      publicStreamArea.classList.remove('stream-fullscreen');
      fullscreenStreamBtn.textContent = '⛶';
      fullscreenStreamBtn.title = 'Fullscreen';
      stopFullscreenChatMirror();
    }
  });
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
