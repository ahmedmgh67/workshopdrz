const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const file = path.join(__dirname, 'hic.html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(file));
});

const wss = new WebSocket.Server({ server });
const clients = new Map();
let seq = 1;

function broadcastState() {
  const users = Array.from(clients.values()).map(c => ({
    id: c.id, name: c.name, totalCost: c.totalCost
  }));
  const msg = JSON.stringify({ type: 'state', users });
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

wss.on('connection', ws => {
  const id = 'user' + (seq++);
  clients.set(ws, { id, name: 'User ' + (seq - 1), totalCost: 0 });
  ws.send(JSON.stringify({ type: 'welcome', id }));
  broadcastState();

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'update') {
        const c = clients.get(ws);
        if (msg.name !== undefined) c.name = String(msg.name).slice(0, 40) || c.id;
        if (typeof msg.totalCost === 'number') c.totalCost = msg.totalCost;
        broadcastState();
      }
    } catch {}
  });

  ws.on('close', () => { clients.delete(ws); broadcastState(); });
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
