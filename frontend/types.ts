
export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  size: string; // Generic enough for 'S', 'M', 'L' or '40', '41', '42'
  // Set instead of color/size for a per-image-stock row - one of the product's own `images`,
  // giving that specific photo its own stock rather than varying by color or size.
  imageUrl?: string;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Always assume price is in USD for internal calculations
  discount?: number; // Added discount field
  category: string;
  subCategory: string; // Added subCategory
  images: string[]; // Changed from single image string to an array of image strings
  videoUrls?: string[]; // Optional showcase/demo videos, uploaded the same way as images
  rating: number;
  reviews: number;
  stock: number;
  featured?: boolean;
  /** Admin opt-in for "buy together" group orders on this product - see GroupOrderPage. */
  groupBuyEnabled?: boolean;
  reviewsList?: Review[]; // Added reviews list
  variants: ProductVariant[]; // Added variants for size/color
  /** Count of (non-hidden) reviews at each star level, for the rating-breakdown hover popover. */
  ratingBreakdown?: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Maps a variant color (e.g. "Red") to one of `images` - picking that color on the product
   * page jumps the gallery straight to its photo. Admin-assigned; a color with no entry here
   * just leaves the gallery where it was. */
  colorImages?: Record<string, string>;
  /** Per-image name/description override, keyed by image URL (one of `images`) - both optional,
   * and an image with neither set just has no entry here. Falls back to this product's own
   * name/description wherever an image is shown without an override. */
  imageDetails?: Record<string, { name?: string; description?: string }>;
}

export interface Review {
  id: string;
  userName: string;
  /** Snapshot of the reviewer's username at submission time - shown publicly instead of userName.
   * Absent on reviews written before usernames existed, or by an account since deleted. */
  userUsername?: string;
  rating: number;
  comment: string;
  date: string;
  image?: string; // New: Optional image for the review
  isHidden?: boolean; // Admin can hide from public view without deleting
  unread?: boolean; // Track if the review notification is unread by admin
}

export interface ReviewNotification extends Review {
  productId: string;
  productName: string;
}

export interface SubscriberNotification {
  id: string;
  email: string;
  subscribedAt: string;
  unread: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  // The exact photo shown when this was added - lets a product with no color variants (e.g.
  // several plain photos of different styles) still carry the specific photo the customer was
  // looking at, instead of always falling back to images[0].
  selectedImage?: string;
  // Only present on an order's line items (not a live cart item) - there, `id` is the order line
  // row's own id, and `productId` is the actual product it refers to (which may since have been
  // deleted, unlike `id` which always exists).
  productId?: string;
}

export interface User {
  id: string;
  name: string;
  /** Public-facing handle, unique across all accounts - shown on reviews instead of `name`. */
  username: string;
  email: string;
  phoneNumber?: string; // Optional phone number for users
  address: string;
  role: 'user' | 'admin' | 'rider';
  profileImage?: string | null; // New: Optional profile image (base64 string)
  // For admin user management, a password might be needed, but not for the core UserType.
  // Add an optional password field for admin management purposes.
  password?: string; // Optional: Only for admin management, not used for authentication directly from this type.
  isActive?: boolean; // Admin can deactivate to block login
  unread?: boolean; // New: Track if the registration is unread by admin
  twoFactorEnabled?: boolean; // Email-based 2FA challenge required at login
  registrationDate?: string; // New: Date of registration
}

export interface Order {
  id: string; // Internal UUID - used for API calls, links, React keys
  orderNumber?: string; // Human-readable display id, e.g. "KS-178790"
  customerName: string; // Added this
  deliveryAddress: {
    fullName: string;
    phoneNumber: string;
    email: string;
    country: string;
    cityTown: string;
    district: string;
    streetAddress: string;
    houseBuildingNumber?: string;
    additionalInfo?: string;
  };
  date: string;
  subtotal?: number; // Sum of item prices, RWF - computed server-side
  shippingFee?: number; // RWF - computed server-side from the delivery district
  shippingZone?: string; // Name of the matched shipping zone
  tax?: number; // RWF - computed server-side
  couponCode?: string; // Code applied at checkout, if any
  discountAmount?: number; // RWF - computed server-side from the coupon
  total: number; // Total stored in RWF - subtotal + shippingFee + tax - discountAmount, computed server-side
  currency?: string; // Optional currency label (e.g., 'RWF')
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';
  paymentStatus?: 'unpaid' | 'paid' | 'failed';
  paymentMethod?: string;
  items: CartItem[];
  trackingHistory?: TrackingEvent[];
  unread?: boolean; // New: Track if order is unread
  riderId?: string | null; // Delivery rider assigned to this order, if any
  riderName?: string | null;
  riderStopAlertAt?: string | null; // Set when the rider stops sharing location while this order is still Shipped
  riderStopAlertUnread?: boolean;
  deliveryVerificationCode?: string | null; // Shown to the customer once Shipped; the rider asks for it to confirm drop-off
  deliveryConfirmedAt?: string | null; // Set when the rider's code verification actually completes the delivery
  deliveryConfirmedUnread?: boolean;
  arrivalNotifiedAt?: string | null; // Set once the rider's live position comes within range of the delivery address
  returnRequest?: {
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    adminNote?: string | null;
    requestedAt: string;
    resolvedAt?: string | null;
    customerUnread: boolean;
  } | null;
}

export interface ReturnRequestNotification {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  total: number;
  currency?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
  unread: boolean;
}

export interface ShippingZone {
  id: string;
  name: string;
  districts: string[];
  fee: number;
  isDefault: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface TrackingEvent {
  status: string;
  date: string;
  description: string;
}

export type Category = string;

export interface FooterLink {
  label: string;
  to: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  senderRole: 'user' | 'admin';
  senderId: string | null;
  body: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  createdAt: string;
  readByUser: boolean;
  readByAdmin: boolean;
}

export interface ChatConversation {
  userId: string;
  name: string;
  email: string;
  profileImage: string | null;
  lastMessageBody: string | null;
  lastMessageAttachmentUrl: string | null;
  lastMessageAttachmentType: string | null;
  lastMessageAt: string;
  lastMessageSenderRole: 'user' | 'admin';
  unreadCount: number;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'replied';
  replyBody: string | null;
  repliedAt: string | null;
  unread: boolean;
  createdAt: string;
}
