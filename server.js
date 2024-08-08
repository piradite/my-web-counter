const express = require('express');
const http = require('http');
const Pusher = require("pusher");
const cors = require('cors');
const axios = require('axios');
const moment = require('moment');

const app = express();
const server = http.createServer(app);

// Initialize Pusher with your credentials
const pusher = new Pusher({
  appId: "1846722",
  key: "8cdc5ac541c7c00557e8",
  secret: "43fc3ad6cdfc65eed23d",
  cluster: "eu",
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

// Example function to update online visitors count via Pusher
const updateOnlineVisitors = () => {
  pusher.trigger('my-channel', 'update-online-visitors', { count: onlineVisitors.size });
};

// Example function to update unique visitors count via Pusher
const updateUniqueVisitors = () => {
  pusher.trigger('my-channel', 'update-unique-visitors', { count: uniqueCount });
};

// Reset unique user data every 30 days
const resetMonthly = () => {
  const now = moment();
  // Remove IPs that have not been active in the last 30 days
  uniqueVisitors.forEach((timestamp, ip) => {
    if (now.diff(timestamp, 'days') > 30) {
      uniqueVisitors.delete(ip);
      uniqueCount--; // Only decrement if we actually remove an IP
    }
  });
  console.log('Unique user data reset');
};

// 30 days in milliseconds
const thirtyDays = 30 * 24 * 60 * 60 * 1000;
setInterval(resetMonthly, thirtyDays);

// Initial reset
resetMonthly();

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
