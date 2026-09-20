import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Plus,
  Receipt,
  Trash2,
  Calendar,
  Filter,
  PieChart,
  Tag,
  Building,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import type { Expense, ExpenseCategory } from '@gymtech/shared';

export const ExpensesPage: React.FC = () => {
  const { gym } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'ALL'>('ALL');

  // New Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expCategoryId, setExpCategoryId] = useState<number | ''>('');
  const [expAmountRupees, setExpAmountRupees] = useState<number | ''>('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expPaymentMode, setExpPaymentMode] = useState<any>('UPI');
  const [expVendor, setExpVendor] = useState('');

  // New Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Queries
  const { data: categoriesData, isLoading: loadingCats } = useQuery({
    queryKey: ['expenseCategories', gym?.id],
    queryFn: () => api.getExpenseCategories(gym?.id),
  });

  const { data: expensesData, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', gym?.id, dateFrom, dateTo, selectedCategoryFilter],
    queryFn: () =>
      api.getExpenses({
        gymId: gym?.id,
        from: dateFrom,
        to: dateTo,
        categoryId: selectedCategoryFilter === 'ALL' ? undefined : selectedCategoryFilter,
      }),
  });

  const { data: plData, isLoading: loadingPl } = useQuery({
    queryKey: ['profitLoss', gym?.id, dateFrom, dateTo],
    queryFn: () => api.getProfitLoss({ from: dateFrom, to: dateTo, gymId: gym?.id }),
  });

  // Mutations
  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => api.createExpense(data, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['profitLoss'] });
      setIsExpenseModalOpen(false);
      setExpTitle('');
      setExpAmountRupees('');
      setExpVendor('');
      toast('success', 'Expense logged successfully');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to record expense'),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => api.deleteExpense(id, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['profitLoss'] });
      toast('success', 'Expense deleted');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to delete expense'),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => api.createExpenseCategory(data, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenseCategories'] });
      setIsCategoryModalOpen(false);
      setNewCatName('');
      toast('success', 'Category added');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to create category'),
  });

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expCategoryId || expAmountRupees === '') return;
    createExpenseMutation.mutate({
      title: expTitle.trim(),
      categoryId: Number(expCategoryId),
      amountPaise: Math.round(Number(expAmountRupees) * 100),
      expenseDate: expDate,
      paymentMode: expPaymentMode,
      vendor: expVendor.trim() || null,
    });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    createCategoryMutation.mutate({ name: newCatName.trim() });
  };

  const categories = categoriesData?.categories || [];
  const expenses = expensesData?.expenses || [];

  const revenue = plData?.revenuePaise ?? { memberships: 0, pt: 0, pos: 0, total: 0 };
  const expensesPaise = plData?.expensesPaise ?? { byCategory: [], total: 0 };
  const netProfitPaise = plData?.netProfitPaise ?? 0;
  const isProfitable = netProfitPaise >= 0;

  return (
    <AppShell
      breadcrumb={[{ label: 'Gym Console', href: '/dashboard' }, { label: 'Expenses' }]}
      title="Gym Expenses & P&L"
      description="Track facility rent, trainer payouts, equipment maintenance, and view net operating profit."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            size="sm"
            className="h-8 gap-1.5 text-xs"
          >
            <Tag className="w-3.5 h-3.5" />
            + Category
          </Button>
          <Button
            onClick={() => setIsExpenseModalOpen(true)}
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Expense
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

      {/* Date Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-(--surface) border border-(--border) rounded-xl">
        <div className="flex items-center gap-2 text-xs font-medium text-(--ink-2)">
          <Calendar className="w-4 h-4 text-(--iron)" />
          <span>Period:</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 text-xs w-36"
          />
          <span className="text-xs text-(--ink-3)">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 text-xs w-36"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-3.5 h-3.5 text-(--ink-3)" />
          <select
            value={selectedCategoryFilter}
            onChange={(e) =>
              setSelectedCategoryFilter(
                e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
              )
            }
            className="h-8 text-xs p-1 rounded-md border border-(--border) bg-(--bg) text-(--ink)"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Profit & Loss Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-(--border) bg-(--surface) shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-(--ink-3)">Total Collected Revenue</span>
            <h3 className="text-2xl font-bold text-(--ink) mt-1">
              {formatCurrency(revenue.total)}
            </h3>
            <span className="text-[11px] text-emerald-500 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" /> Memberships + POS
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl border border-(--border) bg-(--surface) shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-(--ink-3)">Operating Expenses</span>
            <h3 className="text-2xl font-bold text-red-500 mt-1">
              {formatCurrency(expensesPaise.total)}
            </h3>
            <span className="text-[11px] text-(--ink-3) flex items-center gap-1 mt-1">
              <TrendingDown className="w-3.5 h-3.5" /> Total Outflow
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl border border-(--border) bg-(--surface) shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-(--ink-3)">Net Operating Profit</span>
            <h3
              className={`text-2xl font-bold mt-1 ${
                isProfitable ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {formatCurrency(netProfitPaise)}
            </h3>
            <span className="text-[11px] text-(--ink-3) mt-1">
              {revenue.total > 0
                ? `${Math.round((netProfitPaise / revenue.total) * 100)}% Net Margin`
                : 'P&L Statement'}
            </span>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isProfitable ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
            }`}
          >
            <PieChart className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Expenses Log Table */}
      <div className="bg-(--surface) border border-(--border) rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-(--border) flex items-center justify-between">
          <h3 className="font-semibold text-sm text-(--ink)">Recorded Expense Ledger</h3>
          <span className="text-xs text-(--ink-3)">{expenses.length} records</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-(--bg) text-(--ink-3) border-b border-(--border)">
            <tr>
              <th className="p-3">Expense Title</th>
              <th className="p-3">Category</th>
              <th className="p-3">Vendor / Payee</th>
              <th className="p-3">Date</th>
              <th className="p-3">Mode</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border)">
            {loadingExpenses ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-(--ink-3)">
                  Loading expense logs...
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-(--ink-3)">
                  No expenses recorded in this period.
                </td>
              </tr>
            ) : (
              expenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-(--surface-hover)">
                  <td className="p-3 font-medium text-(--ink)">{exp.title}</td>
                  <td className="p-3">
                    <Badge variant="outline">{exp.categoryName || 'General'}</Badge>
                  </td>
                  <td className="p-3 text-(--ink-2)">{exp.vendor || '—'}</td>
                  <td className="p-3 text-(--ink-3)">{exp.expenseDate}</td>
                  <td className="p-3">
                    <span className="text-[11px] text-(--ink-2)">{exp.paymentMode}</span>
                  </td>
                  <td className="p-3 text-right font-bold text-red-500">
                    -{formatCurrency(exp.amountPaise)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => deleteExpenseMutation.mutate(exp.id)}
                      className="text-(--ink-4) hover:text-red-500 p-1 transition-colors"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* LOG EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-semibold text-(--ink)">Log Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Expense Title *</label>
                <Input
                  required
                  placeholder="e.g. Electricity Bill, Dumbbells repair, Cleaning supplies"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Category *</label>
                  <select
                    required
                    value={expCategoryId}
                    onChange={(e) => setExpCategoryId(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded-lg border border-(--border) bg-(--bg) text-sm text-(--ink) focus:outline-hidden"
                  >
                    <option value="">-- Choose --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Amount (₹) *</label>
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    placeholder="e.g. 2500"
                    value={expAmountRupees}
                    onChange={(e) => setExpAmountRupees(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Date *</label>
                  <Input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Payment Mode</label>
                  <select
                    value={expPaymentMode}
                    onChange={(e) => setExpPaymentMode(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg border border-(--border) bg-(--bg) text-sm text-(--ink) focus:outline-hidden"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-(--ink-2)">Vendor / Payee</label>
                <Input
                  placeholder="e.g. Tata Power, FitEquipment Ltd"
                  value={expVendor}
                  onChange={(e) => setExpVendor(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
                <Button type="button" variant="outline" onClick={() => setIsExpenseModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createExpenseMutation.isPending}>
                  {createExpenseMutation.isPending ? 'Saving...' : 'Record Expense'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-(--ink)">New Expense Category</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Category Name *</label>
                <Input
                  required
                  placeholder="e.g. Marketing, Equipment, Rent"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCategoryModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
};
