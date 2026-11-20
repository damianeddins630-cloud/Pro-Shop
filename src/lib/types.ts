export type Permission =
  | "edit_pages"
  | "manage_inventory"
  | "manage_sponsors"
  | "manage_deals"
  | "manage_coaches"
  | "manage_users"
  | "manage_roles"
  | "view_orders"
  | "manage_orders"
  | "manage_subscribers"
  | "view_dashboard"
  | "manage_memberships"
  | "manage_customers"
  | "view_finances"
  | "manage_finances"
  | "manage_backups"
  | "manage_settings";

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
  "manage_subscribers",
  "view_dashboard",
  "manage_memberships",
  "manage_customers",
  "view_finances",
  "manage_finances",
  "manage_backups",
  "manage_settings",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  edit_pages: "Edit all page text (titles, body, CTAs)",
  manage_inventory: "Manage inventory",
  manage_sponsors: "Manage sponsors",
  manage_deals: "Manage deals",
  manage_coaches: "Manage coaches / coaching bookings",
  manage_users: "Manage users",
  manage_roles: "Manage roles & permissions",
  view_orders: "View all orders",
  manage_orders: "Manage order status",
  manage_subscribers: "Email subscribers & announcements",
  view_dashboard: "View Operations dashboard",
  manage_memberships: "Manage memberships",
  manage_customers: "Manage customer profiles & notes",
  view_finances: "View finances",
  manage_finances: "Manage expenses & financial records",
  manage_backups: "Manage backups & system health",
  manage_settings: "Manage system settings & integrations",
};

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  system?: boolean;
  /**
   * Higher = more authority.
   * Website Owner is 100 and locked. Actors can only manage roles/users below their rank.
   */
  rank?: number;
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
  createdAt?: string;
  hasOrdered?: boolean;
  orderCount?: number;
  lastOrderAt?: string;
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
  /**
   * Available ball weights in lbs (e.g. 14, 15, 16).
   * When non-empty, shoppers must choose a weight bubble before adding to cart.
   */
  weightOptions?: number[];
  /**
   * Units in stock per weight (keys are lbs as strings, e.g. "15": 3).
   * For sized balls, product.stock is always the sum of these buckets — never a separate total.
   */
  weightStock?: Record<string, number>;
  /** Optional Shopify variant GID/id if product is synced in Shopify */
  shopifyVariantId?: string;
  /** SPI / supplier SKU for single-SKU items (bags, shoes, chemicals, etc.) */
  sku?: string;
  /** UPC / barcode for single-SKU items */
  upc?: string;
  /**
   * Per-weight SKU/UPC for bowling balls with weight variants.
   * Keys match weightStock (lbs as strings, e.g. "15").
   */
  variantMeta?: Record<string, { sku: string; upc: string }>;
  /** Cost of goods (optional — used for inventory valuation / profit) */
  cost?: number;
  /** Alert when stock at or below this level (default 3 in Ops) */
  lowStockThreshold?: number;
  /** Supplier / vendor label */
  supplier?: string;
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

/** Ops-sent announcement / document blast to subscriber emails */
export interface SubscriberAnnouncement {
  id: string;
  subject: string;
  body: string;
  documentName?: string;
  documentUrl?: string;
  recipientCount: number;
  failedCount?: number;
  sentAt: string;
  sentBy: string;
  includeAccounts?: boolean;
}

export interface Coach {
  id: string;
  name: string;
  image: string;
  email?: string;
  /** Optional public bio — when empty, UI invites contact instead of inventing copy */
  bio?: string;
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
  /** Selected ball weight in lbs when the product requires weight choice */
  weight?: number;
}

export type OrderStatus =
  | "awaiting_payment"
  | "placed"
  | "processing"
  | "ready"
  | "completed"
  | "cancelled";

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface Order {
  id: string;
  userId: string;
  username: string;
  email: string;
  /** Phone snapshot for staff call / text when Ready */
  phoneNumber?: string;
  items: OrderItem[];
  /** Amount charged after coupon */
  total: number;
  /** Cart total before coupon */
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  status: OrderStatus;
  createdAt: string;
  /** Last status change */
  updatedAt?: string;
  /** Pipeline history for Ops */
  statusHistory?: OrderStatusEvent[];
  /** Always in-store — Ballard's does not ship */
  fulfillment?: "in_store";
  /** Staff drilling / layout / fit notes */
  drillingNotes?: string;
  /** When staff marked the customer as notified (Ready) */
  customerNotifiedAt?: string;
  /** When gear was handed off in person */
  handedOffAt?: string;
  /** Shopify draft order GID when paid via Shopify */
  shopifyDraftOrderId?: string;
  shopifyInvoiceUrl?: string;
  paymentProvider?: "shopify" | "local";
  /** True once website inventory/coupon usage was applied for this order */
  inventoryApplied?: boolean;
  /** Tax amount if recorded (optional) */
  taxAmount?: number;
  /** Human payment method label (Shopify, cash, card, etc.) */
  paymentMethod?: string;
  /** Refunded amount (0 = none). Only increases collected-revenue impact when set. */
  refundAmount?: number;
  refundedAt?: string;
  refundReason?: string;
  refundStatus?: "none" | "partial" | "full";
}

export type CoachingServiceType =
  | "private"
  | "group"
  | "online"
  | "package_session";

export type CoachingBookingStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentCollectStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "refunded"
  | "waived";

export interface CoachingBooking {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  coachId: string;
  coachName: string;
  serviceType: CoachingServiceType;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  price: number;
  paymentStatus: PaymentCollectStatus;
  bookingStatus: CoachingBookingStatus;
  attendance?: "pending" | "present" | "absent";
  packageId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  /** Only true once payment is confirmed — drives collected revenue */
  revenueCollected?: boolean;
}

export interface CoachingPackage {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  name: string;
  price: number;
  sessionsPurchased: number;
  sessionsUsed: number;
  expiresAt?: string;
  paymentStatus: PaymentCollectStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  revenueCollected?: boolean;
}

export type MembershipStatus =
  | "active"
  | "pending"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired";

export type BillingFrequency = "monthly" | "annual" | "one_time";

export interface Membership {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  name: string;
  membershipType: string;
  price: number;
  billingFrequency: BillingFrequency;
  startDate: string;
  renewalDate?: string;
  expirationDate?: string;
  paymentStatus: PaymentCollectStatus;
  status: MembershipStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  /** Collected only when paymentStatus === paid */
  revenueCollected?: boolean;
}

export type ExpenseCategory =
  | "inventory"
  | "coaching"
  | "website"
  | "marketing"
  | "payment_fees"
  | "operating"
  | "other";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface CustomerNote {
  id: string;
  userId: string;
  note: string;
  createdAt: string;
  createdBy?: string;
}

export interface ActivityLogEntry {
  id: string;
  at: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: string;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  previousStock: number;
  nextStock: number;
  delta: number;
  reason: string;
  at: string;
  actorName?: string;
}

export type BackupAttemptStatus = "success" | "failed" | "queued" | "skipped";

export interface BackupAttempt {
  id: string;
  at: string;
  status: BackupAttemptStatus;
  destination: "google_sheets" | "manual_export" | "self_test";
  detail: string;
  recordCounts?: Record<string, number>;
  actorName?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId?: string;
  spreadsheetName?: string;
  connected?: boolean;
  lastBackupAt?: string;
  lastBackupOk?: boolean;
  lastBackupDetail?: string;
  /** Never store private keys here in plaintext long-term; env preferred */
  serviceAccountEmail?: string;
  updatedAt?: string;
}

export type CouponType = "percent" | "fixed" | "free";

export interface Coupon {
  id: string;
  /** What customers type at checkout, e.g. cityviewlanes.com */
  code: string;
  description: string;
  type: CouponType;
  /** Percent 0–100, or fixed dollar amount. Ignored when type is free. */
  value: number;
  active: boolean;
  /** Max successful checkouts. 0 = unlimited */
  maxUses: number;
  /** How many times this code has been used at checkout */
  usedCount: number;
  /** Optional label for built-in starter coupons — all coupons can be edited/removed */
  system?: boolean;
}

/** Shopify keys saved from Ops (used when Vercel env vars are not set). */
export interface ShopifySiteConfig {
  storeDomain?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  adminAccessToken?: string;
  apiVersion?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface StoreData {
  /** Bumped on every inventory / catalog change so shop can pick the newest copy */
  updatedAt?: string;
  /**
   * Bumped only when products/prices/discounts/coupons/deals change.
   * Prevents order/user writes from overwriting newer catalog prices.
   */
  catalogUpdatedAt?: string;
  products: Product[];
  sponsors: Sponsor[];
  deals: Deal[];
  subscribers: Subscriber[];
  /** Ops announcement / document email history */
  announcements?: SubscriberAnnouncement[];
  users: User[];
  coaches: Coach[];
  texts: PageText[];
  roles: Role[];
  orders: Order[];
  coupons?: Coupon[];
  /** Optional Ops-saved Shopify credentials (never commit real secrets to git) */
  shopifyConfig?: ShopifySiteConfig;
  /** Ops business modules — empty arrays until staff adds records */
  coachingBookings?: CoachingBooking[];
  coachingPackages?: CoachingPackage[];
  memberships?: Membership[];
  expenses?: Expense[];
  customerNotes?: CustomerNote[];
  activityLog?: ActivityLogEntry[];
  stockAdjustments?: StockAdjustment[];
  backupAttempts?: BackupAttempt[];
  googleSheetsConfig?: GoogleSheetsConfig;
}

export interface CartItem {
  productId: string;
  quantity: number;
  /** Selected ball weight in lbs (required when product has weightOptions) */
  weight?: number;
}

export interface SessionPayload {
  userId: string;
  roleId: string;
  username: string;
  email: string;
  permissions: Permission[];
}
