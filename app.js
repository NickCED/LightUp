const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');

const options = {
  cert: fs.readFileSync(
    '/etc/letsencrypt/live/dev.nicholasjosephsmith.com/fullchain.pem'
  ),
  key: fs.readFileSync(
    '/etc/letsencrypt/live/dev.nicholasjosephsmith.com/privkey.pem'
  ),
};

const server = https.createServer(options);

const wss = new WebSocket.Server({ server });

// Define the start time (e.g., 11:00 am)
const startTime = new Date();
startTime.setHours(11, 0, 0, 0);

wss.on('connection', (ws) => {
  console.log('New client connected');

  // Send the start time and current server time to the newly connected client
  ws.send(
    JSON.stringify({
      action: 'startTime',
      startTime: startTime.getTime(),
      serverTime: Date.now(),
    })
  );

  ws.on('message', (message) => {
    console.log(`Received: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error: ${error}`);
  });

  // Send the current server time to all connected clients every second
  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            action: 'serverTime',
            serverTime: Date.now(),
          })
        );
      }
    });
  }, 1000);
});

// Listen on port 443
const PORT = 443;

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

server.on('error', (error) => {
  console.error(`Server error: ${error}`);
});
