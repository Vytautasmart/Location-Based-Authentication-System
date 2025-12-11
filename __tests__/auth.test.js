const request = require('supertest');
const app = require('../app');
const pool = require('../db/postgre');
const jwt = require('jsonwebtoken');
const settings = require('../settings.json');

const locationService = require('../services/locationService');
jest.mock('../services/locationService');

describe('Auth Endpoints', () => {
  let user;

  beforeAll(async () => {
    // Create the auth_logs table for the test environment
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        client_latitude REAL,
        client_longitude REAL,
        ip_address VARCHAR(50),
        ip_latitude REAL,
        ip_longitude REAL,
        is_location_verified BOOLEAN,
        is_spoofed BOOLEAN,
        access_granted BOOLEAN,
        latency INTEGER
      );
    `);
  });

  beforeEach(async () => {
    // Clean up before each test
    await pool.query("DELETE FROM auth_logs WHERE user_id IN (SELECT id FROM users WHERE username = 'testuser')");
    await pool.query("DELETE FROM users WHERE username = 'testuser'");

    // Create a test user
    const res = await request(app)
      .post('/users')
      .send({
        username: 'testuser',
        password: 'password',
      });
    user = res.body.user;
  });

  afterAll(async () => {
    if (user) {
      await pool.query('DELETE FROM auth_logs WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    }
    pool.end();
  });

  it('should login successfully with a valid location', async () => {
    locationService.verifyLocation.mockResolvedValue(true);
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: 'password',
        latitude: 10,
        longitude: 10,
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.token).toBeDefined();

    // Verify log entry
    const log = await pool.query('SELECT * FROM auth_logs WHERE user_id = $1', [user.id]);
    expect(log.rows.length).toBe(1);
    expect(log.rows[0].access_granted).toBe(true);
  });

  it('should fail to login with an invalid location', async () => {
    locationService.verifyLocation.mockResolvedValue(false);
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: 'password',
        latitude: 10,
        longitude: 10,
      });
    
    expect(res.statusCode).toEqual(403);
    expect(res.body.msg).toEqual('Access denied. You are not in an authorized location.');
  });

  it('should fail to login with a spoofed location', async () => {
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: true });

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: 'password',
        latitude: 10,
        longitude: 10,
      });

    expect(res.statusCode).toEqual(403);
    expect(res.body.msg).toEqual('Access denied due to potential location spoofing.');
  });

  it('should fail to login with wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'wronguser',
        password: 'wrongpassword',
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.msg).toEqual('Invalid credentials');
  });

  it('should deny access with an expired token', async () => {
    // Step 1: Create a user and an expired token
    const user = { id: 1, role: 'admin' };
    const expiredToken = jwt.sign(
      { user },
      settings.jwt_secret,
      { expiresIn: '-1s' } // A token that expired 1 second ago
    );

    // Step 2: Make a request to a protected route with the expired token
    const res = await request(app)
      .post('/api/zones')
      .set('x-auth-token', expiredToken)
      .send({
        name: 'Test Zone',
        latitude: 12.34,
        longitude: 56.78,
        radius: 100
      });

    // Step 3: Assert that the request was denied
    expect(res.statusCode).toEqual(401);
    expect(res.body.msg).toEqual('Token is not valid');
  });
});
