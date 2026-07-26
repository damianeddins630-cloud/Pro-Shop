export type Permission =
  | "edit_pages"
  | "manage_inventory"
  | "manage_sponsors"
  | "manage_deals"
  | "manage_coaches"
  | "manage_users"
  | "manage_roles"
  | "view_orders"
  | "manage_orders";

export const ALL_PERMISSIONS: Permission[] = [
  "edit_pages",
  "manage_inventory",
  "manage_sponsors",
  "manage_deals",
  "manage_coaches",
  "manage_users",
  "manage_roles",
  "view_orders",
  "manage_orders",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  edit_pages: "Edit pages (rename / + / −)",
  manage_inventory: "Manage inventory",
  manage_sponsors: "Manage sponsors",
  manage_deals: "Manage deals",
  manage_coaches: "Manage coaches",
  manage_users: "Manage users",
  manage_roles: "Manage roles & permissions",
  view_orders: "View all orders",
  manage_orders: "Manage order status",
};

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  system?: boolean;
}

/** @deprecated use roleId — kept for migration */
export type UserRole = "customer" | "admin" | string;

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  phoneNumber: string;
  dateOfBirth: string;
  roleId: string;
  /** legacy field */
  role?: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  phoneNumber: string;
  dateOfBirth: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Regular / list price — may be $0 */
  price: number;
  /** 0–100 percent off the regular price (keeps original price visible) */
  discountPercent?: number;
  stock: number;
  category: string;
  brand: string;
  image: string;
  featured: boolean;
  active: boolean;
  /** Optional Shopify variant GID/id if product is synced in Shopify */
  shopifyVariantId?: string;
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

export interface Coach {
  id: string;
  name: string;
  image: string;
  email?: string;
}

export interface PageText {
  id: string;
  page: string;
  slot: string;
  text: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export type OrderStatus =
  | "awaiting_payment"
  | "placed"
  | "processing"
  | "completed"
  | "cancelled";

export interface Order {
  id: string;
  userId: string;
  username: string;
  email: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  /** Shopify draft order GID when paid via Shopify */
  shopifyDraftOrderId?: string;
  shopifyInvoiceUrl?: string;
  paymentProvider?: "shopify" | "local";
}

export interface StoreData {
  products: Product[];
  sponsors: Sponsor[];
  deals: Deal[];
  subscribers: Subscriber[];
  users: User[];
  coaches: Coach[];
  texts: PageText[];
  roles: Role[];
  orders: Order[];
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface SessionPayload {
  userId: string;
  roleId: string;
  username: string;
  email: string;
  permissions: Permission[];
}
