export interface Product {
  id: string;
  sku: string;
  currentStock: number;
  totalOut: number;
  totalIn: number;
  price: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Statistics {
  totalProducts: number;
  totalStock: number;
  totalOut: number;
  totalIn: number;
  lowStockCount: number;
  totalValue: number;
}

export interface User {
  id: string;
  phone: string;
  name?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    orders?: number;
  };
}

export interface Order {
  id: string;
  orderNumber?: number;
  customerId: string;
  status: string;
  totalAmount: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  customer?: Customer;
  orderItems?: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  createdAt?: string;
  product?: Product;
}

export interface PurchaseRecord {
  id: string;
  customerId: string;
  productId: string;
  quantity: number;
  price: number;
  totalAmount: number;
  purchaseDate?: string;
  createdAt?: string;
  customer?: Customer;
  product?: Product;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  showSuccessMessage?: boolean;
  successMessage?: string;
  showErrorMessage?: boolean;
  errorMessage?: string;
}