
import { Product, Category, Order, CartItem, FooterLink, User } from './types';

export const INITIAL_CATEGORIES: Category[] = ['Electronics', 'Home & Living', 'Beauty', 'Sports', 'Fashion'];

export interface CategorySection {
  title: string;
  titleKin?: string;
  items: string[];
  itemsKin?: string[]; // parallel to `items` - itemsKin[i] translates items[i]
}

export const INITIAL_CATEGORY_HIERARCHY: Record<Category, CategorySection[]> = {
  'Electronics': [
    { 
      title: '📱 Phones & Tablets', 
      items: ['Smartphones', 'Feature Phones', 'Tablets & iPads', 'E-Readers', 'Refurbished Devices'] 
    },
    { 
      title: '💻 Computing', 
      items: ['Business Laptops', 'Gaming Laptops', '2-in-1 Laptops', 'Desktop PCs', 'Monitors'] 
    },
    { 
      title: '🎧 Audio & Sound', 
      items: ['Wireless Headphones', 'Earbuds', 'Bluetooth Speakers', 'Home Theatre', 'Microphones'] 
    },
    { 
      title: '🎮 Gaming', 
      items: ['Consoles', 'Controllers', 'Video Games', 'Gaming Chairs', 'VR Headsets'] 
    },
    { 
      title: '🔌 Tech Accessories', 
      items: ['Phone Accessories', 'Cases & Covers', 'Chargers & Cables', 'Power Banks'] 
    }
  ],
  'Home & Living': [
    { 
      title: '🛋 Furniture', 
      items: ['Living Room', 'Sofas', 'Coffee Tables', 'Bedroom', 'Beds', 'Wardrobes'] 
    },
    { 
      title: '🍳 Kitchen', 
      items: ['Cookware Sets', 'Kitchen Appliances', 'Blenders', 'Air Fryers', 'Coffee Machines'] 
    },
    { 
      title: '🖼 Home Decor', 
      items: ['Wall Art', 'Mirrors', 'Decorative Vases', 'Clocks', 'Indoor Plants'] 
    },
    { 
      title: '💡 Lighting', 
      items: ['Ceiling Lights', 'Floor Lamps', 'Table Lamps', 'Smart Lighting', 'Outdoor Lights'] 
    },
    { 
      title: '🛏 Bed & Bath', 
      items: ['Bed Sheets', 'Duvet Covers', 'Pillows', 'Bath Towels', 'Bathroom Accessories'] 
    }
  ],
  'Beauty': [
    { 
      title: '🧴 Skincare', 
      items: ['Face Cleansers', 'Moisturizers', 'Serums & Oils', 'Sun Protection', 'Eye Care'] 
    },
    { 
      title: '💄 Makeup', 
      items: ['Face Makeup', 'Foundations', 'Eye Makeup', 'Mascaras', 'Palettes', 'Lipstick & Gloss'] 
    },
    { 
      title: '💇 Haircare', 
      items: ['Shampoos', 'Conditioners', 'Hair Treatments', 'Styling Tools', 'Hair Dryers', 'Straighteners'] 
    },
    { 
      title: '🌸 Fragrance', 
      items: ['Men’s Perfumes', 'Women’s Perfumes', 'Unisex Scents', 'Body Sprays', 'Fragrance Gift Sets'] 
    },
    { 
      title: '✂️ Personal Care', 
      items: ['Body Wash', 'Deodorants', 'Men’s Grooming', 'Trimmers', 'Shaving Kits', 'Beauty Tools'] 
    }
  ],
  'Sports': [
    { 
      title: '🏋 Fitness', 
      items: ['Dumbbells', 'Yoga Mats', 'Resistance Bands', 'Home Gym Sets', 'Jump Ropes'] 
    },
    { 
      title: '👟 Footwear', 
      items: ['Running Shoes', 'Training Shoes', 'Basketball Shoes', 'Hiking Boots', 'Sports Sandals'] 
    },
    { 
      title: '🏕 Outdoor', 
      items: ['Tents', 'Sleeping Bags', 'Camping Stoves', 'Backpacks', 'Water Bottles'] 
    },
    { 
      title: '🧘 Wellness', 
      items: ['Yoga Accessories', 'Massagers', 'Foam Rollers', 'Supplements', 'Protein Shakers'] 
    },
    { 
      title: '⌚ Sports Tech', 
      items: ['Smart Watches', 'Fitness Trackers', 'Heart Rate Monitors', 'Sports Headphones', 'Action Cameras'] 
    }
  ],
  'Fashion': [
    { 
      title: '👕 Men’s Fashion', 
      items: ['T-Shirts', 'Shirts', 'Hoodies', 'Jeans & Pants', 'Jackets'] 
    },
    { 
      title: '👗 Women’s Fashion', 
      items: ['Dresses', 'Blouses', 'Skirts', 'Leggings', 'Coats & Knits'] 
    },
    { 
      title: '🧒 Kids & Baby', 
      items: ['Boys’ Wear', 'Girls’ Wear', 'Baby Onesies', 'School Uniforms', 'Kids’ Shoes'] 
    },
    { 
      title: '👜 Accessories', 
      items: ['Handbags', 'Backpacks', 'Wallets', 'Belts', 'Travel Bags'] 
    },
    { 
      title: '💎 Jewelry & Watches', 
      items: ['Luxury Watches', 'Necklaces', 'Earrings', 'Bracelets', 'Sunglasses'] 
    }
  ],
};

// --- Currency Exchange Data ---
// Rates are relative to 1 USD
export const EXCHANGE_RATES: Record<string, number> = {
  'USD': 1,    // 1 USD = 1 USD
  'KES': 130,  // 1 USD = 130 KES
  'RWF': 1200, // 1 USD = 1200 RWF
};

export const CURRENCY_LABELS: Record<string, string> = {
  'USD': 'USD - US Dollar',
  'KES': 'KES - Kenyan Shilling',
  'RWF': 'RWF - Rwandan Franc',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'KES': 'Ksh ',
  'RWF': 'Rwf ',
};

export const INITIAL_CURRENCY = 'USD'; // Default currency

export const AVAILABLE_COLORS = ['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Purple', 'Orange', 'Pink', 'Grey'];

// --- Language Data ---
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English (US)' },
  { code: 'kin', label: 'Kinyarwanda' },
  { code: 'swa', label: 'Kiswahili' },
];
export const INITIAL_LANGUAGE = 'en'; // Default language

export const initialProductsData: Product[] = [
  // Electronics
  {
    id: '1',
    name: 'Aero Wireless Headphones',
    description: 'High-fidelity audio with active noise cancellation and 40-hour battery life.',
    price: 199.99, // USD
    category: 'Electronics',
    subCategory: 'Audio & Sound',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 128,
    stock: 15,
    featured: true
  },
  {
    id: '3',
    name: 'Smart Home Hub v3',
    description: 'Control your entire home with one sleek interface.',
    price: 149.99, // USD
    category: 'Electronics',
    subCategory: 'Tech Accessories',
    images: ['https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 64,
    stock: 10
  },
  {
    id: '7',
    name: 'Ultra Slim Laptop',
    description: 'Perfect for creators and professionals on the go.',
    price: 1299.99, // USD
    category: 'Electronics',
    subCategory: 'Computing',
    images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=600'],
    rating: 4.9,
    reviews: 45,
    stock: 8
  },
  {
    id: 'E4',
    name: '4K Smart TV 55-inch',
    description: 'Vivid colors and smart features for an immersive viewing experience.',
    price: 699.99, // USD
    category: 'Electronics',
    subCategory: 'Audio & Sound',
    images: ['https://images.unsplash.com/photo-1593786938920-56543b3531f8?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 150,
    stock: 20
  },
  {
    id: 'E5',
    name: 'Compact Digital Camera',
    description: 'Capture stunning photos and videos with ease.',
    price: 299.99, // USD
    category: 'Electronics',
    subCategory: 'Tech Accessories',
    images: ['https://images.unsplash.com/photo-1502920514313-52581002a659?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 70,
    stock: 25
  },
  {
    id: 'E6',
    name: 'Wireless Gaming Mouse',
    description: 'Ergonomic design with programmable buttons and high precision sensor.',
    price: 79.99, // USD
    category: 'Electronics',
    subCategory: 'Gaming',
    images: ['https://images.unsplash.com/photo-1614777647265-4d2d4c0c1b01?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 90,
    stock: 35
  },
  {
    id: 'E7',
    name: 'Portable Bluetooth Speaker',
    description: 'Powerful sound in a compact, waterproof design.',
    price: 89.99, // USD
    category: 'Electronics',
    subCategory: 'Audio & Sound',
    images: ['https://images.unsplash.com/photo-1596462502278-27ddf156d682?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 110,
    stock: 40
  },
  {
    id: 'E8',
    name: 'Noise-Cancelling Earbuds',
    description: 'Immersive audio and comfortable fit for all-day listening.',
    price: 129.99, // USD
    category: 'Electronics',
    subCategory: 'Audio & Sound',
    images: ['https://images.unsplash.com/photo-1605494660702-861c8a16709d?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 80,
    stock: 30
  },
  {
    id: 'E9',
    name: 'Smartwatch with Heart Rate',
    description: 'Track your fitness and stay connected on the go.',
    price: 179.99, // USD
    category: 'Electronics',
    subCategory: 'Tech Accessories',
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 130,
    stock: 22
  },
  {
    id: 'E10',
    name: 'External SSD 1TB',
    description: 'Fast and reliable portable storage for all your files.',
    price: 99.99, // USD
    category: 'Electronics',
    subCategory: 'Computing',
    images: ['https://images.unsplash.com/photo-1600003028247-493a743b1853?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 60,
    stock: 18
  },

  // Fashion
  {
    id: '2',
    name: 'Minimalist Cotton Tee',
    description: 'Premium organic cotton t-shirt with a modern slim fit.',
    price: 35.00, // USD
    category: 'Fashion',
    subCategory: 'Men’s Fashion',
    images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 89,
    stock: 50,
    featured: true
  },
  {
    id: '11',
    name: 'Leather Weekend Bag',
    description: 'Classic full-grain leather bag for short trips and commutes.',
    price: 210.00, // USD
    category: 'Fashion',
    subCategory: 'Accessories',
    images: ['https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 54,
    stock: 15
  },
  {
    id: 'F3',
    name: 'Denim Jacket Classic Blue',
    description: 'Timeless denim jacket, perfect for any casual outfit.',
    price: 85.00, // USD
    category: 'Fashion',
    subCategory: 'Men’s Fashion',
    images: ['https://images.unsplash.com/photo-1517058863678-a2624d455423?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 75,
    stock: 30
  },
  {
    id: 'F4',
    name: 'Women\'s Flowy Dress',
    description: 'Lightweight and elegant dress for summer days.',
    price: 60.00, // USD
    category: 'Fashion',
    subCategory: 'Women’s Fashion',
    images: ['https://images.unsplash.com/photo-1596752712953-e592751f782f?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 90,
    stock: 40
  },
  {
    id: 'F5',
    name: 'Stylish Sunglasses UV400',
    description: 'Protect your eyes with these fashionable UV400 sunglasses.',
    price: 25.00, // USD
    category: 'Fashion',
    subCategory: 'Jewelry & Watches',
    images: ['https://images.unsplash.com/photo-1572635196232-fd82b58d0442?auto=format&fit=crop&q=80&w=600'],
    rating: 4.4,
    reviews: 110,
    stock: 60
  },
  {
    id: 'F6',
    name: 'Leather Belt Men\'s',
    description: 'High-quality genuine leather belt with a classic buckle.',
    price: 40.00, // USD
    category: 'Fashion',
    subCategory: 'Accessories',
    images: ['https://images.unsplash.com/photo-1627993079979-9941a3174ae5?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 65,
    stock: 35
  },
  {
    id: 'F7',
    name: 'Silk Scarf Patterned',
    description: 'Elegant silk scarf with a unique, vibrant pattern.',
    price: 30.00, // USD
    category: 'Fashion',
    subCategory: 'Accessories',
    images: ['https://images.unsplash.com/photo-1520608554766-b3334c44249d?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 50,
    stock: 28
  },
  {
    id: 'F8',
    name: 'Winter Knit Beanie',
    description: 'Warm and comfortable knit beanie for cold weather.',
    price: 20.00, // USD
    category: 'Fashion',
    subCategory: 'Men’s Fashion',
    images: ['https://images.unsplash.com/photo-1579737199984-b0a70104f762?auto=format&fit=crop&q=80&w=600'],
    rating: 4.3,
    reviews: 80,
    stock: 45
  },
  {
    id: 'F9',
    name: 'Classic White Sneakers',
    description: 'Versatile and comfortable sneakers for everyday wear.',
    price: 70.00, // USD
    category: 'Fashion',
    subCategory: 'Footwear', // Added Footwear subCategory for fashion
    images: ['https://images.unsplash.com/photo-1552346154-21d32818274f?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 100,
    stock: 20
  },
  {
    id: 'F10',
    name: 'Minimalist Wallet',
    description: 'Slim leather wallet with RFID protection.',
    price: 55.00, // USD
    category: 'Fashion',
    subCategory: 'Accessories',
    images: ['https://images.unsplash.com/photo-1589133371497-7e618ee3f31e?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 55,
    stock: 32
  },

  // Home & Living
  {
    id: '4',
    name: 'Velvet Soft Cushion',
    description: 'Add comfort and style to your living room with our luxury velvet cushions.',
    price: 45.00, // USD
    category: 'Home & Living',
    subCategory: 'Home Decor',
    images: ['https://images.unsplash.com/photo-1584100936595-c0654b55a2e6?auto=format&fit=crop&q=80&w=600'],
    rating: 4.2,
    reviews: 42,
    stock: 30
  },
  {
    id: '8',
    name: 'Ceramic Coffee Set',
    description: 'Handcrafted ceramic mugs with a minimalist wooden tray.',
    price: 65.00, // USD
    category: 'Home & Living',
    subCategory: 'Kitchen',
    images: ['https://images.unsplash.com/photo-1517256011271-bc04177ee0e2?auto=format&fit=crop&q=80&w=600'],
    rating: 4.4,
    reviews: 22,
    stock: 25
  },
  {
    id: '12',
    name: 'Ergonomic Desk Chair',
    description: 'Fully adjustable chair designed for long hours of productivity.',
    price: 349.00, // USD
    category: 'Home & Living',
    subCategory: 'Furniture', // Changed to Home & Living / Furniture
    images: ['https://images.unsplash.com/photo-1505797149-43b0ad766207?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 78,
    stock: 10
  },
  {
    id: 'H4',
    name: 'Modern Floor Lamp',
    description: 'Sleek design with adjustable brightness and warm lighting.',
    price: 120.00, // USD
    category: 'Home & Living',
    subCategory: 'Lighting',
    images: ['https://images.unsplash.com/photo-1594326581977-9003551acb93?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 50,
    stock: 20
  },
  {
    id: 'H5',
    name: 'Aromatherapy Diffuser',
    description: 'Ultrasonic diffuser with essential oil set for a calming ambiance.',
    price: 40.00, // USD
    category: 'Home & Living',
    subCategory: 'Home Decor',
    images: ['https://images.unsplash.com/photo-1610486897109-c12e58a79854?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 80,
    stock: 30
  },
  {
    id: 'H6',
    name: 'Plush Area Rug 5x7',
    description: 'Soft and luxurious rug to elevate any room decor.',
    price: 180.00, // USD
    category: 'Home & Living',
    subCategory: 'Home Decor',
    images: ['https://images.unsplash.com/photo-1563884877401-05bf8883d6a7?auto=format&fit=crop&q=80&w=600'],
    rating: 4.3,
    reviews: 35,
    stock: 15
  },
  {
    id: 'H7',
    name: 'Smart Indoor Plant Pot',
    description: 'Self-watering pot with LED grow lights for healthy plants.',
    price: 75.00, // USD
    category: 'Home & Living',
    subCategory: 'Home Decor',
    images: ['https://images.unsplash.com/photo-1595156372076-02e20d2d3120?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 40,
    stock: 22
  },
  {
    id: 'H8',
    name: 'Wireless Vacuum Cleaner',
    description: 'Powerful suction and lightweight design for easy cleaning.',
    price: 250.00, // USD
    category: 'Home & Living',
    subCategory: 'Kitchen',
    images: ['https://images.unsplash.com/photo-1588667828038-f8605d8f6f59?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 60,
    stock: 18
  },
  {
    id: 'H9',
    name: 'Luxurious Bath Towel Set',
    description: 'Ultra-soft, highly absorbent cotton towels for a spa-like experience.',
    price: 90.00, // USD
    category: 'Home & Living',
    subCategory: 'Bed & Bath',
    images: ['https://images.unsplash.com/photo-1621259648601-22920202d68f?auto=format&fit=crop&q=80&w=600'],
    rating: 4.9,
    reviews: 70,
    stock: 28
  },
  {
    id: 'H10',
    name: 'Decorative Wall Mirror',
    description: 'Elegant framed mirror to enhance any living space.',
    price: 110.00, // USD
    category: 'Home & Living',
    subCategory: 'Home Decor',
    images: ['https://images.unsplash.com/photo-1596700018596-f94902b7a9f7?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 30,
    stock: 12
  },
  {
    id: 'FURN-109', // Original ID
    name: 'Ergo Pro Chair',
    description: 'Ergonomic office chair with lumbar support.',
    price: 299.00, // USD
    category: 'Home & Living', 
    subCategory: 'Furniture',
    images: ['https://images.unsplash.com/photo-1563884877401-05bf8883d6a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NzEyNjZ8MHwxfHNlYXJjaHw1OXx8b2ZmaWNlJTIwY2hhaXJ8ZW58MHwwfHx8MTcwMDgxNTAzNHww&ixlib=rb-4.0.3&q=80&w=400'],
    rating: 4.7,
    reviews: 90,
    stock: 5,
  },
  {
    id: 'FURN-002',
    name: 'Modern Coffee Table',
    description: 'Sleek design, perfect for any contemporary living space.',
    price: 180.00, // USD
    category: 'Home & Living', 
    subCategory: 'Furniture',
    images: ['https://images.unsplash.com/photo-1618221195791-aa858d55a15b?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 60,
    stock: 12,
  },
  {
    id: 'FURN-003',
    name: 'King Size Bed Frame',
    description: 'Sturdy wooden frame with minimalist aesthetic.',
    price: 450.00, // USD
    category: 'Home & Living', 
    subCategory: 'Furniture',
    images: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 45,
    stock: 7,
  },


  // Beauty
  {
    id: '6',
    name: 'Hydrating Face Serum',
    description: 'Advanced formula with hyaluronic acid for 24-hour hydration.',
    price: 55.00, // USD
    category: 'Beauty',
    subCategory: 'Skincare',
    images: ['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 95,
    stock: 45
  },
  {
    id: '9',
    name: 'Matte Lipstick Kit',
    description: 'Set of 5 long-wearing matte lipsticks in essential shades.',
    price: 45.00, // USD
    category: 'Beauty',
    subCategory: 'Makeup',
    images: ['https://images.unsplash.com/photo-1586773860418-d37222d8fce2?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 112,
    stock: 60
  },
  {
    id: 'B3',
    name: 'Revitalizing Night Cream',
    description: 'Wake up to smoother, more radiant skin with this rich formula.',
    price: 70.00, // USD
    category: 'Beauty',
    subCategory: 'Skincare',
    images: ['https://images.unsplash.com/photo-1616038936021-f2f2f7b8b2b2?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 80,
    stock: 30
  },
  {
    id: 'B4',
    name: 'Volumizing Mascara',
    description: 'Achieve dramatic lash volume and length that lasts all day.',
    price: 28.00, // USD
    category: 'Beauty',
    subCategory: 'Makeup',
    images: ['https://images.unsplash.com/photo-1590740618012-3b2d6d0f9a2e?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 100,
    stock: 50
  },
  {
    id: 'B5',
    name: 'Nourishing Hair Mask',
    description: 'Repair and strengthen damaged hair with deep conditioning.',
    price: 35.00, // USD
    category: 'Beauty',
    subCategory: 'Haircare',
    images: ['https://images.unsplash.com/photo-1622619421110-38e55e51c8f1?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 70,
    stock: 40
  },
  {
    id: 'B6',
    name: 'Eyeliner Pencil Waterproof',
    description: 'Long-lasting, smudge-proof eyeliner for precise application.',
    price: 18.00, // USD
    category: 'Beauty',
    subCategory: 'Makeup',
    images: ['https://images.unsplash.com/photo-1595159098939-f9c4f8b9e6e8?auto=format&fit=crop&q=80&w=600'],
    rating: 4.4,
    reviews: 90,
    stock: 55
  },
  {
    id: 'B7',
    name: 'Facial Cleansing Brush',
    description: 'Deeply cleanse and exfoliate for a brighter complexion.',
    price: 50.00, // USD
    category: 'Beauty',
    subCategory: 'Skincare',
    images: ['https://images.unsplash.com/photo-1617066925574-d021c17c7d41?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 60,
    stock: 25
  },
  {
    id: 'B8',
    name: 'Anti-Aging Eye Cream',
    description: 'Reduce fine lines and dark circles around the delicate eye area.',
    price: 65.00, // USD
    category: 'Beauty',
    subCategory: 'Skincare',
    images: ['https://images.unsplash.com/photo-1610427352342-998f5a5e3b5e?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 75,
    stock: 30
  },
  {
    id: 'B9',
    name: 'Bronzer & Highlighter Palette',
    description: 'Sculpt and illuminate your face with this versatile palette.',
    price: 40.00, // USD
    category: 'Beauty',
    subCategory: 'Makeup',
    images: ['https://images.unsplash.com/photo-1590740618021-d0097f4c9c2d?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 85,
    stock: 38
  },
  {
    id: 'B10',
    name: 'Premium Shaving Cream',
    description: 'Rich, moisturizing shaving cream for a smooth, irritation-free shave.',
    price: 22.00, // USD
    category: 'Beauty',
    subCategory: 'Personal Care',
    images: ['https://images.unsplash.com/photo-1593409151528-dc053229b3c4?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 50,
    stock: 42
  },

  // Sports
  {
    id: '5',
    name: 'Pro Running Shoes',
    description: 'Lightweight and responsive shoes designed for long-distance comfort.',
    price: 120.00, // USD
    category: 'Sports',
    subCategory: 'Footwear',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600'],
    rating: 4.9,
    reviews: 210,
    stock: 12,
    featured: true
  },
  {
    id: '10',
    name: 'Carbon Fiber Bike',
    description: 'Professional-grade road bike for elite performance.',
    price: 2450.00, // USD
    category: 'Sports',
    subCategory: 'Fitness',
    images: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&q=80&w=600'],
    rating: 5.0,
    reviews: 15,
    stock: 3
  },
  {
    id: 'S3',
    name: 'Smart Fitness Tracker',
    description: 'Monitor your heart rate, steps, and sleep with advanced tracking.',
    price: 99.99, // USD
    category: 'Sports',
    subCategory: 'Sports Tech',
    images: ['https://images.unsplash.com/photo-1558980394-49033878b667?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 150,
    stock: 25
  },
  {
    id: 'S4',
    name: 'Yoga Mat Non-Slip',
    description: 'Premium eco-friendly yoga mat for optimal grip and comfort.',
    price: 40.00, // USD
    category: 'Sports',
    subCategory: 'Wellness',
    images: ['https://images.unsplash.com/photo-1591291689617-66a98f121172?auto=format&fit=crop&q=80&w=600'],
    rating: 4.8,
    reviews: 110,
    stock: 40
  },
  {
    id: 'S5',
    name: 'Water Bottle Stainless Steel',
    description: 'Insulated bottle keeps drinks cold for 24 hours or hot for 12.',
    price: 25.00, // USD
    category: 'Sports',
    subCategory: 'Outdoor',
    images: ['https://images.unsplash.com/photo-1556637640-adb310ef0b3d?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 90,
    stock: 50
  },
  {
    id: 'S6',
    name: 'Resistance Band Set',
    description: 'Versatile bands for strength training, yoga, and physical therapy.',
    price: 30.00, // USD
    category: 'Sports',
    subCategory: 'Fitness',
    images: ['https://images.unsplash.com/photo-1603597816027-e8188e40409a?auto=format&fit=crop&q=80&w=600'],
    rating: 4.5,
    reviews: 70,
    stock: 60
  },
  {
    id: 'S7',
    name: 'Camping Tent 2-Person',
    description: 'Lightweight and durable tent for outdoor adventures.',
    price: 150.00, // USD
    category: 'Sports',
    subCategory: 'Outdoor',
    images: ['https://images.unsplash.com/photo-1537225134706-93231f24d776?auto=format&fit=crop&q=80&w=600'],
    rating: 4.7,
    reviews: 45,
    stock: 10
  },
  {
    id: 'S8',
    name: 'Adjustable Dumbbell',
    description: 'Space-saving adjustable weights for full-body workouts.',
    price: 180.00, // USD
    category: 'Sports',
    subCategory: 'Fitness',
    images: ['https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&q=80&w=600'],
    rating: 4.9,
    reviews: 80,
    stock: 15
  },
  {
    id: 'S9',
    name: 'Hiking Backpack 60L',
    description: 'Comfortable and spacious backpack for multi-day treks.',
    price: 95.00, // USD
    category: 'Sports',
    subCategory: 'Outdoor',
    images: ['https://images.unsplash.com/photo-1549419163-f2732924f35e?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 55,
    stock: 20
  },
  {
    id: 'S10',
    name: 'Portable Mini Golf Set',
    description: 'Enjoy golf anywhere with this fun, portable mini golf set.',
    price: 60.00, // USD
    category: 'Sports',
    subCategory: 'Outdoor',
    images: ['https://images.unsplash.com/photo-1579975775435-0c7f7d6a4c2f?auto=format&fit=crop&q=80&w=600'],
    rating: 4.3,
    reviews: 30,
    stock: 18
  },
  // Products that are in 'Food' or 'Furniture' category but these categories are removed from the main navigation
  {
    id: 'FOOD-001', // Original unique ID
    name: 'Choco Protein Mix',
    description: 'High-quality chocolate protein powder for muscle recovery.',
    price: 45.00, // USD
    category: 'Food', // This product category might not be displayed in navbar
    subCategory: 'Supplements',
    images: ['https://images.unsplash.com/photo-1627885474668-5494a37b386d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NzEyNjZ8MHwxfHNlYXJjaHw4OXx8cHJvdGVpbiUyMHBvd2RlcnxlbnwwfDB8fHwxNzAwODE3MDQ3fDA&ixlib=rb-4.0.3&q=80&w=400'],
    rating: 4.7,
    reviews: 120,
    stock: 0, // Out of stock for testing
  },
  {
    id: 'FOOD-002',
    name: 'Organic Honey 500g',
    description: 'Pure, raw organic honey from local farms.',
    price: 12.50, // USD
    category: 'Food', // This product category might not be displayed in navbar
    subCategory: 'Pantry Staples',
    images: ['https://images.unsplash.com/photo-1570643194723-86477b10283c?auto=format&fit=crop&q=80&w=600'],
    rating: 4.9,
    reviews: 80,
    stock: 50,
  },
  {
    id: 'FOOD-003',
    name: 'Fresh Avocado (per unit)',
    description: 'Ripe and creamy avocados, perfect for salads or guacamole.',
    price: 2.99, // USD
    category: 'Food', // This product category might not be displayed in navbar
    subCategory: 'Fresh Produce',
    images: ['https://images.unsplash.com/photo-1587440402283-9b38031d279e?auto=format&fit=crop&q=80&w=600'],
    rating: 4.6,
    reviews: 150,
    stock: 100,
  },
  {
    id: 'BEAUT-001',
    name: 'Organic Face Cream',
    description: 'Natural ingredients for healthy, glowing skin.',
    price: 25.00, // USD
    category: 'Beauty',
    subCategory: 'Skincare',
    images: ['https://images.unsplash.com/photo-1615106294721-e8d1219b124e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NzEyNjZ8MHwxfHNlYXJjaHw5OXx8ZmFjZSUyMGNyZWFtfGVufDB8MHx8fDE3MDA3MzkxODF8MA&ixlib=rb-4.0.3&q=80&w=400'],
    rating: 4.5,
    reviews: 100,
    stock: 45,
  },
  {
    id: 'ELEC-442',
    name: 'X-Lite Smartwatch',
    description: 'Track your fitness, notifications, and more.',
    price: 199.00, // USD
    category: 'Electronics',
    subCategory: 'Tech Accessories',
    images: ['https://images.unsplash.com/photo-1546868871-7041f2a55e12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NzEyNjZ8MHwxfHNlYXJjaHwyMHx8c21hcnR3YXRjaHxlbnwwfDB8fHwxNzAwNzM5MjQ1fDA&ixlib=rb-4.0.3&q=80&w=400'],
    rating: 4.2,
    reviews: 80,
    stock: 8,
  },
  {
    id: 'SPRT-882',
    name: 'Adjustable Dumbbells',
    description: 'Space-saving adjustable weights for home workouts.',
    price: 120.00, // USD
    category: 'Sports',
    subCategory: 'Fitness',
    images: ['https://images.unsplash.com/photo-1574680096145-d05b474e2155?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NzEyNjZ8MHwxfHNlYXJjaHwxMXx8ZHVtYmJlbGx8ZW58MHwwfHx8MTcwMDgxNTAzNHww&ixlib=rb-4.0.3&q=80&w=400'],
    rating: 4.8,
    reviews: 150,
    stock: 12,
  },
  {
    id: 'FURN-110', // Changed from FURN-109 to ensure unique ID
    name: 'Ergo Pro Chair',
    description: 'Ergonomic office chair with lumbar support.',
    price: 299.00, // USD
    category: 'Home & Living', 
    subCategory: 'Furniture',
    images: ['https://images.unsplash.com/photo-1563884877401-05bf8883d6a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NzEyNjZ8MHwxfHNlYXJjaHw1OXx8b2ZmaWNlJTIwY2haX4zNHww&ixlib=rb-4.0.3&q=80&w=400'],
    rating: 4.7,
    reviews: 90,
    stock: 5,
  },
  {
    id: 'FOOD-004', // Changed from FOOD-001 to ensure unique ID
    name: 'Choco Protein Mix',
    description: 'High-quality chocolate protein powder for muscle recovery.',
    price: 45.00, // USD
    category: 'Food', 
    subCategory: 'Supplements',
    images: ['https://images.unsplash.com/photo-1627885474668-5494a37b386d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0NzEyNjZ8MHwxfHNlYXJjaHw4OXx8cHJvdGVpbiUyMHBvd2RlcnxlbnwwfDB8fHwxNzAwODE3MDQ3fDA&ixlib=rb-4.0.3&q=80&w=400'],
    rating: 4.7,
    reviews: 120,
    stock: 0,
  }
];

export const SALES_DATA = [
  { name: 'Mon', sales: 4000, orders: 24 },
  { name: 'Tue', sales: 3000, orders: 18 },
  { name: 'Wed', sales: 2000, orders: 12 },
  { name: 'Thu', sales: 2780, orders: 15 },
  { name: 'Fri', sales: 1890, orders: 10 },
  { name: 'Sat', sales: 2390, orders: 14 },
  { name: 'Sun', sales: 3490, orders: 20 },
];

export const DAILY_SALES_DATA = Array.from({ length: 30 }, (_, i) => ({
  name: `${i + 1}`,
  sales: Math.floor(Math.random() * 5000) + 1000,
  orders: Math.floor(Math.random() * 30) + 5,
}));

export const MONTHLY_SALES_DATA = [
  { name: 'Jan', sales: 45000, orders: 240 },
  { name: 'Feb', sales: 52000, orders: 280 },
  { name: 'Mar', sales: 48000, orders: 260 },
  { name: 'Apr', sales: 61000, orders: 320 },
  { name: 'May', sales: 55000, orders: 300 },
  { name: 'Jun', sales: 67000, orders: 350 },
  { name: 'Jul', sales: 72000, orders: 380 },
];

export const ORDER_STATUS_COLORS = {
  'Pending': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Processing': { bg: 'bg-emerald-100', text: 'text-emerald-700' }, // Added 'Processing'
  'Shipped': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Delivered': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Cancelled': { bg: 'bg-red-100', text: 'text-red-700' },
  'Returned': { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export const initialOrdersData: Order[] = [
  {
    id: 'KS-001',
    date: '2023-11-20',
    total: 350.75, // USD
    status: 'Delivered',
    items: [
      {
        id: '1',
        name: 'Aero Wireless Headphones',
        description: 'High-fidelity audio with active noise cancellation and 40-hour battery life.',
        price: 199.99, // USD
        category: 'Electronics',
        subCategory: 'Audio & Sound',
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600'],
        rating: 4.8,
        reviews: 128,
        stock: 15,
        quantity: 1,
      },
      {
        id: '4',
        name: 'Velvet Soft Cushion',
        description: 'Add comfort and style to your living room with our luxury velvet cushions.',
        price: 45.00, // USD
        category: 'Home & Living',
        subCategory: 'Home Decor',
        images: ['https://images.unsplash.com/photo-1584100936595-c0654b55a2e6?auto=format&fit=crop&q=80&w=600'],
        rating: 4.2,
        reviews: 42,
        stock: 30,
        quantity: 2,
      },
    ],
  },
  {
    id: 'KS-002',
    date: '2023-11-22',
    total: 89.99, // USD
    status: 'Shipped',
    items: [
      {
        id: 'E6',
        name: 'Wireless Gaming Mouse',
        description: 'Ergonomic design with programmable buttons and high precision sensor.',
        price: 79.99, // USD
        category: 'Electronics',
        subCategory: 'Gaming',
        images: ['https://images.unsplash.com/photo-1614777647265-4d2d4c0c1b01?auto=format&fit=crop&q=80&w=600'],
        rating: 4.8,
        reviews: 90,
        stock: 35,
        quantity: 1,
      },
    ],
  },
  {
    id: 'KS-003',
    date: '2023-11-25',
    total: 120.00, // USD
    status: 'Pending',
    items: [
      {
        id: 'S5',
        name: 'Water Bottle Stainless Steel',
        description: 'Insulated bottle keeps drinks cold for 24 hours or hot for 12.',
        price: 25.00, // USD
        category: 'Sports',
        subCategory: 'Outdoor',
        images: ['https://images.unsplash.com/photo-1556637640-adb310ef0b3d?auto=format&fit=crop&q=80&w=600'],
        rating: 4.6,
        reviews: 90,
        stock: 50,
        quantity: 1,
      },
      {
        id: '2',
        name: 'Minimalist Cotton Tee',
        description: 'Premium organic cotton t-shirt with a modern slim fit.',
        price: 35.00, // USD
        category: 'Fashion',
        subCategory: 'Men’s Fashion',
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600'],
        rating: 4.5,
        reviews: 89,
        stock: 50,
        quantity: 2,
      },
    ],
  },
  {
    id: 'KS-004',
    date: '2023-11-26',
    total: 210.00, // USD
    status: 'Processing',
    items: [
      {
        id: '11',
        name: 'Leather Weekend Bag',
        description: 'Classic full-grain leather bag for short trips and commutes.',
        price: 210.00, // USD
        category: 'Fashion',
        subCategory: 'Accessories',
        images: ['https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&q=80&w=600'],
        rating: 4.8,
        reviews: 54,
        stock: 15,
        quantity: 1,
      },
    ],
  },
  {
    id: 'KS-005',
    date: '2023-11-27',
    total: 342.15, // USD
    status: 'Cancelled',
    items: [
      {
        id: '7',
        name: 'Ultra Slim Laptop',
        description: 'Perfect for creators and professionals on the go.',
        price: 1299.99, // USD
        category: 'Electronics',
        subCategory: 'Computing',
        images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=600'],
        rating: 4.9,
        reviews: 45,
        stock: 8,
        quantity: 1,
      },
    ],
  },
];

export const INITIAL_FOOTER_SETTINGS = {
  locationLines: ['22A Street, Kanombe', 'Kicukiro, Kigali, Rwanda'],
  phoneNumber: '+250783655163',
  whatsappNumber: '+250783655163',
  emailAddress: 'kuisoko@gmail.com',
  quickLinks: [
    { label: 'Shop All', to: '/shop' },
    { label: 'Account', to: '/dashboard' },
    { label: 'View Cart', to: '/cart' },
    { label: 'Merchant Portal', to: '/admin' },
  ],
  supportLinks: [
    { label: 'FAQ', to: '/faq' },
    { label: 'Shipping Policy', to: '#' },
    { label: 'Privacy Policy', to: '#' },
    { label: 'Terms of Service', to: '#' },
  ],
  copyrightText: `© ${new Date().getFullYear()} KuISOKO Inc. All rights reserved. Built for MVP.`,
  storeLat: null as number | null,
  storeLng: null as number | null,
};

export const INITIAL_MAINTENANCE_MODE = false; // Added for new feature

export const initialUsersData: User[] = [
  {
    id: 'user4',
    name: 'Test User',
    username: 'testuser',
    email: 'user@gmail.com',
    address: '123 Test Lane, Test City',
    role: 'user',
    password: 'user123',
    profileImage: undefined,
  },
  {
    id: 'admin1',
    name: 'Alex Mbugua',
    username: 'alexmbugua',
    email: 'admin@gmail.com',
    address: '789 Admin Tower, Central City',
    role: 'admin',
    password: 'admin123', // Stored for mock validation only
    profileImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqQjhKfTR2-7oaEyTJYUyna9q65rKOdnR22Nzy74hogmbgX6vefHT-V02JxkdgL39p2dNgtCbRTD7sT-KNxHoXx0y4fJz2GOQqFICCRdQJQ',
  },
  {
    id: 'user1',
    name: 'Jane Doe',
    username: 'janedoe',
    email: 'jane@example.com',
    address: '123 Marketplace Ave, Digital City',
    role: 'user',
    password: 'password123', // Stored for mock validation only
    profileImage: undefined,
  },
  {
    id: 'user2',
    name: 'John Smith',
    username: 'johnsmith',
    email: 'john.smith@example.com',
    address: '456 Commerce St, Cyberville',
    role: 'user',
    password: 'password123', // Stored for mock validation only
    profileImage: undefined,
  },
  {
    id: 'user3',
    name: 'Alice Johnson',
    username: 'alicejohnson',
    email: 'alice.j@example.com',
    address: '789 Retail Rd, E-city',
    role: 'user',
    password: 'password123', // Stored for mock validation only
    profileImage: undefined,
  },
];

export const USER_TABLE_HEADERS = ['User ID', 'Name', 'Email', 'Role', 'Actions'];
