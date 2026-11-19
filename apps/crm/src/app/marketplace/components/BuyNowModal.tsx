import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@repo/ui/dialog';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Badge } from '@repo/ui/badge';
import { Truck, ShoppingCart, Minus, Plus, Package, MapPin, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getMarketplaceProductImage, MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE } from './productImage';

interface Product {
  _id: string;
  productImage: string;
  productName: string;
  price: number;
  salePrice?: number;
  category?: string | { name: string; _id?: string };
  stock: number;
  vendorId: string;
  supplierName: string;
  supplierEmail: string;
  description: string;
  discount?: number;
  rating?: number;
}

interface BuyNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  shippingAddress: string;
  onShippingAddressChange: (address: string) => void;
  onPlaceOrder: () => void;
  isCreatingOrder: boolean;
}

export const BuyNowModal = ({
  isOpen,
  onClose,
  product,
  quantity,
  onQuantityChange,
  shippingAddress,
  onShippingAddressChange,
  onPlaceOrder,
  isCreatingOrder
}: BuyNowModalProps) => {
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [isAddressesCollapsed, setIsAddressesCollapsed] = useState(false);
  const [productImageSrc, setProductImageSrc] = useState(MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE);

  // New Address Form State
  const [newAddress, setNewAddress] = useState({
    fullName: '',
    mobileNo: '',
    pincode: '',
    houseNo: '',
    area: '',
    landmark: '',
    city: '',
    state: '',
    isPrimary: false
  });

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/crm/addresses');
      const data = await res.json();
      if (data.success && data.savedAddresses) {
        setSavedAddresses(data.savedAddresses);
        if (data.savedAddresses.length > 0) {
          const primary = data.savedAddresses.find((addr: any) => addr.isPrimary) || data.savedAddresses[0];
          setSelectedAddressId(primary._id);
          onShippingAddressChange(`${primary.address}, ${primary.landmark ? primary.landmark + ', ' : ''}${primary.city}, ${primary.state} - ${primary.pincode}`);
        }
      }
    } catch (error) {
      console.error('Error fetching CRM addresses:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAddresses();
    }
  }, [isOpen]);

  useEffect(() => {
    setProductImageSrc(getMarketplaceProductImage(product?.productImage));
  }, [product?.productImage]);

  const handleAddressSelect = (addr: any) => {
    setSelectedAddressId(addr._id);
    onShippingAddressChange(`${addr.address}, ${addr.landmark ? addr.landmark + ', ' : ''}${addr.city}, ${addr.state} - ${addr.pincode}`);
  };

  const handleEditAddress = (addr: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(addr._id);
    const parts = (addr.address || '').split(', ');
    const houseNo = parts[0] || '';
    const area = parts.slice(1).join(', ') || '';

    setNewAddress({
      fullName: addr.fullName || '',
      mobileNo: addr.mobileNo || '',
      pincode: addr.pincode || '',
      houseNo: houseNo,
      area: area,
      landmark: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || '',
      isPrimary: addr.isPrimary || false
    });
    setShowAddressForm(true);
  };

  const handleSaveNewAddress = async () => {
    if (!newAddress.fullName || !newAddress.mobileNo || !newAddress.pincode || !newAddress.houseNo || !newAddress.area || !newAddress.city || !newAddress.state) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const fullAddress = `${newAddress.houseNo}, ${newAddress.area}`;
      const url = editingAddressId 
        ? `/api/crm/addresses/${editingAddressId}`
        : '/api/crm/addresses';
      const method = editingAddressId ? 'PUT' : 'POST';

      const mobileRegex = /^[0-9]{10}$/;
      const pincodeRegex = /^[0-9]{6}$/;
      const nameRegex = /^[a-zA-Z\s]+$/;

      if (!nameRegex.test(newAddress.fullName)) {
        toast.error('Full Name should only contain letters');
        return;
      }
      if (!mobileRegex.test(newAddress.mobileNo)) {
        toast.error('Mobile Number must be exactly 10 digits');
        return;
      }
      if (!pincodeRegex.test(newAddress.pincode)) {
        toast.error('Pincode must be exactly 6 digits');
        return;
      }
      if (!nameRegex.test(newAddress.city)) {
        toast.error('City should only contain letters');
        return;
      }
      if (!nameRegex.test(newAddress.state)) {
        toast.error('State should only contain letters');
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newAddress.fullName,
          mobileNo: newAddress.mobileNo,
          address: fullAddress,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
          landmark: newAddress.landmark,
          lat: 1, lng: 1, 
          isPrimary: newAddress.isPrimary
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingAddressId ? 'Address updated' : 'Address saved');
        await fetchAddresses();
        setShowAddressForm(false);
        setEditingAddressId(null);
        setNewAddress({
          fullName: '', mobileNo: '', pincode: '', houseNo: '',
          area: '', landmark: '', city: '', state: '', isPrimary: false
        });
      } else {
        toast.error(data.message || 'Failed to save address');
      }
    } catch (error) {
      toast.error('Error saving address');
    }
  };

  if (!product) return null;

  const finalPrice = product.salePrice || product.price;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold">Quick Checkout</DialogTitle>
          <DialogDescription className="text-sm">
            Complete your purchase securely
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Left Column - Shipping & Contact Details */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Shipping & Contact Details
                </Label>
                {savedAddresses.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs text-sky-600 hover:text-sky-700 p-0"
                    onClick={() => setIsAddressesCollapsed(!isAddressesCollapsed)}
                  >
                    {isAddressesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              {!isAddressesCollapsed && savedAddresses.length > 0 && !showAddressForm && (
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {savedAddresses.map((addr) => (
                    <div
                      key={addr._id}
                      onClick={() => handleAddressSelect(addr)}
                      className={`relative p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedAddressId === addr._id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50 bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-foreground">{addr.fullName}</p>
                            {addr.isPrimary && <Badge variant="secondary" className="text-[10px] h-4">Default</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{addr.address}</p>
                          <p className="text-xs text-muted-foreground">{addr.city}, {addr.state} - {addr.pincode}</p>
                          <p className="text-xs font-medium pt-1">Phone: {addr.mobileNo}</p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-sky-600 font-normal text-xs"
                            onClick={(e) => handleEditAddress(addr, e)}
                          >
                            Edit
                          </Button>
                        </div>
                        {selectedAddressId === addr._id && (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    className="w-full border-dashed flex items-center gap-2 py-6 text-sm"
                    onClick={() => {
                        setEditingAddressId(null);
                        setNewAddress({
                            fullName: '', mobileNo: '', pincode: '', houseNo: '',
                            area: '', landmark: '', city: '', state: '', isPrimary: false
                        });
                        setShowAddressForm(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add New Address
                  </Button>
                </div>
              )}

              {(savedAddresses.length === 0 || showAddressForm) && (
                <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">
                      {editingAddressId ? 'Edit Address' : 'New Address'}
                    </h4>
                    {savedAddresses.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px]"
                        onClick={() => {
                          setShowAddressForm(false);
                          setEditingAddressId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-[11px] text-muted-foreground uppercase font-semibold">Full Name</Label>
                      <Input
                        id="fullName"
                        value={newAddress.fullName}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^[a-zA-Z\s]+$/.test(val)) {
                            setNewAddress({ ...newAddress, fullName: val });
                          }
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mobileNo" className="text-[11px] text-muted-foreground uppercase font-semibold">Mobile No</Label>
                      <Input
                        id="mobileNo"
                        value={newAddress.mobileNo}
                        onChange={(e) => {
                          const val = e.target.value;
                          if ((val === '' || /^[0-9]+$/.test(val)) && val.length <= 10) {
                            setNewAddress({ ...newAddress, mobileNo: val });
                          }
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pincode" className="text-[11px] text-muted-foreground uppercase font-semibold">Pincode</Label>
                      <Input
                        id="pincode"
                        value={newAddress.pincode}
                        onChange={(e) => {
                          const val = e.target.value;
                          if ((val === '' || /^[0-9]+$/.test(val)) && val.length <= 6) {
                            setNewAddress({ ...newAddress, pincode: val });
                          }
                        }}
                        placeholder="6-digit PIN"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="houseNo" className="text-[11px] text-muted-foreground uppercase font-semibold">Flat/House No</Label>
                      <Input
                        id="houseNo"
                        value={newAddress.houseNo}
                        onChange={(e) => setNewAddress({ ...newAddress, houseNo: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="area" className="text-[11px] text-muted-foreground uppercase font-semibold">Area/Street</Label>
                    <Input
                      id="area"
                      value={newAddress.area}
                      onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-[11px] text-muted-foreground uppercase font-semibold">City</Label>
                      <Input
                        id="city"
                        value={newAddress.city}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^[a-zA-Z\s]+$/.test(val)) {
                            setNewAddress({ ...newAddress, city: val });
                          }
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state" className="text-[11px] text-muted-foreground uppercase font-semibold">State</Label>
                      <Input
                        id="state"
                        value={newAddress.state}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^[a-zA-Z\s]+$/.test(val)) {
                            setNewAddress({ ...newAddress, state: val });
                          }
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isPrimaryCrm"
                      checked={newAddress.isPrimary}
                      onChange={(e) => setNewAddress({ ...newAddress, isPrimary: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="isPrimaryCrm" className="text-xs">Default address</Label>
                  </div>

                  <Button className="w-full h-9 text-xs" onClick={handleSaveNewAddress}>
                    {editingAddressId ? 'Save Changes' : 'Save and Use This Address'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Product Info & Summary */}
          <div className="space-y-4">
            {/* Product Info */}
            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                <Image
                  src={productImageSrc}
                  alt={product.productName}
                  fill
                  className="object-cover"
                  onError={() => setProductImageSrc(MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE)}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h4 className="font-semibold text-sm truncate text-foreground">
                  {product.productName}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {product.supplierName}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-base font-bold text-primary">
                    ₹{finalPrice.toFixed(0)}
                  </span>
                  {product.salePrice && product.price > product.salePrice && (
                    <span className="text-xs text-muted-foreground line-through">
                      ₹{product.price.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Quantity</Label>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-none hover:bg-muted" 
                    onClick={() => onQuantityChange(Math.max(1, quantity-1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <div className="w-14 h-9 flex items-center justify-center border-x border-border">
                    <span className="text-sm font-semibold">{quantity}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-none hover:bg-muted" 
                    onClick={() => onQuantityChange(Math.min(product.stock, quantity+1))}
                    disabled={quantity >= product.stock}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-base font-bold text-primary">
                    ₹{(finalPrice * quantity).toFixed(0)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Package className="h-3 w-3" />
                {product.stock} items available
              </p>
            </div>

            {/* Delivery Info */}
            <div className="flex items-start gap-2 p-3 border border-border rounded-lg">
              <div className="p-1.5 rounded-lg bg-muted">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-xs text-foreground">Fast & Reliable Delivery</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estimated: 3-5 business days
                </p>
              </div>
            </div>

            {/* Order Summary */}
            <div className="border border-border rounded-lg p-4">
              <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <ShoppingCart className="h-3.5 w-3.5" />
                Order Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">
                    Item{quantity > 1 ? 's' : ''} ({quantity})
                  </span>
                  <span className="font-medium text-foreground text-sm">
                    ₹{(finalPrice * quantity).toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">Shipping Fee</span>
                  <span className="font-semibold text-primary text-sm">FREE</span>
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-foreground">Total Amount</span>
                    <span className="font-bold text-lg text-primary">
                      ₹{(finalPrice * quantity).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 h-10"
          >
            Cancel
          </Button>
          <Button 
            onClick={onPlaceOrder} 
            disabled={isCreatingOrder || !shippingAddress.trim() || !product || !product.stock || product.stock <= 0}
            className="flex-1 h-10 bg-primary hover:bg-primary/90"
          >
            {isCreatingOrder ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Place Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
