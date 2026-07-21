export type UserRole = "customer" | "admin";

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  phoneNumber: string;
  dateOfBirth: string;
  role: UserRole;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  phoneNumber: string;
  dateOfBirth: string;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  brand: string;
  image: string;
  featured: boolean;
  active: boolean;
}

export interface Sponsor {
  id: string;
  name: string;
  image: string;
  url: string;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  image: string;
  active: boolean;
  featured: boolean;
}

export interface Subscriber {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  state: string;
  createdAt: string;
}

export interface StoreData {
  products: Product[];
  sponsors: Sponsor[];
  deals: Deal[];
  subscribers: Subscriber[];
  users: User[];
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface SessionPayload {
  userId: string;
  role: UserRole;
  username: string;
  email: string;
}
