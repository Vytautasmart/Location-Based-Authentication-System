const request = require('supertest');
const pool = require('../db/postgre');
const jwt = require('jsonwebtoken');

describe('Auth Endpoints', () => {
  let app;
  let user;
  let locationService;

  beforeEach(async () => {
    jest.resetModules();
    jest.doMock('../services/locationService', () => ({
      verifyLocation: jest.fn(),
      isLocationSpoofed: jest.fn(),
    }));
    app = require('../app');
    locationService = require('../services/locationService');

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
    expect(res.statusCode).toEqual(401);
    expect(res.body.msg).toEqual('Invalid credentials');
  });

  it('should deny access with an expired token', async () => {
    // Step 1: Create a user and an expired token
    const user = { id: 1, role: 'admin' };
    const expiredToken = jwt.sign(
      { user },
      process.env.JWT_SECRET,
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

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.user.id).toEqual(user.id);
    expect(decoded.user.role).toEqual('user');
  });

  it('should refresh a token successfully', async () => {
    locationService.verifyLocation.mockResolvedValue(true);
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const loginRes = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: 'password',
        latitude: 10,
        longitude: 10,
      });
    
    const { refreshToken } = loginRes.body;

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ token: refreshToken });

    expect(refreshRes.statusCode).toEqual(200);
    expect(refreshRes.body.token).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
  });

  it('should logout successfully', async () => {
    locationService.verifyLocation.mockResolvedValue(true);
    locationService.isLocationSpoofed.mockResolvedValue({ isSpoofed: false });

    const loginRes = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: 'password',
        latitude: 10,
        longitude: 10,
      });
    
    const { refreshToken } = loginRes.body;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .send({ token: refreshToken });

    expect(logoutRes.statusCode).toEqual(200);

    // Verify the token is deleted from the database
    const tokenInDb = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
    expect(tokenInDb.rows.length).toBe(0);
  });
});
