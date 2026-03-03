/* ═══════════════════════════════════════
   Support Chat Widget — Client JS
   ═══════════════════════════════════════ */
(function () {
  const fab = document.getElementById('chatFab');
  const widget = document.getElementById('chatWidget');
  const closeBtn = document.getElementById('chatClose');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatMsgInput');
  const messagesDiv = document.getElementById('chatWidgetMessages');

  // Persistent session ID so returning visitors keep their conversation
  let sessionId = localStorage.getItem('support_session_id');
  if (!sessionId) {
    sessionId = 'sup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('support_session_id', sessionId);
  }

  // Connect to the /support namespace
  const socket = io('/support', {
    query: { sessionId },
    transports: ['websocket', 'polling']
  });

  // ── Toggle widget ──
  fab.addEventListener('click', () => {
    widget.classList.add('open');
    fab.classList.add('hidden');
    input.focus();
  });

  closeBtn.addEventListener('click', () => {
    widget.classList.remove('open');
    fab.classList.remove('hidden');
  });

  // ── Send message ──
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    socket.emit('support-message', { text });
    appendMessage(text, 'user');
    input.value = '';
  });

  // ── Receive admin reply ──
  socket.on('admin-reply', ({ text, timestamp }) => {
    appendMessage(text, 'admin', timestamp);
    // If widget is closed, pulse the fab
    if (!widget.classList.contains('open')) {
      fab.style.animation = 'fabPulse .5s ease 3';
      setTimeout(() => { fab.style.animation = ''; }, 1600);
    }
  });

  // ── Restore history on connect ──
  socket.on('support-history', ({ messages }) => {
    if (!messages || messages.length === 0) return;
    // Clear default system message
    messagesDiv.innerHTML = '';
    messages.forEach((msg) => {
      appendMessage(msg.text, msg.from === 'admin' ? 'admin' : 'user', msg.timestamp);
    });
  });

  // ── Helpers ──
  function appendMessage(text, type, timestamp) {
    const div = document.createElement('div');
    div.className = 'chat-message ' + type;
    div.textContent = text;

    const ts = document.createElement('span');
    ts.className = 'chat-ts';
    const d = timestamp ? new Date(timestamp) : new Date();
    ts.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.appendChild(ts);

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
})();
