
export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  size: string; // Generic enough for 'S', 'M', 'L' or '40', '41', '42'
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
  reviewsList?: Review[]; // Added reviews list
  variants: ProductVariant[]; // Added variants for size/color
  /** Count of (non-hidden) reviews at each star level, for the rating-breakdown hover popover. */
  ratingBreakdown?: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface Review {
  id: string;
  userName: string;
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string; // Optional phone number for users
  address: string;
  role: 'user' | 'admin'; // Added role to user
  profileImage?: string | null; // New: Optional profile image (base64 string)
  // For admin user management, a password might be needed, but not for the core UserType.
  // Add an optional password field for admin management purposes.
  password?: string; // Optional: Only for admin management, not used for authentication directly from this type.
  isActive?: boolean; // Admin can deactivate to block login
  unread?: boolean; // New: Track if the registration is unread by admin
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
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'; // Added 'Processing' status
  paymentStatus?: 'unpaid' | 'paid' | 'failed';
  paymentMethod?: string;
  items: CartItem[];
  trackingHistory?: TrackingEvent[];
  unread?: boolean; // New: Track if order is unread
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
  body: string;
  createdAt: string;
  readByUser: boolean;
  readByAdmin: boolean;
}

export interface ChatConversation {
  userId: string;
  name: string;
  email: string;
  profileImage: string | null;
  lastMessageBody: string;
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
