// Chat elements
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const onlineUsersList = document.getElementById('onlineUsersList');
const AI_PARTNER_LABEL = '🤖 AI Partner';

// Chat histories for public and private (random) chat
let publicChatHistory = '';
let privateChatHistory = '';

// Restore public chat history from localStorage on page load
const savedPublicChat = localStorage.getItem('publicChatHistory');
if (savedPublicChat) {
  publicChatHistory = savedPublicChat;
  chatMessages.innerHTML = publicChatHistory;
}

// Online users panel toggle logic (top bar)
const usersPanelToggle = document.getElementById('usersPanelToggle');
const onlineUsersPanel = document.getElementById('onlineUsersPanel');
if (usersPanelToggle && onlineUsersPanel) {
  usersPanelToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = onlineUsersPanel.classList.contains('open');
    if (isOpen) {
      onlineUsersPanel.classList.remove('open');
      setTimeout(() => { onlineUsersPanel.style.display = 'none'; }, 180);
    } else {
      onlineUsersPanel.classList.add('open');
      onlineUsersPanel.style.display = 'flex';
    }
  });
}
const socket = io();
console.log('Socket.IO client initialized');

const i18n = window.PALPAIR_I18N;
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
    reportSubmitted: 'Safety report submitted. Thank you for helping keep Palpair safe.',
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

// Update connected users count in panel title
socket.on('user-count', ({ total = 0, humans = 0, bots = 0 }) => {
  const connectedUsersCount = document.getElementById('connectedUsersCount');
  if (connectedUsersCount) {
    connectedUsersCount.textContent = total || (humans + bots);
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
const profileForm = document.getElementById('profileForm');
const chatInterface = document.getElementById('chatInterface');
const videosUI = document.getElementById('videosUI');
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

function syncViewportHeight() {
  const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight);
  document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);

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
const pendingPublicMessageIds = new Set();

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

  // Show public chat page after profile is saved
  showPublicChatPage();
  document.body.classList.add('chat-active');
  setRandomMode(false);
  setChatCollapsed(false);
  chatInput.disabled = false;
  sendBtn.disabled = false;
  status(translate('statusPublicRoom'));
});

function showProfilePage() {
  profilePage.style.display = 'block';
  publicChatPage.style.display = 'none';
  privateChatPage.style.display = 'none';
}

function showPublicChatPage() {
  profilePage.style.display = 'none';
  publicChatPage.style.display = 'block';
  privateChatPage.style.display = 'none';
}

function showPrivateChatPage() {
  profilePage.style.display = 'none';
  publicChatPage.style.display = 'none';
  privateChatPage.style.display = 'block';
}

// Initialize video display state
remoteVideo.style.display = 'none';
if (remotePlaceholder) {
  remotePlaceholder.style.display = 'block';
}



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

  // Show public chat page after profile is saved
  showPublicChatPage();
  document.body.classList.add('chat-active');
  setRandomMode(false);
  setChatCollapsed(false);
  chatInput.disabled = false;
  sendBtn.disabled = false;
  status(translate('statusPublicRoom'));
});

function showVideosUI() {
  if (videosUI) videosUI.style.display = 'block';
  if (chatInterface) chatInterface.style.display = 'none';
  document.body.classList.add('chat-active');
}

function showChatInterface() {
  if (chatInterface) chatInterface.style.display = 'block';
  if (videosUI) videosUI.style.display = 'none';
  document.body.classList.add('chat-active');
}

let otherId = null;
let isRunning = false;
let isChatCollapsed = false;
let localNextInProgress = false;

function setChatCollapsed(collapsed) {
  isChatCollapsed = collapsed;
  if (chatInterface) {
    chatInterface.classList.toggle('chat-collapsed', collapsed);
  }
  if (chatToggleBtn) {
    chatToggleBtn.textContent = '💬';
    chatToggleBtn.setAttribute('aria-label', collapsed ? 'Expand chat' : 'Collapse chat');
    chatToggleBtn.setAttribute('title', collapsed ? 'Expand Chat' : 'Collapse Chat');
  }
  // Switch chat context: if in random mode, show match chat, else show public room
  if (!collapsed) {
    if (isRunning && otherId) {
      // Show only private chat for current random session
      chatMessages.innerHTML = privateChatHistory;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
      // Restore public chat history ONLY if not in random chat
      chatMessages.innerHTML = publicChatHistory;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
}

function setRandomMode(active) {
  isRunning = active;
  document.body.classList.toggle('random-active', active);

  if (goRandomBtn) {
    goRandomBtn.style.display = active ? 'none' : 'block';
  }
  if (stopRandomBtn) {
    stopRandomBtn.style.display = active ? 'flex' : 'none';
  }

  if (active) {
    // Entering random chat: show private chat page, do NOT clear or overwrite chatMessages
    showPrivateChatPage();
    privateChatHistory = '';
    // Ensure matchmaking is triggered
    socket.emit('find');
  } else {
    // Leaving random chat: show public chat page, do NOT reload chatMessages
    showPublicChatPage();
    // Request latest public room events from server
    socket.emit('get-public-room-events');
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
    // Do NOT call setChatCollapsed(false) here; it can clear chatMessages
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
        // Get local video stream FIRST
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        setRandomMode(true);
        nextBtn.disabled = true;
        reportBtn.disabled = false;
        setChatCollapsed(true);

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
  // Do not modify chatMessages DOM. Only update publicChatHistory from current DOM.
  publicChatHistory = chatMessages.innerHTML;
});

socket.on('public-room-event', (event) => {
  addPublicRoomEvent(event);
});

socket.on('online-users', ({ users = [] } = {}) => {
  renderOnlineUsers(users);
});

socket.on('matched', async ({ otherId: id, initiator, isBot, botProfile, partnerProfile }) => {
  localNextInProgress = false;
  if (!isRunning) {
    status(translate('statusPublicRoom'));
    return;
  }
  console.log('>>> Matched event received, otherId:', id, 'initiator:', initiator, 'isBot:', isBot);
  
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
  remoteVideo.muted = !!isBot;
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
  
  // Create peer connection for both real users and bots
  await createPeerConnection(id, initiator);
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
  if (isRunning && otherId) {
    addChatMessage(text, 'remote');
    // Save to private chat history
    privateChatHistory = chatMessages.innerHTML;
  }
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

  if (isRunning && otherId) {
    socket.emit('chat-message', { to: otherId, text });
    addChatMessage(text, 'local');
    chatInput.value = '';
    // Save to private chat history
    privateChatHistory = chatMessages.innerHTML;
    return;
  }

  if (!isRunning) {
    const clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingPublicMessageIds.add(clientMsgId);
    socket.emit('public-chat-message', { text, clientMsgId });
    chatInput.value = '';
    // Save to public chat history will happen when event is received
  }
};

chatInput.onkeypress = (e) => {
  if (e.key === 'Enter') {
    sendBtn.onclick();
  }
};


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
    try { remoteVideo.muted = false; } catch (e) {}
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
    console.log('>>> ontrack event received', e.streams);
    if (e.streams && e.streams[0]) {
      const videoTracks = e.streams[0].getVideoTracks();
      console.log('Remote stream videoTracks:', videoTracks);
      if (videoTracks.length > 0) {
        remoteVideo.style.display = 'block';
        if (remotePlaceholder) remotePlaceholder.style.display = 'none';
        remoteVideo.srcObject = e.streams[0];
      } else {
        remoteVideo.style.display = 'none';
        if (remotePlaceholder) remotePlaceholder.style.display = 'block';
        remoteVideo.srcObject = null;
        console.warn('No remote video track received');
      }
    } else {
      remoteVideo.style.display = 'none';
      if (remotePlaceholder) remotePlaceholder.style.display = 'block';
      remoteVideo.srcObject = null;
      console.warn('No remote stream received');
    }
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
  if (statusEl) statusEl.textContent = s;
}

function addPublicRoomEvent(event = {}) {
  if (!event || typeof event.text !== 'string' || !event.text.trim()) return;
  // Always add public room events to history, even if in private chat
  const isMine = event.socketId === socket.id;
  const sender = isMine ? 'local' : 'remote';
  const prefix = isMine ? '' : `${event.name || 'Guest'}: `;
  addChatMessage(`${prefix}${event.text}`, sender);
  publicChatHistory = chatMessages.innerHTML;
  localStorage.setItem('publicChatHistory', publicChatHistory);
}

function addChatMessage(text, sender) {
  if (typeof text !== 'string' || !text.trim()) return;
  const div = document.createElement('div');
  div.className = `chat-message ${sender}`;
  chatMessages.appendChild(div);

  const messageText = text;
  const shouldType = sender === 'remote' && messageText.length > 0;

  if (!shouldType) {
    div.textContent = messageText;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return;
  }

  const maxTypingDurationMs = 1400;
  const perCharDelay = Math.max(12, Math.min(36, Math.floor(maxTypingDurationMs / messageText.length)));
  let currentIndex = 0;

  const step = () => {
    currentIndex += 1;
    div.textContent = messageText.slice(0, currentIndex);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (currentIndex < messageText.length) {
      setTimeout(step, perCharDelay);
    }
  };

  setTimeout(step, 80);
}

function clearChat() {
  chatMessages.innerHTML = '';
  chatInput.value = '';
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
    const genderEmoji = user.isBot ? '🤖' : (genderValue === 'male' ? '👨' : (genderValue === 'female' ? '👩' : '👤'));
    const baseName = user.socketId === socket.id ? `${user.name} (You)` : user.name;
    nameEl.textContent = `${genderEmoji} ${baseName}`;

    const stateEl = document.createElement('span');
    stateEl.className = 'online-user-state';
    stateEl.textContent = user.paired ? 'In random' : (user.searching ? 'Searching' : 'In room');

    item.appendChild(nameEl);
    item.appendChild(stateEl);
    onlineUsersList.appendChild(item);
  });
}
