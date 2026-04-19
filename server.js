const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}

function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store), 'utf8');
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'hic.html')));
});

const wss = new WebSocket.Server({ server });
const active = new Map(); // ws -> uid

function broadcastState() {
  const users = Object.values(store).map(u => ({ id: u.uid, name: u.name, totalCost: u.totalCost }));
  const msg = JSON.stringify({ type: 'state', users });
  wss.clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'hello') {
        const uid = String(msg.uid).slice(0, 64);
        active.set(ws, uid);
        if (!store[uid]) store[uid] = { uid, name: msg.name || 'Anonymous', totalCost: 0 };
        ws.send(JSON.stringify({ type: 'welcome', uid, name: store[uid].name }));
        broadcastState();
      }

      if (msg.type === 'update') {
        const uid = active.get(ws);
        if (!uid) return;
        if (msg.name !== undefined) store[uid].name = String(msg.name).slice(0, 40) || 'Anonymous';
        if (typeof msg.totalCost === 'number') store[uid].totalCost = msg.totalCost;
        saveStore();
        broadcastState();
      }

      if (msg.type === 'purge') {
        store = {};
        saveStore();
        broadcastState();
      }
    } catch {}
  });

  ws.on('close', () => { active.delete(ws); });
});

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}

server.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`\n  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log(`\n  Share the Network URL with workshop participants.\n`);
});
