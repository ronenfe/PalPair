const socket = io();
console.log('Socket.IO client initialized');

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

// Profile form elements
const profileForm = document.getElementById('profileForm');
const chatInterface = document.getElementById('chatInterface');
const saveProfileBtn = document.getElementById('saveProfileBtn');

const toggleBtn = document.getElementById('toggleBtn');
const nextBtn = document.getElementById('nextBtn');
const reportBtn = document.getElementById('reportBtn');
const statusEl = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remotePlaceholder = document.getElementById('remotePlaceholder');

// Chat elements
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');

// Initialize video display state
remoteVideo.style.display = 'none';
if (remotePlaceholder) {
  remotePlaceholder.style.display = 'block';
}

let localStream = null;
let pc = null;
let isActive = false;

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
    alert('Please fill in all profile fields');
    return;
  }

  if (age < 18 || age > 100) {
    alert('Age must be between 18 and 100');
    return;
  }

  if (minAge > maxAge) {
    alert('Minimum age cannot be greater than maximum age');
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

  // Show chat interface
  profileForm.style.display = 'none';
  chatInterface.style.display = 'block';
});
let otherId = null;
let isRunning = false;

toggleBtn.onclick = async () => {
  if (!isRunning) {
    // START: start camera and find partner
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      
      // Ensure remote video is hidden when starting
      remoteVideo.style.display = 'none';
      if (remotePlaceholder) {
        remotePlaceholder.style.display = 'block';
      }
      
      isRunning = true;
      toggleBtn.textContent = 'Stop';
      status('Finding partner...');
      socket.emit('find');
    } catch (e) {
      console.error(e);
      status('Could not start camera');
    }
  } else {
    // STOP: close everything
    console.log('>>> Stop button clicked, otherId:', otherId);
    isRunning = false;
    toggleBtn.textContent = 'Start';
    nextBtn.disabled = true;
    
    // Remove from searching pool
    socket.emit('stop-searching');
    
    // Notify remote partner if connected
    if (otherId) {
      socket.emit('next');
    }
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    
    // Close peer connection
    if (pc) pc.close();
    pc = null;
    otherId = null;
    
    // Clear videos
    localVideo.srcObject = null;
    clearRemoteVideo();
    status('Stopped');
  }
};

nextBtn.onclick = () => {
  // Find next partner while already connected
  console.log('>>> Find Next button clicked, otherId:', otherId);
  status('Finding next...');
  socket.emit('next');
  if (pc) pc.close();
  pc = null;
  otherId = null;
  nextBtn.disabled = true;
  clearRemoteVideo();
  // immediately start a new find
  socket.emit('find');
};


socket.on('waiting', () => {
  console.log('>>> waiting event received');
  status('Waiting for a partner...');
});

socket.on('matched', async ({ otherId: id, initiator, isBot, botProfile }) => {
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
  chatInput.disabled = false;
  sendBtn.disabled = false;
  console.log('>>> Setting status to Connected');
  
  if (isBot && botProfile) {
    status(`Connected to ${botProfile.name}, ${botProfile.age}, from ${botProfile.country}`);
  } else {
    status('Connected');
  }
  
  // stop any pending auto-reconnect attempts
  cancelAutoReconnect();
  
  // Create peer connection for both real users and bots
  await createPeerConnection(id, initiator);
});

socket.on('signal', async ({ from, data }) => {
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
  // partner was disconnected (or asked to leave) — always reset state
  console.log('*** peer-disconnected event received from', id, '***');
  status('Waiting for a partner...');
  if (pc) pc.close();
  pc = null;
  clearRemoteVideo();
  otherId = null;
  nextBtn.disabled = true;
  clearChat();
  // automatically find next partner
  socket.emit('find');
});

// some server flows emit `peer-left` to ensure clients handle forced leaves
socket.on('peer-left', ({ id, reason }) => {
  console.log('*** peer-left event received *** id:', id, 'reason:', reason);
  status('Waiting for a partner...');
  if (pc) pc.close();
  pc = null;
  clearRemoteVideo();
  otherId = null;
  nextBtn.disabled = true;
  clearChat();
  // automatically find next partner
  socket.emit('find');
});

// Chat events
socket.on('chat-message', ({ from, text }) => {
  addChatMessage(text, 'remote');
});

socket.on('report-received', () => {
  addChatMessage('Safety report submitted. Thank you for helping keep Palpair safe.', 'system');
});

reportBtn.onclick = () => {
  const details = prompt('Report safety concern (child safety, harassment, explicit content, etc.). Please include useful details:');
  if (!details || !details.trim()) return;

  socket.emit('report-safety', {
    details: details.trim(),
    partnerId: otherId,
    statusText: statusEl.textContent
  });
};

sendBtn.onclick = () => {
  const text = chatInput.value.trim();
  if (text && otherId) {
    socket.emit('chat-message', { to: otherId, text });
    addChatMessage(text, 'local');
    chatInput.value = '';
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
    try { remoteVideo.pause(); remoteVideo.removeAttribute('src'); remoteVideo.removeAttribute('srcObject'); } catch (e) {}
    try { remoteVideo.style.display = 'none'; } catch (e) {}
    try { remoteVideo.style.backgroundColor = '#000'; } catch (e) {}
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
  statusEl.textContent = s;
}

function addChatMessage(text, sender) {
  const div = document.createElement('div');
  div.className = `chat-message ${sender}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
  chatMessages.innerHTML = '';
  chatInput.value = '';
}
