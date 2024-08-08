const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios');
const moment = require('moment');
const Pusher = require('pusher');

const app = express();
const server = http.createServer(app);

// Initialize Pusher
const pusher = new Pusher({
  appId: '1846722',
  key: '8cdc5ac541c7c00557e8',
  secret: '43fc3ad6cdfc65eed23d',
  cluster: 'eu',
  useTLS: true
});

const port = 3001;
let onlineVisitors = new Set();
let uniqueVisitors = new Map(); // Use a Map to store IP addresses and timestamps
let uniqueCount = 0; // Track unique count in memory

// Middleware to handle CORS
app.use(cors());

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Function to send stats to Discord webhook
const sendStatsToDiscord = async () => {
  const stats = {
    uniqueCount,
    onlineVisitors: onlineVisitors.size,
    timestamp: moment().format()  // Current timestamp
  };

  try {
    await axios.post('https://discord.com/api/webhooks/1270875618858242140/uXP40HXnlDnr-QJBCsZ45pV-Be9ygkwG4hPdlSvkLC-0YGrmvSQiNe3B5Begp2EfKQLn', {
      content: `**Server Stats**\n\nUnique Visitors: ${stats.uniqueCount}\nOnline Visitors: ${stats.onlineVisitors}\nTimestamp: ${stats.timestamp}`
    });
    console.log('Stats sent to Discord webhook');
  } catch (error) {
    console.error('Error sending stats to Discord webhook:', error);
  }
};

// Send stats every hour
const oneHour = 60 * 60 * 1000;
setInterval(sendStatsToDiscord, oneHour);

// Log the number of connected users every 10 seconds
setInterval(() => {
  console.log(`Number of connected users: ${onlineVisitors.size}`);
}, 10000);

// Handle Pusher WebSocket connection
app.post('/pusher/auth', (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  const auth = pusher.authenticate(socketId, channel);
  res.send(auth);
});

app.use(express.json()); // For parsing application/json

app.post('/event', (req, res) => {
  const { event, data } = req.body;
  pusher.trigger('my-channel', event, data);
  res.status(200).send('Event triggered');
});

// Replace the Socket.io connection with Pusher
const handleNewConnection = (socket) => {
  console.log('A user connected');
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const now = moment();

  onlineVisitors.add(socket.id);

  // Check if the IP is already in the uniqueVisitors map
  if (!uniqueVisitors.has(ip) || now.diff(uniqueVisitors.get(ip), 'days') > 30) {
    uniqueVisitors.set(ip, now); // Update last visit timestamp
    uniqueCount++;
  }

  // Broadcast updates using Pusher
  pusher.trigger('my-channel', 'updateOnlineVisitors', { onlineVisitors: onlineVisitors.size });
  pusher.trigger('my-channel', 'updateUniqueVisitors', { uniqueCount });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    onlineVisitors.delete(socket.id);
    pusher.trigger('my-channel', 'updateOnlineVisitors', { onlineVisitors: onlineVisitors.size });
  });
};

// Reset unique user data every 30 days
const resetMonthly = () => {
  const now = moment();
  // Remove IPs that have not been active in the last 30 days
  uniqueVisitors.forEach((timestamp, ip) => {
    if (now.diff(timestamp, 'days') > 7) {
      uniqueVisitors.delete(ip);
      uniqueCount--; // Only decrement if we actually remove an IP
    }
  });
  console.log('Unique user data reset');
};

// 30 days in milliseconds
const thirtyDays = 7 * 24 * 60 * 60 * 1000;
setInterval(resetMonthly, thirtyDays);

// Initial reset
resetMonthly();

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
