"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/tabs";
import ServicesTab from "./components/ServicesTab";
import ProductsTab from "./components/ProductsTab";
import { useCrmAuth } from "@/hooks/useCrmAuth";

// Client interface
interface Client {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  birthdayDate: string;
  gender: 'Male' | 'Female' | 'Other';
  country: string;
  occupation: string;
  profilePicture?: string;
  address: string;
  preferences?: string;
  lastVisit: string;
  totalBookings: number;
  totalSpent: number;
  status: 'Active' | 'Inactive' | 'New';
  createdAt?: string;
  updatedAt?: string;
}

// Service interface
interface Service {
  _id: string;
  name: string;
  category: {
    _id: string;
    name: string;
  };
  categoryName: string;
  price: number;
  duration: number;
  description: string;
  status: string;
}

// Product interface
interface Product {
  _id: string;
  productImage: string;
  productName: string;
  price: number;
  salePrice: number;
  category: string;
  categoryDescription?: string;
  stock: number;
  isActive: boolean;
  description?: string;
  status: 'pending' | 'approved' | 'disapproved';
}

// Service cart item interface
interface ServiceCartItem extends Service {
  quantity: number;
  totalPrice: number;
  addOns?: any[];
  staffMember?: {
    id: string;
    name: string;
  };
}

// Product cart item interface
interface ProductCartItem extends Product {
  quantity: number;
  totalPrice: number;
  addOns?: any[];
}

export default function SalesPage() {
  const { user, role, isLoading } = useCrmAuth();
  const userRole = (role || user?.role || "").toLowerCase();
  const isSupplier = userRole === 'supplier';

  // Determine initial active tab based on user role
  const initialTab = isSupplier ? 'products' : 'services';

  // Tab state
  const [activeTab, setActiveTab] = useState<'services' | 'products'>(initialTab);

  // Sync tab when role becomes available
  useEffect(() => {
    if (isSupplier) {
      setActiveTab('products');
    }
  }, [isSupplier]);

  // Shared states between tabs
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [serviceCart, setServiceCart] = useState<ServiceCartItem[]>([]);
  const [productCart, setProductCart] = useState<ProductCartItem[]>([]);

  // Determine which tabs to show based on user role
  const showServicesTab = !isSupplier && userRole !== '';
  const showProductsTab = true;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold font-headline mb-1 bg-gradient-to-r from-foreground via-primary to-primary/80 bg-clip-text text-transparent">
                Sales Overview
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
                Manage your sales and process customer transactions
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="mb-6">
            <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-8">
              {showServicesTab && (
                <TabsTrigger 
                  value="services"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-1 font-medium text-sm"
                >
                  Services
                </TabsTrigger>
              )}
              {showProductsTab && (
                <TabsTrigger 
                  value="products"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-1 font-medium text-sm"
                >
                  Products
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {showServicesTab && (
            <TabsContent value="services" className="mt-0 mt-6 focus-visible:ring-0">
              <ServicesTab
                cart={serviceCart}
                setCart={setServiceCart}
                selectedClient={selectedClient}
                setSelectedClient={setSelectedClient}
              />
            </TabsContent>
          )}

          <TabsContent value="products" className="mt-0 mt-6 focus-visible:ring-0">
            <ProductsTab
              cart={productCart}
              setCart={setProductCart}
              selectedClient={selectedClient}
              setSelectedClient={setSelectedClient}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
