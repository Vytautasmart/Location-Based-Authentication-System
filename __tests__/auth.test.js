const request = require('supertest');
const app = require('../app');
const pool = require('../db/postgre');
const jwt = require('jsonwebtoken');
const settings = require('../settings.json');

describe('Auth Endpoints', () => {
  afterAll(() => {
    pool.end();
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
