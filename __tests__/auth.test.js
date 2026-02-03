const request = require('supertest');
const pool = require('../db/postgre');
const jwt = require('jsonwebtoken');

// Test password that meets complexity requirements
const TEST_PASSWORD = 'TestPass123!';

// Mock the location service at the module level
jest.mock('../services/locationService', () => ({
  verifyLocation: jest.fn(),
  isLocationSpoofed: jest.fn(),
}));

const locationService = require('../services/locationService');
const app = require('../app');

describe('Auth Endpoints', () => {
  let user;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Clean up before each test
    await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username = 'testuser')");
    await pool.query("DELETE FROM auth_logs WHERE user_id IN (SELECT id FROM users WHERE username = 'testuser')");
    await pool.query("DELETE FROM users WHERE username = 'testuser'");

    // Create a test user with password that meets complexity requirements
    const res = await request(app)
      .post('/users')
      .send({
        username: 'testuser',
        password: TEST_PASSWORD,
      });
    user = res.body.user;
  });

  afterAll(async () => {
    // Final cleanup
    await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username = 'testuser')");
    await pool.query("DELETE FROM auth_logs WHERE user_id IN (SELECT id FROM users WHERE username = 'testuser')");
    await pool.query("DELETE FROM users WHERE username = 'testuser'");
    await pool.end();
  });

  it('should login successfully with a valid location', async () => {
    locationService.verifyLocation.mockResolvedValue({ isVerified: true, zoneName: 'Test Zone' });
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: TEST_PASSWORD,
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
    locationService.verifyLocation.mockResolvedValue({ isVerified: false, zoneName: null });
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: TEST_PASSWORD,
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
        password: TEST_PASSWORD,
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
        password: 'WrongPass123!',
      });
    expect(res.statusCode).toEqual(401);
  });

  it('should deny access with an expired token', async () => {
    const testUser = { id: 1, role: 'admin' };
    const expiredToken = jwt.sign(
      { user: testUser },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '-1s' }
    );

    const res = await request(app)
      .post('/api/zones')
      .set('x-auth-token', expiredToken)
      .send({
        name: 'Test Zone',
        latitude: 12.34,
        longitude: 56.78,
        radius: 100
      });

    expect(res.statusCode).toEqual(401);
  });

  it('should deny access to a protected route without a token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .send();

    expect(res.statusCode).toEqual(401);
  });

  it('should deny access with a malformed token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('x-auth-token', 'this-is-not-a-jwt')
      .send();

    expect(res.statusCode).toEqual(401);
  });

  it('should issue a token with the correct user payload', async () => {
    locationService.verifyLocation.mockResolvedValue({ isVerified: true, zoneName: 'Test Zone' });
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: TEST_PASSWORD,
        latitude: 10,
        longitude: 10,
      });

    expect(res.statusCode).toEqual(200);
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    expect(decoded.user.id).toEqual(user.id);
    expect(decoded.user.role).toEqual('user');
  });

  it('should refresh a token successfully', async () => {
    locationService.verifyLocation.mockResolvedValue({ isVerified: true, zoneName: 'Test Zone' });
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const loginRes = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: TEST_PASSWORD,
        latitude: 10,
        longitude: 10,
      });

    expect(loginRes.statusCode).toEqual(200);

    // Get refresh token from cookies
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(refreshRes.statusCode).toEqual(200);
    expect(refreshRes.body.token).toBeDefined();
  });

  it('should logout successfully', async () => {
    locationService.verifyLocation.mockResolvedValue({ isVerified: true, zoneName: 'Test Zone' });
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const loginRes = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: TEST_PASSWORD,
        latitude: 10,
        longitude: 10,
      });

    expect(loginRes.statusCode).toEqual(200);

    // Get refresh token from cookies
    const cookies = loginRes.headers['set-cookie'];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookies);

    expect(logoutRes.statusCode).toEqual(200);
  });
});
