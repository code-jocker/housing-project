const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export type ApiProperty = {
  id: string; title: string; description: string; propertyType: string;
  district: string; sector: string; monthlyRentRwf: number; bedrooms: number;
  bathrooms: number; furnished: boolean; available: boolean; verifiedAt: string | null;
  images: { id: string; url: string; sortOrder: number }[];
};
type PropertyListResponse = { data: ApiProperty[]; pagination: { page: number; limit: number; total: number; pages: number } };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'API request failed.');
  return payload as T;
}
export async function getProperties(): Promise<ApiProperty[]> {
  const response = await request<PropertyListResponse>('/api/v1/properties?limit=30');
  return response.data;
}
export type RegisterInput = { fullName: string; phone: string; email?: string; password: string; role?: 'TENANT' | 'LANDLORD' | 'AGENT' };
export async function register(input: RegisterInput) {
  return request<{ token: string; user: { id: string; fullName: string; phone: string; role: string } }>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(input) });
}
export async function login(phone: string, password: string) {
  return request<{ token: string; user: { id: string; fullName: string; phone: string; role: string } }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
}
