const fs = require('fs');
const path = require('path');
const request = require('supertest');

const TEST_DATA_FILE = path.join(__dirname, 'test-data.json');
process.env.DATA_FILE = TEST_DATA_FILE;
process.env.NODE_ENV = 'test';

let app;

beforeEach(() => {
  fs.writeFileSync(TEST_DATA_FILE, JSON.stringify({ users: [], rooms: [], messages: [] }, null, 2));
  delete require.cache[require.resolve('./server')];
  app = require('./server');
});

afterAll(() => {
  try {
    fs.unlinkSync(TEST_DATA_FILE);
  } catch (error) {
    // ignore cleanup errors
  }
});

describe('Crystal Clear API', () => {
  it('returns session user as null when not authenticated', async () => {
    const response = await request(app).get('/api/session');
    expect(response.status).toBe(200);
    expect(response.body.user).toBeNull();
  });

  it('registers a new renter and returns user data', async () => {
    const response = await request(app)
      .post('/api/register')
      .send({ name: 'Test Renter', email: 'test.renter@example.com', password: 'testpass', role: 'renter' });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ name: 'Test Renter', email: 'test.renter@example.com', role: 'renter' });
  });

  it('allows landlord to log in, create a room, and list rooms', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/login')
      .send({ email: 'alice@example.com', password: 'landlord123' })
      .expect(200);

    const roomResponse = await agent
      .post('/api/rooms')
      .send({ title: 'Test Room', description: 'A room for tests.', location: 'Testville', price: 1200 });

    expect(roomResponse.status).toBe(200);
    expect(roomResponse.body.room).toMatchObject({ title: 'Test Room', location: 'Testville' });

    const listResponse = await agent.get('/api/rooms');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.rooms.some((room) => room.title === 'Test Room')).toBe(true);
  });

  it('prevents renters from creating rooms', async () => {
    const agent = request.agent(app);

    const registerResponse = await agent
      .post('/api/register')
      .send({ name: 'Renter User', email: 'renter.user@example.com', password: 'password123', role: 'renter' });

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.user.role).toBe('renter');

    const createResponse = await agent
      .post('/api/rooms')
      .send({ title: 'Should Fail', description: 'Renters cannot create rooms.', location: 'Nowhere', price: 500 });

    expect(createResponse.status).toBe(403);
    expect(createResponse.body.error).toBe('Permission denied.');
  });

  it('returns profile data and supports profile updates', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/login')
      .send({ email: 'alice@example.com', password: 'landlord123' })
      .expect(200);

    const profileResponse = await agent.get('/api/profile').expect(200);
    expect(profileResponse.body.user).toMatchObject({ name: 'Alice Landlord', email: 'alice@example.com', role: 'landlord' });

    const updateResponse = await agent
      .put('/api/profile')
      .send({ name: 'Alice Smith', email: 'alice.smith@example.com', preferredLocation: 'Downtown', preferredBudget: 1600 })
      .expect(200);

    expect(updateResponse.body.user).toMatchObject({ name: 'Alice Smith', email: 'alice.smith@example.com', preferredLocation: 'Downtown', preferredBudget: 1600 });
  });

  it('allows renters to submit inquiries and retrieve them', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/register')
      .send({ name: 'Inquiry Renter', email: 'inquiry.renter@example.com', password: 'testpass', role: 'renter' })
      .expect(200);

    const roomsResponse = await agent.get('/api/rooms').expect(200);
    const roomId = roomsResponse.body.rooms[0].id;

    await agent
      .post('/api/contact')
      .send({ roomId, message: 'I am interested in this room.' })
      .expect(200);

    const inquiriesResponse = await agent.get('/api/inquiries').expect(200);
    expect(inquiriesResponse.body.inquiries.length).toBeGreaterThan(0);
    expect(inquiriesResponse.body.inquiries[0]).toMatchObject({ roomTitle: expect.any(String), landlordName: expect.any(String), message: 'I am interested in this room.' });
  });

  it('allows renters to pay rent and landlords to review payments', async () => {
    const landlordAgent = request.agent(app);

    await landlordAgent
      .post('/api/register')
      .send({ name: 'Rent Landlord', email: 'rent.landlord@example.com', password: 'testpass', role: 'landlord' })
      .expect(200);

    const createRoomResponse = await landlordAgent
      .post('/api/rooms')
      .send({ title: 'Payment Room', description: 'A room for payment testing.', location: 'Testville', price: 1100 })
      .expect(200);

    const renterAgent = request.agent(app);
    await renterAgent
      .post('/api/register')
      .send({ name: 'Rent Renter', email: 'rent.renter@example.com', password: 'testpass', role: 'renter' })
      .expect(200);

    await renterAgent
      .post('/api/payments')
      .send({ roomId: createRoomResponse.body.room.id })
      .expect(200);

    const renterPayments = await renterAgent.get('/api/payments').expect(200);
    expect(renterPayments.body.payments.length).toBeGreaterThan(0);

    const landlordPayments = await landlordAgent.get('/api/payments').expect(200);
    expect(landlordPayments.body.payments.length).toBeGreaterThan(0);
  });

  it('lets renters submit maintenance requests and landlords update status', async () => {
    const landlordAgent = request.agent(app);

    await landlordAgent
      .post('/api/register')
      .send({ name: 'Repair Landlord', email: 'repair.landlord@example.com', password: 'testpass', role: 'landlord' })
      .expect(200);

    const createRoomResponse = await landlordAgent
      .post('/api/rooms')
      .send({ title: 'Repair Room', description: 'A room for maintenance testing.', location: 'Repairville', price: 950 })
      .expect(200);

    const renterAgent = request.agent(app);
    await renterAgent
      .post('/api/register')
      .send({ name: 'Repair Renter', email: 'repair.renter@example.com', password: 'testpass', role: 'renter' })
      .expect(200);

    await renterAgent
      .post('/api/maintenance')
      .send({ roomId: createRoomResponse.body.room.id, description: 'Leaky faucet in the bathroom.' })
      .expect(200);

    const renterMaintenance = await renterAgent.get('/api/maintenance').expect(200);
    expect(renterMaintenance.body.maintenanceRequests.length).toBeGreaterThan(0);

    const requestId = renterMaintenance.body.maintenanceRequests[0].id;

    await landlordAgent
      .put(`/api/maintenance/${requestId}`)
      .send({ status: 'in progress', response: 'A technician is scheduled to visit tomorrow.' })
      .expect(200);

    const updatedRenterMaintenance = await renterAgent.get('/api/maintenance').expect(200);
    expect(updatedRenterMaintenance.body.maintenanceRequests[0]).toMatchObject({ status: 'in progress', response: 'A technician is scheduled to visit tomorrow.' });
  });
});
