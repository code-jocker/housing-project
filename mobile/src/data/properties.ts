export type Property = {
  id: string;
  title: string;
  district: string;
  sector: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  type: 'Apartment' | 'House' | 'Studio';
  image: string;
  verified: boolean;
  available: boolean;
  furnished: boolean;
  description: string;
};

// Demonstration data only. Replace with API data before production.
export const properties: Property[] = [
  { id: '1', title: 'Modern 2-bedroom apartment', district: 'Gasabo', sector: 'Kimironko', rent: 350000, bedrooms: 2, bathrooms: 1, type: 'Apartment', image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1000', verified: true, available: true, furnished: false, description: 'Bright apartment with a practical layout and easy access to local shops.' },
  { id: '2', title: 'Family house with garden', district: 'Kicukiro', sector: 'Niboye', rent: 550000, bedrooms: 3, bathrooms: 2, type: 'House', image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1000', verified: true, available: true, furnished: false, description: 'Spacious family home with outdoor space and parking.' },
  { id: '3', title: 'Affordable city studio', district: 'Nyarugenge', sector: 'Kigali', rent: 180000, bedrooms: 1, bathrooms: 1, type: 'Studio', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000', verified: false, available: true, furnished: true, description: 'Compact furnished studio suitable for one person.' },
];
