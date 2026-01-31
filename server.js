const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Serve the socket.io client source map if present to avoid 404 in browser
app.get('/socket.io/socket.io.js.map', (req, res) => {
  const mapPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js.map');
  if (fs.existsSync(mapPath)) return res.sendFile(mapPath);
  res.status(404).end();
});
app.get('/favicon.ico', (req, res) => res.sendStatus(204));
const waiting = [];
const pairs = new Map();
const recentlyDisconnected = new Map(); // track recent disconnections

io.on('connection', (socket) => {
  console.log('connected', socket.id);

  socket.on('find', () => {
    console.log('>>> find event received from', socket.id);
    
    // Don't add to queue if already waiting or already paired
    if (waiting.includes(socket.id)) {
      console.log('>>> already in waiting queue, ignoring');
      return;
    }
    if (pairs.has(socket.id)) {
      console.log('>>> already paired, ignoring');
      return;
    }
    
    console.log('>>> waiting queue before:', waiting);
    // try to match with someone waiting
    let matched = false;
    const skipped = [];
    
    while (waiting.length > 0) {
      const otherId = waiting.shift();
      console.log('>>> trying to match with', otherId);
      
      // check if they recently disconnected from each other (within 5 seconds)
      const recentKey = [socket.id, otherId].sort().join('-');
      if (recentlyDisconnected.has(recentKey)) {
        console.log('>>> skipping recently disconnected pair:', recentKey);
        skipped.push(otherId); // remember to put back later
        continue;
      }
      
      const otherSocket = io.sockets.sockets.get(otherId);
      console.log('>>> otherSocket found:', !!otherSocket, 'disconnected:', otherSocket?.disconnected);
      if (!otherSocket || otherSocket.disconnected) continue; // skip stale

      console.log('>>> MATCHED!', socket.id, 'with', otherId);
      pairs.set(socket.id, otherId);
      pairs.set(otherId, socket.id);

      io.to(socket.id).emit('matched', { otherId, initiator: true });
      io.to(otherId).emit('matched', { otherId: socket.id, initiator: false });
      matched = true;
      break;
    }
    
    // put back skipped users
    waiting.unshift(...skipped);
    
    if (!matched) {
      waiting.push(socket.id);
      console.log('>>> added to waiting queue, queue now:', waiting);
      socket.emit('waiting');
    }
  });

  socket.on('signal', ({ to, data }) => {
    if (!to) return;
    const dest = io.sockets.sockets.get(to);
    if (dest) dest.emit('signal', { from: socket.id, data });
  });

  socket.on('next', () => {
    // requester wants to leave current partner and/or skip waiting
    console.log('>>> next event received from', socket.id);
    const partner = pairs.get(socket.id);
    console.log('>>> partner found:', partner);
    if (partner) {
      // mark this pair as recently disconnected (10 second cooldown)
      const recentKey = [socket.id, partner].sort().join('-');
      recentlyDisconnected.set(recentKey, true);
      setTimeout(() => recentlyDisconnected.delete(recentKey), 10000);
      
      // notify partner that their peer left
      console.log(`${socket.id} requested next; notifying partner ${partner}`);
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      io.to(partner).emit('peer-left', { id: socket.id, reason: 'peer-requested-next' });
      io.to(socket.id).emit('peer-disconnected', { id: partner });
      io.to(socket.id).emit('peer-left', { id: partner, reason: 'you-left' });
      pairs.delete(partner);
      pairs.delete(socket.id);
    }

    // if the requester was in the waiting queue, remove them
    const idx = waiting.indexOf(socket.id);
    if (idx !== -1) waiting.splice(idx, 1);
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit('peer-disconnected', { id: socket.id });
      pairs.delete(partner);
      pairs.delete(socket.id);
    } else {
      const idx = waiting.indexOf(socket.id);
      if (idx !== -1) waiting.splice(idx, 1);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
