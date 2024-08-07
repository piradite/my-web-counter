const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  }
});

const port = 3001;
let onlineVisitors = new Set();
let uniqueVisitors = new Set();
const countFilePath = path.join(__dirname, 'count.json');

// Load the previous unique count from count.json
let uniqueCount = 0;
if (fs.existsSync(countFilePath)) {
  const data = JSON.parse(fs.readFileSync(countFilePath));
  uniqueCount = data.uniqueCount || 0;
}

// Middleware to handle CORS
app.use(cors());

// Function to save unique count to count.json
const saveUniqueCount = () => {
  fs.writeFileSync(countFilePath, JSON.stringify({ uniqueCount }));
};

// Connection handler for socket.io
io.on('connection', (socket) => {
  console.log('A user connected');
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  onlineVisitors.add(socket.id);

  // Check if the IP is already in the uniqueVisitors set
  if (!uniqueVisitors.has(ip)) {
    uniqueVisitors.add(ip);
    uniqueCount++;
    saveUniqueCount();
  }

  io.emit('updateOnlineVisitors', onlineVisitors.size);
  io.emit('updateUniqueVisitors', uniqueCount);

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    onlineVisitors.delete(socket.id);
    io.emit('updateOnlineVisitors', onlineVisitors.size);
  });
});

// Log the number of connected users every 10 seconds
setInterval(() => {
  console.log(`Number of connected users: ${onlineVisitors.size}`);
}, 10000);

// Reset unique user data every week
const resetWeekly = () => {
  uniqueVisitors.clear();
  uniqueCount = 0;
  saveUniqueCount();
  console.log('Unique user data reset');
};

// Schedule the reset every week (7 days)
const oneWeek = 7 * 24 * 60 * 60 * 1000;
setInterval(resetWeekly, oneWeek);

// Initial reset
resetWeekly();

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
