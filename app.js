const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const ntpClient = require('ntp-client');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');
const { v4: uuidv4 } = require('uuid'); // Import UUID library

// Define the timezone for Louisville, KY
const timezone = 'America/Kentucky/Louisville';
const desiredStartHours = 16;
const desiredStartMinutes = 39;

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

// Function to fetch current NTP time
function getNtpTime(callback) {
  ntpClient.getNetworkTime('pool.ntp.org', 123, (err, date) => {
    if (err) {
      console.error(err);
      return;
    }
    callback(date);
  });
}

// Function to calculate the local start time based on the desired hours and minutes
function getLocalStartTime(hours, minutes, callback) {
  getNtpTime((ntpTime) => {
    const localNtpTime = toZonedTime(ntpTime, timezone);
    const startTime = new Date(localNtpTime);
    startTime.setHours(hours, minutes, 0, 0);

    const startTimeUtc = fromZonedTime(startTime, timezone);
    callback(startTimeUtc, ntpTime);
  });
}

// Function to broadcast a message to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  let clientID;
  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage.action === 'reqClientID') {
      clientID = uuidv4();
      ws.send(
        JSON.stringify({
          action: 'setClientID',
          clientID: clientID,
        })
      );
    }

    if (parsedMessage.action === 'testLatency') {
      const clientTime = parsedMessage.clientTime;
      const serverTime = performance.now();
      const latency = serverTime - clientTime;

      // Send the start time and current server time to the client
      getLocalStartTime(
        desiredStartHours,
        desiredStartMinutes,
        (startTime, ntpTime) => {
          ws.send(
            JSON.stringify({
              action: 'startTime',
              startTime: startTime.getTime(),
              serverTime: ntpTime.getTime(),
              estimatedLatency: latency,
            })
          );
        }
      );
    }
  });

  ws.on('close', () => {
    if (!clientID) return;
    console.log(`Client disconnected: ${clientID}`);
  });

  ws.on('error', (error) => {
    if (!clientID) return;
    console.error(`WebSocket error for client ${clientID}: ${error}`);
  });
});

// Listen on port 443
const PORT = 443;

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

server.on('error', (error) => {
  console.error(`Server error: ${error}`);
});
