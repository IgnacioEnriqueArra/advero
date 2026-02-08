const WebSocket = require('ws');

const screenId = process.argv[2] || '887cf072-cd19-4f80-85fe-918eec013cc8';
const wsHost = process.argv[3] || 'localhost';
const payload = {
  type: 'notify-upload',
  screenId,
  media: {
    id: 'test-img',
    file_url: 'https://picsum.photos/seed/advero/1600/900',
    media_type: 'image',
    duration_seconds: 10,
    status: 'paid',
    expires_at: new Date(Date.now() + 3600_000).toISOString()
  }
};

const ws = new WebSocket(`ws://${wsHost}:8080`);
ws.on('open', () => {
  ws.send(JSON.stringify(payload));
  setTimeout(() => ws.close(), 500);
});
