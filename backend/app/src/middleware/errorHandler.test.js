import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './errorHandler.js';

const buatRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const req = { method: 'GET', url: '/api/uji' };

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('memakai statusCode dan pesan dari error serta menyertakan stack di luar production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const err = Object.assign(new Error('Data tidak valid'), { statusCode: 400 });
    const res = buatRes();

    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Data tidak valid',
      stack: err.stack,
    });
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('memakai status 500 dan pesan bawaan serta menyembunyikan stack di production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = buatRes();

    errorHandler({}, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal Server Error',
    });
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('stack');
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('tidak mencetak stack jika error tidak punya stack di luar production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = buatRes();

    errorHandler({ message: 'Gagal memproses' }, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe('Gagal memproses');
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});