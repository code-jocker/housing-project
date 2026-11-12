import * as SecureStore from 'expo-secure-store';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const TOKEN_KEY = 'housingconnect_access_token';
export type ApiProperty = {
  id: string; title: string; description: string; propertyType: string;
  district: string; sector: string; monthlyRentRwf: number; bedrooms: number;
  bathrooms: number; furnished: boolean; available: boolean; verifiedAt: string | null;
  images: { id: string; url: string; sortOrder: number }[];
};
type PropertyListResponse = { data: ApiProperty[]; pagination: { page: number; limit: number; total: number; pages: number } };
export type AuthUser = { id: string; fullName: string; phone: string; email?: string | null; role: string; phoneVerified?: boolean };

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  const token = authenticated ? await SecureStore.getItemAsync(TOKEN_KEY) : null;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `API request failed (${response.status}).`);
  return payload as T;
}
export async function getProperties(): Promise<ApiProperty[]> {
  const response = await request<PropertyListResponse>('/api/v1/properties?limit=30', {}, false);
  return response.data;
}
export type RegisterInput = { fullName: string; phone: string; email?: string; password: string; role?: 'TENANT' | 'LANDLORD' };
type AuthResponse = { token: string; user: AuthUser };
type RegisterResponse = AuthResponse | { verificationRequired: true; debugCode?: string; message: string };
async function saveSession(response: AuthResponse) {
  await SecureStore.setItemAsync(TOKEN_KEY, response.token);
  return response.user;
}
export async function register(input: RegisterInput): Promise<{ user?: AuthUser; verificationRequired?: boolean; debugCode?: string; message?: string }> {
  const response = await request<RegisterResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(input) }, false);
  if ('verificationRequired' in response && response.verificationRequired) return response;
  return { user: await saveSession(response as AuthResponse), message: 'Account created.' };
}
export async function login(phone: string, password: string): Promise<AuthUser> {
  const response = await request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }, false);
  return saveSession(response);
}
export async function requestOtp(phone: string): Promise<{ message: string; debugCode?: string; waitSeconds?: number }> {
  return request<{ message: string; debugCode?: string; waitSeconds?: number }>('/api/v1/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) }, false);
}
export async function verifyOtp(phone: string, code: string): Promise<void> {
  await request('/api/v1/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }, false);
}
export async function getSession(): Promise<AuthUser | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  try { return (await request<{ user: AuthUser }>('/api/v1/auth/me')).user; }
  catch { await SecureStore.deleteItemAsync(TOKEN_KEY); return null; }
}
export async function logout() { await SecureStore.deleteItemAsync(TOKEN_KEY); }
export async function getFavorites(): Promise<ApiProperty[]> {
  return (await request<{ data: ApiProperty[] }>('/api/v1/marketplace/favorites')).data;
}
export async function addFavorite(propertyId: string) {
  return request('/api/v1/marketplace/favorites/' + encodeURIComponent(propertyId), { method: 'POST' });
}
export async function removeFavorite(propertyId: string) {
  return request('/api/v1/marketplace/favorites/' + encodeURIComponent(propertyId), { method: 'DELETE' });
}

export type CreatePropertyInput = {
  title: string; description: string; propertyType: 'Apartment' | 'House' | 'Studio' | 'Room' | 'Commercial';
  district: string; sector: string; monthlyRentRwf: number; depositRwf: number;
  bedrooms: number; bathrooms: number; images: string[];
};
export async function createProperty(input: CreatePropertyInput) {
  return request<{ message: string; data: ApiProperty }>('/api/v1/properties', { method: 'POST', body: JSON.stringify(input) });
}
export async function createViewingRequest(input: { propertyId: string; preferredAt: string; message?: string }) {
  return request<{ message: string; data: { id: string; status: string } }>('/api/v1/marketplace/viewings', { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyProperties(): Promise<ApiProperty[]> {
  return (await request<{ data: ApiProperty[] }>('/api/v1/marketplace/my-properties')).data;
}

export type AdminOverview = { users: number; properties: number; pendingListings: number; openReports: number; pendingViewings: number };
export type AdminPendingProperty = ApiProperty & { status: string; owner: { id: string; fullName: string; phone: string; role: string; phoneVerifiedAt: string | null } };
export type AdminReport = { id: string; reason: string; details: string | null; createdAt: string; property: { id: string; title: string; district: string; sector: string; status: string }; reporter: { id: string; fullName: string; phone: string } };
export async function getAdminOverview(): Promise<AdminOverview> {
  return (await request<{ data: AdminOverview }>('/api/v1/admin/overview')).data;
}
export async function getPendingProperties(): Promise<AdminPendingProperty[]> {
  return (await request<{ data: AdminPendingProperty[] }>('/api/v1/admin/properties/pending')).data;
}
export async function reviewProperty(id: string, decision: 'PUBLISHED' | 'REJECTED', reason?: string) {
  return request('/api/v1/admin/properties/' + encodeURIComponent(id) + '/review', { method: 'PATCH', body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }) });
}
export async function getAdminReports(): Promise<AdminReport[]> {
  return (await request<{ data: AdminReport[] }>('/api/v1/admin/reports')).data;
}
export async function resolveAdminReport(id: string) {
  return request('/api/v1/admin/reports/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ resolved: true }) });
}

export type OwnerViewing = { id: string; preferredAt: string; message: string | null; status: string; property: { id: string; title: string; district: string; sector: string; ownerId: string }; tenant: { id: string; fullName: string; phone: string } };
export async function getMyViewings(): Promise<OwnerViewing[]> {
  return (await request<{ data: OwnerViewing[] }>('/api/v1/marketplace/viewings')).data;
}
export async function updateViewing(id: string, status: 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED') {
  return request('/api/v1/marketplace/viewings/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ status }) });
}
export async function setPropertyAvailability(id: string, available: boolean) {
  return request('/api/v1/properties/' + encodeURIComponent(id) + '/availability', { method: 'PATCH', body: JSON.stringify({ available }) });
}
