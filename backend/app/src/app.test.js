import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from './app.js';

describe('Application API', () => {
  it('returns the standard success envelope for health checks', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        status: 'ok',
        service: 'app-api',
      }),
    }));
  });

  it('returns the standard failure envelope for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/Route not found/);
  });
});
