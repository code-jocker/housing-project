import { after, before, test } from 'node:test';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';

const suffix = Date.now().toString().slice(-8);
const tenantPhone = `+2507${suffix}1`;
const landlordPhone = `+2507${suffix}2`;
const adminPhone = `+2507${suffix}3`;
const password = 'HousingConnect!2026';
let tenantToken = '';
let landlordToken = '';
let adminToken = '';
let propertyId = '';

before(async () => {
  await prisma.$connect();
});

after(async () => {
  await prisma.user.deleteMany({ where: { phone: { in: [tenantPhone, landlordPhone, adminPhone] } } });
  await prisma.$disconnect();
});

test('tenant, landlord and admin marketplace journey', async () => {
  const tenant = await request(app).post('/api/v1/auth/register').send({ fullName: 'Test Tenant', phone: tenantPhone, password, role: 'TENANT' });
  assert.equal(tenant.status, 201);
  tenantToken = tenant.body.token;
  assert.ok(tenantToken);

  const landlord = await request(app).post('/api/v1/auth/register').send({ fullName: 'Test Landlord', phone: landlordPhone, password, role: 'LANDLORD' });
  assert.equal(landlord.status, 201);
  landlordToken = landlord.body.token;
  assert.ok(landlordToken);

  const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tenantToken}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.role, 'TENANT');
  const unknownReset = await request(app).post('/api/v1/auth/password-reset/request').send({ phone: '+250799999999' });
  assert.equal(unknownReset.status, 202);

  const forbiddenCreate = await request(app).post('/api/v1/properties').set('Authorization', `Bearer ${tenantToken}`).send({});
  assert.equal(forbiddenCreate.status, 403);

  const listing = await request(app).post('/api/v1/properties').set('Authorization', `Bearer ${landlordToken}`).send({
    title: 'Test apartment listing',
    description: 'A test property with sufficient description for validation.',
    propertyType: 'Apartment',
    district: 'Kicukiro',
    sector: 'Niboye',
    monthlyRentRwf: 300000,
    depositRwf: 300000,
    bedrooms: 2,
    bathrooms: 1,
    images: [],
  });
  assert.equal(listing.status, 201);
  propertyId = listing.body.data.id;
  assert.equal(listing.body.data.status, 'PENDING_REVIEW');

  const hidden = await request(app).get('/api/v1/properties');
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.data.some((item: { id: string }) => item.id === propertyId), false);

  const adminHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { fullName: 'Test Admin', phone: adminPhone, passwordHash: adminHash, role: 'ADMIN', phoneVerifiedAt: new Date() } });
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ phone: adminPhone, password });
  assert.equal(adminLogin.status, 200);
  adminToken = adminLogin.body.token;

  const review = await request(app).patch(`/api/v1/admin/properties/${propertyId}/review`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'PUBLISHED' });
  assert.equal(review.status, 200);
  assert.equal(review.body.data.status, 'PUBLISHED');

  const rented = await request(app).patch(`/api/v1/properties/${propertyId}/availability`).set('Authorization', `Bearer ${landlordToken}`).send({ available: false });
  assert.equal(rented.status, 200);
  assert.equal(rented.body.data.status, 'RENTED');
  const relisted = await request(app).patch(`/api/v1/properties/${propertyId}/availability`).set('Authorization', `Bearer ${landlordToken}`).send({ available: true });
  assert.equal(relisted.status, 200);
  assert.equal(relisted.body.data.status, 'PENDING_REVIEW');
  const republished = await request(app).patch(`/api/v1/admin/properties/${propertyId}/review`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'PUBLISHED' });
  assert.equal(republished.status, 200);

  const searched = await request(app).get('/api/v1/properties?q=Test%20apartment');
  assert.equal(searched.status, 200);
  assert.ok(searched.body.data.some((item: { id: string }) => item.id === propertyId));
  assert.equal((await request(app).get('/api/v1/properties?page=invalid')).status, 400);
  assert.equal((await request(app).get('/api/v1/properties?q=a')).status, 400);

  const favorite = await request(app).post(`/api/v1/marketplace/favorites/${propertyId}`).set('Authorization', `Bearer ${tenantToken}`);
  assert.equal(favorite.status, 201);
  const favorites = await request(app).get('/api/v1/marketplace/favorites').set('Authorization', `Bearer ${tenantToken}`);
  assert.equal(favorites.status, 200);
  assert.ok(favorites.body.data.some((item: { id: string }) => item.id === propertyId));

  const preferredAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const viewing = await request(app).post('/api/v1/marketplace/viewings').set('Authorization', `Bearer ${tenantToken}`).send({ propertyId, preferredAt });
  assert.equal(viewing.status, 201);
  const viewingId = viewing.body.data.id;
  const landlordNotifications = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${landlordToken}`);
  assert.equal(landlordNotifications.status, 200);
  assert.ok(landlordNotifications.body.data.some((item: { type: string }) => item.type === 'VIEWING_REQUEST'));

  const ownerViewings = await request(app).get('/api/v1/marketplace/viewings').set('Authorization', `Bearer ${landlordToken}`);
  assert.equal(ownerViewings.status, 200);
  assert.ok(ownerViewings.body.data.some((item: { id: string }) => item.id === viewingId));

  const accepted = await request(app).patch(`/api/v1/marketplace/viewings/${viewingId}`).set('Authorization', `Bearer ${landlordToken}`).send({ status: 'ACCEPTED' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.data.status, 'ACCEPTED');
  const tenantViewings = await request(app).get('/api/v1/marketplace/viewings').set('Authorization', `Bearer ${tenantToken}`);
  assert.equal(tenantViewings.status, 200);
  assert.equal(tenantViewings.body.data[0].property.owner.phone, landlordPhone);
  const completedByLandlord = await request(app).patch(`/api/v1/marketplace/viewings/${viewingId}`).set('Authorization', `Bearer ${landlordToken}`).send({ status: 'COMPLETED' });
  assert.equal(completedByLandlord.status, 200);
  const cancelCompleted = await request(app).patch(`/api/v1/marketplace/viewings/${viewingId}`).set('Authorization', `Bearer ${tenantToken}`).send({ status: 'CANCELLED' });
  assert.equal(cancelCompleted.status, 409);
  const tenantNotifications = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${tenantToken}`);
  assert.ok(tenantNotifications.body.data.some((item: { type: string }) => item.type === 'VIEWING_UPDATE'));

  const report = await request(app).post(`/api/v1/marketplace/properties/${propertyId}/reports`).set('Authorization', `Bearer ${tenantToken}`).send({ reason: 'FALSE_INFORMATION', details: 'Integration test report.' });
  assert.equal(report.status, 201);
  const reports = await request(app).get('/api/v1/admin/reports').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(reports.status, 200);
  assert.ok(reports.body.data.some((item: { id: string }) => item.id === report.body.data.id));
  const adminNotifications = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${adminToken}`);
  assert.ok(adminNotifications.body.data.some((item: { type: string }) => item.type === 'PROPERTY_REPORTED'));
  const markedRead = await request(app).patch('/api/v1/notifications/read-all').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(markedRead.status, 200);
  const audit = await request(app).get('/api/v1/admin/audit-logs?limit=100').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(audit.status, 200);
  assert.ok(audit.body.data.some((item: { action: string }) => item.action === 'PROPERTY_REVIEWED'));
  assert.ok(audit.body.data.some((item: { action: string }) => item.action === 'VIEWING_STATUS_CHANGED'));
  assert.ok(audit.body.data.some((item: { action: string }) => item.action === 'PROPERTY_REPORTED'));
  const resetCode = '135790';
  const resetHash = createHmac('sha256', env.JWT_SECRET).update(`${tenantPhone}:PASSWORD_RESET:${resetCode}`).digest('hex');
  await prisma.phoneOtp.upsert({ where: { phone: tenantPhone }, create: { phone: tenantPhone, codeHash: resetHash, purpose: 'PASSWORD_RESET', expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 }, update: { codeHash: resetHash, purpose: 'PASSWORD_RESET', expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 } });
  const reset = await request(app).post('/api/v1/auth/password-reset/confirm').send({ phone: tenantPhone, code: resetCode, newPassword: 'NewHousing!2026' });
  assert.equal(reset.status, 200);
  const oldLogin = await request(app).post('/api/v1/auth/login').send({ phone: tenantPhone, password });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request(app).post('/api/v1/auth/login').send({ phone: tenantPhone, password: 'NewHousing!2026' });
  assert.equal(newLogin.status, 200);
  const revokedSession = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tenantToken}`);
  assert.equal(revokedSession.status, 401);
  await prisma.user.update({ where: { phone: tenantPhone }, data: { tokenVersion: { increment: 1 } } });
  const newestSession = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${newLogin.body.token}`);
  assert.equal(newestSession.status, 401);
});
