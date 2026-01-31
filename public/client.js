const socket = io();
console.log('Socket.IO client initialized');

socket.on('connect', () => console.log('Connected to server'));
socket.on('disconnect', (reason) => console.log('Disconnected from server:', reason));

const toggleBtn = document.getElementById('toggleBtn');
const nextBtn = document.getElementById('nextBtn');
const statusEl = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remotePlaceholder = document.getElementById('remotePlaceholder');

let localStream = null;
let pc = null;
let otherId = null;
let isRunning = false;

toggleBtn.onclick = async () => {
  if (!isRunning) {
    // START: start camera and find partner
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
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

socket.on('matched', async ({ otherId: id, initiator }) => {
  console.log('>>> Matched event received, otherId:', id, 'initiator:', initiator);
  
  // Close old peer connection if exists
  if (pc) {
    pc.close();
    pc = null;
  }
  clearRemoteVideo();
  
  otherId = id;
  nextBtn.disabled = false;
  console.log('>>> Setting status to Connected');
  status('Connected');
  // stop any pending auto-reconnect attempts
  cancelAutoReconnect();
  await createPeerConnection(id, initiator);
});

socket.on('signal', async ({ from, data }) => {
  if (data.type === 'offer') {
    if (!pc) await createPeerConnection(from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('signal', { to: from, data: { type: 'answer', sdp: pc.localDescription } });
  } else if (data.type === 'answer') {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } else if (data.type === 'candidate') {
    try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn(e); }
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
  // automatically find next partner
  socket.emit('find');
});


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
    remoteVideo.style.display = 'block';
    if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    remoteVideo.srcObject = e.streams[0];
  };

  if (localStream) {
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  }

  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { to: targetId, data: { type: 'offer', sdp: pc.localDescription } });
  }
}

function status(s) {
  console.log('>>> STATUS:', s);
  statusEl.textContent = s;
}
