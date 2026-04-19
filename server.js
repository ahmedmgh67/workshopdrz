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

function broadcastState() {
  const users = Object.values(store).map(u => ({ id: u.uid, name: u.name, totalCost: u.totalCost }));
  const msg = JSON.stringify({ type: 'state', users });
  wss.clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'state', users: Object.values(store).map(u => ({ id: u.uid, name: u.name, totalCost: u.totalCost })) }));

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'update') {
        const uid = String(msg.uid || '').slice(0, 64);
        if (!uid) return;
        if (!store[uid]) store[uid] = { uid, name: 'Anonymous', totalCost: 0 };
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
