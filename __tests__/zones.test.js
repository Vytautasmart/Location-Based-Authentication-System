const request = require('supertest');
const app = require('../app');
const pool = require('../db/postgre');
const jwt = require('jsonwebtoken');

describe('Zone Endpoints', () => {
  beforeAll(async () => {
    // Create the authorized_zones table for the test environment
    await pool.query(`
      CREATE TABLE IF NOT EXISTS authorized_zones (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius REAL NOT NULL
      );
    `);
  });

  afterAll(() => {
    pool.end();
  });

  describe('GET /api/zones', () => {
    beforeAll(async () => {
      // Create some test zones
      await pool.query('INSERT INTO authorized_zones (name, latitude, longitude, radius) VALUES ($1, $2, $3, $4)', ['Test Zone 1', 10, 10, 100]);
      await pool.query('INSERT INTO authorized_zones (name, latitude, longitude, radius) VALUES ($1, $2, $3, $4)', ['Test Zone 2', 20, 20, 200]);
    });

    afterAll(async () => {
      await pool.query("DELETE FROM authorized_zones WHERE name LIKE 'Test Zone %'");
    });

    it('should return all authorized zones', async () => {
      const res = await request(app).get('/api/zones');
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
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
    });

    it('should deny access if the user is not an admin', async () => {
      // Create a token for a non-admin user
      const user = { id: 1, role: 'user' };
      const token = jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/api/zones')
        .set('x-auth-token', token)
        .send({
            name: 'Test Zone',
            latitude: 12.34,
            longitude: 56.78,
            radius: 100
        });
      expect(res.statusCode).toEqual(403);
      expect(res.body.msg).toEqual('Access denied. Only admins can perform this action.');
    });

    it('should create a zone if the user is an admin', async () => {
        // Create a token for an admin user
        const user = { id: 1, role: 'admin' };
        const token = jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
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
        const token = jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
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
