const request = require('supertest');
const app = require('../app');
const pool = require('../db/postgre');
const jwt = require('jsonwebtoken');
const settings = require('../settings.json');
const locationService = require('../services/locationService');
const bcrypt = require('bcryptjs');

// Mock the ip-api.com call
jest.mock('node-fetch');
const fetch = require('node-fetch');
const { Response } = jest.requireActual('node-fetch');

describe('Location Spoofing Detection', () => {
  afterAll(() => {
    pool.end();
  });

  // Mock authorized zone and user locations
  const authorizedZone = { latitude: 40.7128, longitude: -74.0060 }; // NYC
  const userDeviceLocation = { latitude: 40.7129, longitude: -74.0061 }; // Very close to the zone
  const distantIpLocation = { lat: 34.0522, lon: -118.2437 }; // Los Angeles

  beforeEach(() => {
    // Before each test, mock the database call to return our authorized zone
    // Also mock the user authentication
    jest.spyOn(pool, 'query').mockImplementation((sql, values) => {
      if (sql.startsWith('SELECT * FROM users')) {
        return Promise.resolve({ rows: [{ id: 1, role: 'admin', password: 'hashedpassword' }] });
      }
      if (sql.startsWith('SELECT * FROM authorized_zones')) {
        return Promise.resolve({ rows: [{ ...authorizedZone, radius: 500 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    // Mock bcrypt.compare to always return true
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
  });

  afterEach(() => {
    // Restore the original implementations after each test
    jest.restoreAllMocks();
  });

  it('should allow login when device and IP locations are consistent and authorized', async () => {
    // Mock the IP API to return a location consistent with the device
    fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({
      status: 'success',
      lat: authorizedZone.latitude,
      lon: authorizedZone.longitude,
    }))));

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: 'password',
        ...userDeviceLocation,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.access).toEqual('granted');
  });

  it('should deny login for spoofing when device and IP locations are far apart', async () => {
    // Mock the IP API to return a distant location
    fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({
      status: 'success',
      ...distantIpLocation,
    }))));

    const res = await request(app)
      .post('/api/auth/access')
      .send({
        username: 'testuser',
        password: 'password',
        ...userDeviceLocation, // User claims to be in NYC
      });
      
    expect(res.statusCode).toEqual(403);
    expect(res.body.msg).toEqual('Location spoofing suspected. Access denied.');
  });
});
