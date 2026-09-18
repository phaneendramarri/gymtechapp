import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Receipt,
  Package,
  AlertTriangle,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import type { Product, PosSale } from '@gymtech/shared';

interface CartItem {
  product: Product;
  quantity: number;
}

const CATEGORIES = ['All', 'Drinks', 'Supplements', 'Apparel', 'Accessories', 'Snacks', 'General'];

export const PosPage: React.FC = () => {
  const { gym } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'register' | 'inventory' | 'history'>('register');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'CASH' | 'UPI' | 'CARD'>('UPI');
  const [memberCodeInput, setMemberCodeInput] = useState('');
  const [recentReceipt, setRecentReceipt] = useState<{ id: number; invoiceNumber: string; totalPaise: number } | null>(null);

  // New Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState('Drinks');
  const [prodPriceRupees, setProdPriceRupees] = useState<number | ''>('');
  const [prodCostRupees, setProdCostRupees] = useState<number | ''>('');
  const [prodStock, setProdStock] = useState<number>(20);
  const [prodLowStock, setProdLowStock] = useState<number>(5);

  // Queries
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['posProducts', gym?.id],
    queryFn: () => api.getProducts(gym?.id),
  });

  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ['posSales', gym?.id],
    queryFn: () => api.getPosSales(gym?.id),
  });

  const { data: membersData } = useQuery({
    queryKey: ['members-list-pos', gym?.id],
    queryFn: () => api.getMembers({ limit: 100 }),
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.createProduct(data, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posProducts'] });
      setIsProductModalOpen(false);
      setProdName('');
      setProdSku('');
      setProdPriceRupees('');
      setProdCostRupees('');
      toast('success', 'Product added to inventory');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to add product'),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posProducts'] });
      toast('success', 'Product removed');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to remove product'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (data: any) => api.createPosSale(data, gym?.id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['posProducts'] });
      qc.invalidateQueries({ queryKey: ['posSales'] });
      setRecentReceipt(res);
      setCart([]);
      setMemberCodeInput('');
      toast('success', 'Sale processed successfully!');
    },
    onError: (err: any) => toast('error', err.message || 'Checkout failed'),
  });

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotalPaise = cart.reduce(
    (sum, item) => sum + item.product.pricePaise * item.quantity,
    0
  );

  const handleCheckout = () => {
    if (cart.length === 0) return;

    let memberId: number | undefined = undefined;
    if (memberCodeInput.trim()) {
      const found = membersData?.members?.find(
        (m: any) =>
          m.memberCode?.toLowerCase() === memberCodeInput.trim().toLowerCase() ||
          String(m.id) === memberCodeInput.trim()
      );
      if (found) {
        memberId = found.id;
      }
    }

    checkoutMutation.mutate({
      memberId,
      paymentMode: selectedPaymentMode,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPricePaise: item.product.pricePaise,
      })),
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || prodPriceRupees === '') return;
    createProductMutation.mutate({
      name: prodName.trim(),
      sku: prodSku.trim() || undefined,
      category: prodCategory,
      pricePaise: Math.round(Number(prodPriceRupees) * 100),
      costPaise: Math.round(Number(prodCostRupees || 0) * 100),
      stockQuantity: prodStock,
      lowStockThreshold: prodLowStock,
    });
  };

  const products = productsData?.products || [];
  const sales = salesData?.sales || [];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-(--ink)">Point of Sale & Retail</h1>
          <p className="text-sm text-(--ink-3)">
            Sell supplements, drinks, gear, and track inventory stock levels in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'register' ? 'default' : 'outline'}
            onClick={() => setActiveTab('register')}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" />
            POS Register
          </Button>
          <Button
            variant={activeTab === 'inventory' ? 'default' : 'outline'}
            onClick={() => setActiveTab('inventory')}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <Package className="w-4 h-4" />
            Inventory & Stock
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            Sales Receipts
          </Button>
        </div>
      </div>

      {/* TAB 1: POS REGISTER */}
      {activeTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Catalog & Search */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search and Category Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--ink-3)" />
                <Input
                  placeholder="Search products or scan barcode/SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-(--iron) text-(--white)'
                        : 'bg-(--surface) text-(--ink-2) hover:text-(--ink) border border-(--border)'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            {loadingProducts ? (
              <div className="p-12 text-center text-(--ink-3) bg-(--surface) rounded-xl border border-(--border)">
                Loading inventory...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center bg-(--surface) rounded-xl border border-(--border) space-y-3">
                <ShoppingBag className="w-10 h-10 mx-auto text-(--ink-4)" />
                <p className="text-sm text-(--ink-2) font-medium">No products found</p>
                <Button size="sm" variant="outline" onClick={() => setIsProductModalOpen(true)}>
                  Add New Product
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map((prod) => {
                  const isOutOfStock = prod.stockQuantity <= 0;
                  const isLowStock = prod.stockQuantity <= prod.lowStockThreshold && !isOutOfStock;

                  return (
                    <button
                      key={prod.id}
                      disabled={isOutOfStock}
                      onClick={() => addToCart(prod)}
                      className={`p-3 rounded-xl border border-(--border) bg-(--surface) text-left transition-all hover:border-(--iron) hover:shadow-xs flex flex-col justify-between ${
                        isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-(--ink-3)">
                          <span className="truncate">{prod.category}</span>
                          {isLowStock && (
                            <span className="text-amber-500 font-medium flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Low
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm text-(--ink) mt-1 line-clamp-2">
                          {prod.name}
                        </h4>
                        {prod.sku && <p className="text-[10px] text-(--ink-3)">{prod.sku}</p>}
                      </div>

                      <div className="mt-3 pt-2 border-t border-(--border) flex items-center justify-between">
                        <span className="font-bold text-sm text-(--ink)">
                          {formatCurrency(prod.pricePaise)}
                        </span>
                        <span className="text-[10px] text-(--ink-3)">
                          {isOutOfStock ? 'Out of stock' : `${prod.stockQuantity} in stock`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 1 Col: Cart & Checkout Register */}
          <div className="bg-(--surface) border border-(--border) rounded-xl p-5 space-y-4 flex flex-col justify-between h-fit sticky top-6 shadow-xs">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-(--border)">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-(--iron)" />
                  <h3 className="font-semibold text-sm text-(--ink)">Register Cart</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </Badge>
              </div>

              {/* Cart Items List */}
              <div className="divide-y divide-(--border) max-h-[280px] overflow-y-auto mt-2">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-xs text-(--ink-3)">
                    Cart is empty. Tap products to add.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-(--ink) truncate">{item.product.name}</p>
                        <p className="text-(--ink-3)">
                          {formatCurrency(item.product.pricePaise)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-(--border) rounded-md">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="px-2 py-0.5 hover:bg-(--surface-hover) text-(--ink)"
                          >
                            -
                          </button>
                          <span className="px-2 font-medium text-(--ink)">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            disabled={item.quantity >= item.product.stockQuantity}
                            className="px-2 py-0.5 hover:bg-(--surface-hover) text-(--ink) disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-semibold text-(--ink) min-w-[50px] text-right">
                          {formatCurrency(item.product.pricePaise * item.quantity)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-(--ink-4) hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Checkout Form */}
            <div className="pt-3 border-t border-(--border) space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Member (Optional)</label>
                <Input
                  placeholder="Member Code (e.g. M-1001) or leave blank for guest"
                  value={memberCodeInput}
                  onChange={(e) => setMemberCodeInput(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-(--ink-2)">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(['UPI', 'CASH', 'CARD'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelectedPaymentMode(mode)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 transition-colors ${
                        selectedPaymentMode === mode
                          ? 'bg-(--iron) text-(--white) border-(--iron)'
                          : 'border-(--border) text-(--ink-2) hover:text-(--ink)'
                      }`}
                    >
                      {mode === 'UPI' && <Smartphone className="w-3.5 h-3.5" />}
                      {mode === 'CASH' && <Banknote className="w-3.5 h-3.5" />}
                      {mode === 'CARD' && <CreditCard className="w-3.5 h-3.5" />}
                      <span>{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-(--bg) rounded-lg space-y-1 text-xs">
                <div className="flex justify-between text-(--ink-3)">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotalPaise)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-(--ink) pt-1 border-t border-(--border)">
                  <span>Total Amount</span>
                  <span>{formatCurrency(subtotalPaise)}</span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || checkoutMutation.isPending}
                className="w-full bg-(--iron) text-(--white) hover:bg-(--iron-hover)"
              >
                {checkoutMutation.isPending ? 'Processing Sale...' : `Charge ${formatCurrency(subtotalPaise)}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY & STOCK MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-(--ink)">Product Catalog & Stock</h2>
            <Button onClick={() => setIsProductModalOpen(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </div>

          <div className="bg-(--surface) border border-(--border) rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-(--bg) text-(--ink-3) border-b border-(--border)">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-center">Stock</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-(--ink-3)">
                      No products in inventory. Add products to start selling.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isLow = p.stockQuantity <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-(--surface-hover)">
                        <td className="p-3 font-medium text-(--ink)">{p.name}</td>
                        <td className="p-3 text-(--ink-3)">{p.sku || '—'}</td>
                        <td className="p-3">
                          <Badge variant="outline">{p.category}</Badge>
                        </td>
                        <td className="p-3 text-right font-semibold text-(--ink)">
                          {formatCurrency(p.pricePaise)}
                        </td>
                        <td className="p-3 text-right text-(--ink-3)">
                          {formatCurrency(p.costPaise)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium text-[11px] ${
                              p.stockQuantity <= 0
                                ? 'bg-red-500/10 text-red-500'
                                : isLow
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-emerald-500/10 text-emerald-500'
                            }`}
                          >
                            {p.stockQuantity} units
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => deleteProductMutation.mutate(p.id)}
                            className="text-(--ink-4) hover:text-red-500 p-1 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SALES RECEIPTS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-(--ink)">Recent POS Transactions</h2>
          <div className="bg-(--surface) border border-(--border) rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-(--bg) text-(--ink-3) border-b border-(--border)">
                <tr>
                  <th className="p-3">Receipt / Invoice</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Member</th>
                  <th className="p-3">Payment Mode</th>
                  <th className="p-3 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-(--ink-3)">
                      No POS sales recorded yet.
                    </td>
                  </tr>
                ) : (
                  sales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-(--surface-hover)">
                      <td className="p-3 font-medium text-(--ink) flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-(--iron)" />
                        {s.invoiceNumber || s.receiptNumber}
                      </td>
                      <td className="p-3 text-(--ink-3)">
                        {s.createdAt ? new Date(s.createdAt * 1000).toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-(--ink-2)">
                        {s.memberName ? `${s.memberName} (${s.memberCode})` : 'Walk-in / Guest'}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{s.paymentMode}</Badge>
                      </td>
                      <td className="p-3 text-right font-bold text-(--ink)">
                        {formatCurrency(s.totalPaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-(--ink)">Add Inventory Product</h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-(--ink-3) hover:text-(--ink)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Product Name *</label>
                <Input
                  required
                  placeholder="e.g. Whey Protein 1kg, Energy Drink, Gym Shaker"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">SKU / Barcode</label>
                  <Input
                    placeholder="e.g. SNK-001"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Category</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg border border-(--border) bg-(--bg) text-sm text-(--ink) focus:outline-hidden"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Selling Price (₹) *</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    placeholder="e.g. 150"
                    value={prodPriceRupees}
                    onChange={(e) => setProdPriceRupees(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Cost Price (₹)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 90"
                    value={prodCostRupees}
                    onChange={(e) => setProdCostRupees(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Initial Stock Qty</label>
                  <Input
                    type="number"
                    min={0}
                    value={prodStock}
                    onChange={(e) => setProdStock(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Low Stock Alert</label>
                  <Input
                    type="number"
                    min={1}
                    value={prodLowStock}
                    onChange={(e) => setProdLowStock(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
                <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProductMutation.isPending}>
                  {createProductMutation.isPending ? 'Saving...' : 'Save Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT SUCCESS MODAL */}
      {recentReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-(--ink)">Sale Successful!</h3>
              <p className="text-xs text-(--ink-3)">Receipt #{recentReceipt.invoiceNumber}</p>
            </div>
            <div className="p-4 bg-(--bg) rounded-lg text-sm">
              <span className="text-(--ink-3)">Total Paid:</span>{' '}
              <span className="font-bold text-(--ink)">
                {formatCurrency(recentReceipt.totalPaise)}
              </span>
            </div>
            <Button
              className="w-full bg-(--iron) text-(--white)"
              onClick={() => setRecentReceipt(null)}
            >
              Done / Next Sale
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
