import { createHmac } from 'node:crypto';
import { env } from '../../config/env.js';

type StorageMethod = 'PUT' | 'GET' | 'HEAD';

function storageConfig() {
  const { PRIVATE_STORAGE_ENDPOINT, PRIVATE_STORAGE_REGION, PRIVATE_STORAGE_BUCKET, PRIVATE_STORAGE_ACCESS_KEY_ID, PRIVATE_STORAGE_SECRET_ACCESS_KEY } = env;
  if (!PRIVATE_STORAGE_ENDPOINT || !PRIVATE_STORAGE_REGION || !PRIVATE_STORAGE_BUCKET || !PRIVATE_STORAGE_ACCESS_KEY_ID || !PRIVATE_STORAGE_SECRET_ACCESS_KEY) {
    throw new Error('Private verification document storage is not configured.');
  }
  const endpoint = new URL(PRIVATE_STORAGE_ENDPOINT);
  if (env.NODE_ENV === 'production' && endpoint.protocol !== 'https:') {
    throw new Error('Private document storage must use HTTPS in production.');
  }
  return { endpoint, region: PRIVATE_STORAGE_REGION, bucket: PRIVATE_STORAGE_BUCKET, accessKeyId: PRIVATE_STORAGE_ACCESS_KEY_ID, secretAccessKey: PRIVATE_STORAGE_SECRET_ACCESS_KEY };
}

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function presign(method: StorageMethod, objectKey: string, expiresSeconds: number, contentType?: string) {
  const config = storageConfig();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const pathParts = [
    ...config.endpoint.pathname.split('/').filter(Boolean),
    config.bucket,
    ...objectKey.split('/').map(encode),
  ];
  const canonicalUri = '/' + pathParts.map(part => part === config.bucket ? encode(part) : part).join('/');
  const host = config.endpoint.host;
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': contentType ? 'content-type;host' : 'host',
  };
  const canonicalQuery = Object.entries(query)
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const canonicalHeaders = contentType ? `content-type:${contentType}\nhost:${host}\n` : `host:${host}\n`;
  const signedHeaders = contentType ? 'content-type;host' : 'host';
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHmac('sha256', 'utf8').update(canonicalRequest).digest('hex')].join('\n');
  const kDate = hmac('AWS4' + config.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');
  return `${config.endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function createVerificationUploadUrl(objectKey: string, contentType: string) {
  return presign('PUT', objectKey, 300, contentType);
}

export function createVerificationDownloadUrl(objectKey: string) {
  return presign('GET', objectKey, 120);
}

export async function inspectVerificationObject(objectKey: string) {
  const url = presign('HEAD', objectKey, 60);
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) return null;
  const size = Number(response.headers.get('content-length') || 0);
  const contentType = response.headers.get('content-type') || '';
  if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) return null;
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(contentType.toLowerCase())) return null;
  return { size, contentType };
}

export function isPrivateStorageConfigured() {
  return Boolean(env.PRIVATE_STORAGE_ENDPOINT && env.PRIVATE_STORAGE_REGION && env.PRIVATE_STORAGE_BUCKET && env.PRIVATE_STORAGE_ACCESS_KEY_ID && env.PRIVATE_STORAGE_SECRET_ACCESS_KEY);
}
