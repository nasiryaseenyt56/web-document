export type ItemType = 'document' | 'website';
export type PaymentType = 'pay' | 'free';
export type ItemStatus = 'published' | 'draft';
export type OrderStatus = 'pending' | 'verified';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface Admin {
  id: string;
  phone: string;
  email: string;
  password?: string;
  created_at: string;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  website_url?: string;
  price: number;
  payment_type: PaymentType;
  account_numbers: string;
  status: ItemStatus;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  item_id: string;
  transfer_id: string;
  sender_name: string;
  status: OrderStatus;
  created_at: string;
  verified_at?: string;
  user?: {
    name: string;
    phone: string;
    email: string;
  };
  item?: {
    title: string;
    type: ItemType;
    price: number;
    website_url?: string;
    file_url?: string;
  };
}

export interface StoreSettings {
  admin_whatsapp: string;
  default_account_numbers: string;
}
