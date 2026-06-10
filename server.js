const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { users: [], rooms: [], messages: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const data = loadData();

if (!Array.isArray(data.users)) data.users = [];
if (!Array.isArray(data.rooms)) data.rooms = [];
if (!Array.isArray(data.messages)) data.messages = [];
if (!Array.isArray(data.payments)) data.payments = [];
if (!Array.isArray(data.maintenanceRequests)) data.maintenanceRequests = [];

if (data.users.length === 0) {
  data.users.push({
    id: uuidv4(),
    name: 'Alice Landlord',
    email: 'alice@example.com',
    role: 'landlord',
    passwordHash: bcrypt.hashSync('landlord123', 10)
  });
  data.users.push({
    id: uuidv4(),
    name: 'Bob Renter',
    email: 'bob@example.com',
    role: 'renter',
    passwordHash: bcrypt.hashSync('renter123', 10)
  });
}

if (data.rooms.length === 0) {
  data.rooms.push({
    id: uuidv4(),
    title: 'Sunny Downtown Studio',
    description: 'Bright studio with easy access to transit, shops, and parks.',
    price: 1450,
    location: 'Downtown',
    ownerId: data.users[0].id,
    available: true
  });
  data.rooms.push({
    id: uuidv4(),
    title: 'Cozy Private Room',
    description: 'Comfortable furnished room with shared kitchen and backyard.',
    price: 900,
    location: 'Residential',
    ownerId: data.users[0].id,
    available: true
  });
}

saveData(data);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'wdd430-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 }
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    preferredLocation: user.preferredLocation || '',
    preferredBudget: user.preferredBudget || ''
  };
}

function getCurrentUser(req) {
  return data.users.find((user) => user.id === req.session.userId);
}

function requireAuth(req, res, next) {
  if (!getCurrentUser(req)) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    if (!user || user.role !== role) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    next();
  };
}

app.get('/api/session', (req, res) => {
  const user = getCurrentUser(req);
  res.json({ user: serializeUser(user) });
});

app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  if (!['landlord', 'renter'].includes(role)) {
    return res.status(400).json({ error: 'Role must be landlord or renter.' });
  }

  const existing = data.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already in use.' });
  }

  const user = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    role,
    passwordHash: bcrypt.hashSync(password, 10)
  };

  data.users.push(user);
  saveData(data);
  req.session.userId = user.id;

  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = data.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  req.session.userId = user.id;
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  res.json({ user: serializeUser(user) });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { name, email, preferredLocation, preferredBudget } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const existingUser = data.users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.id !== user.id
  );
  if (existingUser) {
    return res.status(409).json({ error: 'Email already in use.' });
  }

  user.name = name;
  user.email = email.toLowerCase();
  user.preferredLocation = preferredLocation || '';
  user.preferredBudget = preferredBudget ? Number(preferredBudget) : '';
  saveData(data);

  res.json({ user: serializeUser(user) });
});

app.get('/api/inquiries', requireAuth, (req, res) => {
  const inquiries = data.messages
    .filter((message) => message.senderId === req.session.userId)
    .map((message) => ({
      id: message.id,
      roomId: message.roomId,
      message: message.message,
      createdAt: message.createdAt,
      roomTitle: data.rooms.find((room) => room.id === message.roomId)?.title || 'Unknown',
      landlordName: data.users.find((user) => user.id === message.ownerId)?.name || 'Unknown'
    }));

  res.json({ inquiries });
});

app.post('/api/payments', requireAuth, requireRole('renter'), (req, res) => {
  const { roomId, amount } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required for payment.' });
  }

  const room = data.rooms.find((item) => item.id === roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  const paymentAmount = amount !== undefined ? Number(amount) : room.price;
  const payment = {
    id: uuidv4(),
    roomId,
    renterId: req.session.userId,
    ownerId: room.ownerId,
    amount: paymentAmount,
    createdAt: new Date().toISOString(),
    status: 'paid'
  };

  data.payments.push(payment);
  saveData(data);
  res.json({ payment });
});

app.get('/api/payments', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const payments = data.payments
    .filter((payment) => (user.role === 'renter' ? payment.renterId === user.id : payment.ownerId === user.id))
    .map((payment) => ({
      ...payment,
      roomTitle: data.rooms.find((room) => room.id === payment.roomId)?.title || 'Unknown',
      renterName: data.users.find((userItem) => userItem.id === payment.renterId)?.name || 'Unknown'
    }));

  res.json({ payments });
});

app.get('/api/maintenance', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const requests = data.maintenanceRequests
    .filter((request) => {
      if (user.role === 'landlord') {
        return request.ownerId === user.id;
      }
      return request.requesterId === user.id;
    })
    .map((request) => ({
      ...request,
      roomTitle: data.rooms.find((room) => room.id === request.roomId)?.title || 'Unknown',
      requesterName: data.users.find((userItem) => userItem.id === request.requesterId)?.name || 'Unknown'
    }));

  res.json({ maintenanceRequests: requests });
});

app.post('/api/maintenance', requireAuth, requireRole('renter'), (req, res) => {
  const { roomId, description } = req.body;
  if (!roomId || !description) {
    return res.status(400).json({ error: 'Room ID and description are required.' });
  }

  const room = data.rooms.find((item) => item.id === roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  const maintenanceRequest = {
    id: uuidv4(),
    roomId,
    requesterId: req.session.userId,
    ownerId: room.ownerId,
    description,
    status: 'pending',
    response: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.maintenanceRequests.push(maintenanceRequest);
  saveData(data);
  res.json({ maintenanceRequest });
});

app.put('/api/maintenance/:id', requireAuth, requireRole('landlord'), (req, res) => {
  const maintenanceRequest = data.maintenanceRequests.find(
    (item) => item.id === req.params.id && item.ownerId === req.session.userId
  );

  if (!maintenanceRequest) {
    return res.status(404).json({ error: 'Maintenance request not found.' });
  }

  const { status, response } = req.body;
  if (status) maintenanceRequest.status = status;
  if (response !== undefined) maintenanceRequest.response = response;
  maintenanceRequest.updatedAt = new Date().toISOString();

  saveData(data);
  res.json({ maintenanceRequest });
});

app.get('/api/rooms', (req, res) => {
  const rooms = data.rooms.map((room) => ({
    ...room,
    ownerName: data.users.find((owner) => owner.id === room.ownerId)?.name || 'Unknown'
  }));
  res.json({ rooms });
});

app.post('/api/rooms', requireAuth, requireRole('landlord'), (req, res) => {
  const { title, description, price, location } = req.body;
  if (!title || !description || !price || !location) {
    return res.status(400).json({ error: 'All room fields are required.' });
  }

  const room = {
    id: uuidv4(),
    title,
    description,
    price: Number(price),
    location,
    ownerId: req.session.userId,
    available: true
  };

  data.rooms.push(room);
  saveData(data);
  res.json({ room });
});

app.put('/api/rooms/:id', requireAuth, requireRole('landlord'), (req, res) => {
  const room = data.rooms.find((item) => item.id === req.params.id && item.ownerId === req.session.userId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  const { title, description, price, location, available } = req.body;
  room.title = title || room.title;
  room.description = description || room.description;
  room.price = price !== undefined ? Number(price) : room.price;
  room.location = location || room.location;
  room.available = available !== undefined ? Boolean(available) : room.available;

  saveData(data);
  res.json({ room });
});

app.delete('/api/rooms/:id', requireAuth, requireRole('landlord'), (req, res) => {
  const index = data.rooms.findIndex((item) => item.id === req.params.id && item.ownerId === req.session.userId);
  if (index === -1) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  data.rooms.splice(index, 1);
  saveData(data);
  res.json({ message: 'Room deleted successfully.' });
});

app.post('/api/contact', requireAuth, (req, res) => {
  const { roomId, message } = req.body;
  if (!roomId || !message) {
    return res.status(400).json({ error: 'Room ID and message are required.' });
  }

  const room = data.rooms.find((item) => item.id === roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  data.messages.push({
    id: uuidv4(),
    roomId,
    senderId: req.session.userId,
    ownerId: room.ownerId,
    message,
    createdAt: new Date().toISOString()
  });

  saveData(data);
  res.json({ message: 'Message sent to the landlord.' });
});

app.get('/api/messages', requireAuth, requireRole('landlord'), (req, res) => {
  const messages = data.messages
    .filter((message) => message.ownerId === req.session.userId)
    .map((message) => ({
      ...message,
      roomTitle: data.rooms.find((room) => room.id === message.roomId)?.title || 'Unknown',
      senderName: data.users.find((user) => user.id === message.senderId)?.name || 'Unknown'
    }));
  res.json({ messages });
});

// Astro handles the frontend — return 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Crystal Clear running on http://localhost:${PORT}`);
  });
}

module.exports = app;