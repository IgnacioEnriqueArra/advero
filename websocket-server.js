
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Map screenId -> Set of client sockets (screens)
const screens = new Map();

console.log('AdVero Ultra-Fast WebSocket Server running on port 8080');

wss.on('connection', (ws) => {
  console.log('New connection');

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        // Screen registering itself
        const { screenId } = data;
        if (!screenId) return;

        console.log(`Screen registered: ${screenId}`);
        
        if (!screens.has(screenId)) {
          screens.set(screenId, new Set());
        }
        screens.get(screenId).add(ws);
        
        // Tag this socket
        ws.screenId = screenId;
        ws.role = 'screen';

      } else if (data.type === 'notify-upload') {
        // Uploader notifying a new file
        const { screenId, media } = data;
        console.log(`New upload for screen ${screenId}:`, media.id);
        
        if (screens.has(screenId)) {
          const screenSockets = screens.get(screenId);
          console.log(`Broadcasting to ${screenSockets.size} screens`);
          
          screenSockets.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'new-content',
                media: media
              }));
            }
          });
        }
      } else if (data.type === 'heartbeat') {
        // console.log(`Heartbeat from screen ${data.screenId}`); // Optional log
      } else if (data.type === 'ad_start' || data.type === 'ad_end') {
        console.log(`Event [${data.type}] from screen ${data.screenId} for media ${data.mediaId}`);
        // Here we could update DB or notify dashboard
      }

    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    if (ws.role === 'screen' && ws.screenId) {
      const screenSockets = screens.get(ws.screenId);
      if (screenSockets) {
        screenSockets.delete(ws);
        if (screenSockets.size === 0) {
          screens.delete(ws.screenId);
        }
      }
      console.log(`Screen disconnected: ${ws.screenId}`);
    }
  });
});

// Keepalive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});
