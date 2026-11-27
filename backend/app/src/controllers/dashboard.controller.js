import * as dashboardService from '../services/dashboard.service.js';
import * as rinci from '../services/dashboardRinci.service.js';
import { parsePeriode } from '../services/dashboardPeriode.js';

function kirimOk(res, data) {
  return res.status(200).json({ success: true, data });
}

/** Query ?periode= hanya boleh berupa satu string dari pilihan yang sah. */
function ambilPeriode(req) {
  return parsePeriode(req.query.periode);
}

export async function ringkasan(req, res, next) {
  try {
    return kirimOk(res, await dashboardService.ambilRingkasan());
  } catch (err) {
    return next(err);
  }
}

export async function koleksi(req, res, next) {
  try {
    return kirimOk(res, await rinci.ambilKoleksi());
  } catch (err) {
    return next(err);
  }
}

export async function sirkulasi(req, res, next) {
  try {
    return kirimOk(res, await rinci.ambilSirkulasi(ambilPeriode(req)));
  } catch (err) {
    return next(err);
  }
}

export async function denda(req, res, next) {
  try {
    return kirimOk(res, await rinci.ambilDenda(ambilPeriode(req)));
  } catch (err) {
    return next(err);
  }
}

export async function layanan(req, res, next) {
  try {
    return kirimOk(res, await rinci.ambilLayanan(ambilPeriode(req)));
  } catch (err) {
    return next(err);
  }
}
