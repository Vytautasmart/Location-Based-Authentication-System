const request = require('supertest');
const app = require('../app');
const pool = require('../db/postgre');
const jwt = require('jsonwebtoken');
const settings = require('../settings.json');

describe('Zone Endpoints', () => {
  afterAll(() => {
    pool.end();
  });

  describe('POST /api/zones', () => {
    it('should deny access if no token is provided', async () => {
      const res = await request(app)
        .post('/api/zones')
        .send({
          name: 'Test Zone',
          latitude: 12.34,
          longitude: 56.78,
          radius: 100,
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body.msg).toEqual('No token, authorization denied');
    });

    it('should deny access if the user is not an admin', async () => {
      // Create a token for a regular user
      const user = { id: 2, role: 'user' };
      const token = jwt.sign({ user }, settings.jwt_secret, { expiresIn: '1h' });

      const res = await request(app)
        .post('/api/zones')
        .set('x-auth-token', token)
        .send({
          name: 'Test Zone',
          latitude: 12.34,
          longitude: 56.78,
          radius: 100,
        });
      expect(res.statusCode).toEqual(403);
      expect(res.body.msg).toEqual('Access denied. Only admins can create zones.');
    });

    it('should create a zone if the user is an admin', async () => {
        // Create a token for an admin user
        const user = { id: 1, role: 'admin' };
        const token = jwt.sign({ user }, settings.jwt_secret, { expiresIn: '1h' });
  
        const res = await request(app)
          .post('/api/zones')
          .set('x-auth-token', token)
          .send({
            name: 'New Test Zone',
            latitude: 40.7128,
            longitude: -74.0060,
            radius: 500,
          });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toEqual('New Test Zone');
      });

      it('should return a 400 error if required fields are missing', async () => {
        // Create a token for an admin user
        const user = { id: 1, role: 'admin' };
        const token = jwt.sign({ user }, settings.jwt_secret, { expiresIn: '1h' });
    
        const res = await request(app)
          .post('/api/zones')
          .set('x-auth-token', token)
          .send({
            name: 'Test Zone',
            // Missing latitude, longitude, and radius
          });
        expect(res.statusCode).toEqual(400);
        expect(res.body.msg).toEqual('Please provide name, latitude, longitude, and radius');
      });
  });
});
