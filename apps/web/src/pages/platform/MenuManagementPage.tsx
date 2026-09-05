import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Plus, Pencil, Trash2, Loader2, Settings, Menu, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { GYM_FEATURES } from '@gymtech/shared';

interface MenuGroup {
  id: number;
  key: string;
  label: string;
  icon: string;
  order: number;
  isActive: boolean;
}

interface MenuItem {
  id: number;
  groupKey: string;
  key: string;
  label: string;
  href: string | null;
  icon: string | null;
  order: number;
  permissions: string[];
  featureKey: string | null;
  adminOnly: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---- Group Form ----
interface GroupFormData { key: string; label: string; icon: string; order: number }

const ICON_OPTIONS = [
  'LayoutDashboard', 'Users', 'CalendarCheck', 'CreditCard', 'Trophy',
  'Tag', 'BarChart3', 'Settings', 'UserCog', 'Bell', 'Shield',
  'Folder', 'Menu', 'Home', 'FileText', 'Key', 'Sliders',
];

// ---- Item Form ----
interface ItemFormData {
  groupKey: string; key: string; label: string; href: string;
  icon: string; order: number; permissions: string[]; featureKey: string; adminOnly: boolean;
}

// Cast to any when sending since optional fields may be empty string
type ItemFormDataForApi = Omit<ItemFormData, 'href' | 'featureKey'> & {
  href?: string; featureKey?: string;
};

export const MenuManagementPage: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ---- State ----
  const [activeTab, setActiveTab] = useState<'groups' | 'items'>('groups');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Group dialog
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MenuGroup | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormData>({ key: '', label: '', icon: 'Folder', order: 0 });
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<MenuGroup | null>(null);
  const [restoreGroupTarget, setRestoreGroupTarget] = useState<MenuGroup | null>(null);

  // Item dialog
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>({
    groupKey: '', key: '', label: '', href: '', icon: '', order: 0, permissions: [], featureKey: '', adminOnly: false,
  });
  const [deleteItemTarget, setDeleteItemTarget] = useState<MenuItem | null>(null);
  const [restoreItemTarget, setRestoreItemTarget] = useState<MenuItem | null>(null);

  // ---- Queries ----
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['menu-groups'],
    queryFn: () => api.getMenuGroups(),
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items', groupFilter],
    queryFn: () => api.getMenuItems(groupFilter !== 'all' ? { groupKey: groupFilter } : {}),
  });

  const groups: MenuGroup[] = groupsData?.groups ?? [];
  const items: MenuItem[] = itemsData?.items ?? [];

  // ---- Group Mutations ----
  const createGroupMutation = useMutation({
    mutationFn: (data: GroupFormData) => api.createMenuGroup(data),
    onSuccess: () => { toast('success', 'Group created'); qc.invalidateQueries({ queryKey: ['menu-groups'] }); setGroupFormOpen(false); },
    onError: () => toast('error', 'Failed to create group'),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GroupFormData> }) => api.updateMenuGroup(id, data),
    onSuccess: () => { toast('success', 'Group updated'); qc.invalidateQueries({ queryKey: ['menu-groups'] }); setGroupFormOpen(false); },
    onError: () => toast('error', 'Failed to update group'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => api.deleteMenuGroup(id),
    onSuccess: () => { toast('success', 'Group deleted'); qc.invalidateQueries({ queryKey: ['menu-groups'] }); setDeleteGroupTarget(null); },
    onError: () => toast('error', 'Failed to delete group'),
  });

  const restoreGroupMutation = useMutation({
    mutationFn: (id: number) => api.restoreMenuGroup(id),
    onSuccess: () => { toast('success', 'Group restored'); qc.invalidateQueries({ queryKey: ['menu-groups'] }); setRestoreGroupTarget(null); },
    onError: () => toast('error', 'Failed to restore group'),
  });

  // ---- Item Mutations ----
  const createItemMutation = useMutation({
    mutationFn: (data: ItemFormData) => api.createMenuItem(data),
    onSuccess: () => { toast('success', 'Menu item created'); qc.invalidateQueries({ queryKey: ['menu-items'] }); setItemFormOpen(false); },
    onError: () => toast('error', 'Failed to create item'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ItemFormData> }) => api.updateMenuItem(id, data as any),
    onSuccess: () => { toast('success', 'Menu item updated'); qc.invalidateQueries({ queryKey: ['menu-items'] }); setItemFormOpen(false); },
    onError: () => toast('error', 'Failed to update item'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => api.deleteMenuItem(id),
    onSuccess: () => { toast('success', 'Menu item deleted'); qc.invalidateQueries({ queryKey: ['menu-items'] }); setDeleteItemTarget(null); },
    onError: () => toast('error', 'Failed to delete item'),
  });

  const restoreItemMutation = useMutation({
    mutationFn: (id: number) => api.restoreMenuItem(id),
    onSuccess: () => { toast('success', 'Menu item restored'); qc.invalidateQueries({ queryKey: ['menu-items'] }); setRestoreItemTarget(null); },
    onError: () => toast('error', 'Failed to restore item'),
  });

  // ---- Helpers ----
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ key: '', label: '', icon: 'Folder', order: 0 });
    setGroupFormOpen(true);
  };

  const openEditGroup = (g: MenuGroup) => {
    setEditingGroup(g);
    setGroupForm({ key: g.key, label: g.label, icon: g.icon, order: g.order });
    setGroupFormOpen(true);
  };

  const handleSaveGroup = () => {
    if (!groupForm.label.trim()) { toast('error', 'Label is required'); return; }
    if (!groupForm.key.trim()) { toast('error', 'Key is required'); return; }
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data: groupForm });
    } else {
      createGroupMutation.mutate(groupForm);
    }
  };

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({ groupKey: groupFilter !== 'all' ? groupFilter : '', key: '', label: '', href: '', icon: '', order: 0, permissions: [], featureKey: '', adminOnly: false });
    setItemFormOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      groupKey: item.groupKey, key: item.key, label: item.label,
      href: item.href ?? '', icon: item.icon ?? '', order: item.order,
      permissions: item.permissions, featureKey: item.featureKey ?? '', adminOnly: item.adminOnly,
    });
    setItemFormOpen(true);
  };

  const handleSaveItem = () => {
    if (!itemForm.groupKey) { toast('error', 'Group is required'); return; }
    if (!itemForm.label.trim()) { toast('error', 'Label is required'); return; }
    if (!itemForm.key.trim()) { toast('error', 'Key is required'); return; }
    const payload = {
      ...itemForm,
      href: itemForm.href || undefined,
      featureKey: itemForm.featureKey || undefined,
    };
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: payload as any });
    } else {
      createItemMutation.mutate(payload as any);
    }
  };

  const togglePerm = (perm: string) => {
    setItemForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter((p) => p !== perm) : [...f.permissions, perm],
    }));
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (groupFilter !== 'all' && item.groupKey !== groupFilter) return false;
      if (search && !item.label.toLowerCase().includes(search.toLowerCase()) && !item.key.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, groupFilter, search]);

  const groupLabel = (key: string) => groups.find((g) => g.key === key)?.label ?? key;

  return (
    <AdminShell title="Menu Management">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'groups' | 'items')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="groups">
              <FolderTree className="h-4 w-4 mr-1.5" /> Groups
            </TabsTrigger>
            <TabsTrigger value="items">
              <Menu className="h-4 w-4 mr-1.5" /> Items
            </TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={activeTab === 'groups' ? openCreateGroup : openCreateItem}>
            <Plus className="h-4 w-4 mr-1" /> New {activeTab === 'groups' ? 'Group' : 'Item'}
          </Button>
        </div>

        {/* ---- GROUPS TAB ---- */}
        <TabsContent value="groups">
          <Card>
            <CardContent className="p-0">
              {groupsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : groups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No menu groups yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Icon</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...groups].sort((a, b) => a.order - b.order).map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-mono text-xs w-12">{g.order}</TableCell>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{g.key}</code></TableCell>
                        <TableCell className="font-medium text-sm">{g.label}</TableCell>
                        <TableCell>{g.icon}</TableCell>
                        <TableCell>
                          {g.isActive
                            ? <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Active</Badge>
                            : <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!g.isActive && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Restore" onClick={() => setRestoreGroupTarget(g)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGroup(g)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteGroupTarget(g)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- ITEMS TAB ---- */}
        <TabsContent value="items">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
            <select
              className="h-9 rounded border border-border bg-background px-3 text-sm"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">All groups</option>
              {groups.map((g) => <option key={g.id} value={g.key}>{g.label}</option>)}
            </select>
          </div>
          <Card>
            <CardContent className="p-0">
              {itemsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No menu items found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Href</TableHead>
                      <TableHead>Feature</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...filteredItems].sort((a, b) => a.order - b.order).map((item) => (
                      <TableRow key={item.id} className={cn(!item.isActive && 'opacity-50')}>
                        <TableCell className="font-mono text-xs w-12">{item.order}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="secondary" className="text-[10px]">{groupLabel(item.groupKey)}</Badge>
                        </TableCell>
                        <TableCell><code className="text-xs bg-muted px-1 py-0.5 rounded">{item.key}</code></TableCell>
                        <TableCell className="font-medium text-sm">{item.label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{item.href ?? '—'}</TableCell>
                        <TableCell className="text-xs">{item.featureKey ? <code>{item.featureKey}</code> : '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-0.5">
                            {item.permissions.slice(0, 2).map((p) => (
                              <Badge key={p} variant="secondary" className="text-[9px] px-1 py-0">{p}</Badge>
                            ))}
                            {item.permissions.length > 2 && <Badge variant="secondary" className="text-[9px] px-1 py-0">+{item.permissions.length - 2}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{item.adminOnly ? <Badge variant="destructive" className="text-[10px]">Yes</Badge> : '—'}</TableCell>
                        <TableCell>
                          {item.isActive
                            ? <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Active</Badge>
                            : <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!item.isActive && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Restore" onClick={() => setRestoreItemTarget(item)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItemTarget(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- GROUP FORM DIALOG ---- */}
      <Dialog open={groupFormOpen} onOpenChange={setGroupFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Menu Group' : 'New Menu Group'}</DialogTitle>
            <DialogDescription>Groups are top-level containers shown in the sidebar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Key *</Label>
                <Input value={groupForm.key} onChange={(e) => setGroupForm((f) => ({ ...f, key: e.target.value.replace(/\s/g, '_').toLowerCase() }))} placeholder="e.g. reports" disabled={!!editingGroup} />
              </div>
              <div className="space-y-1.5">
                <Label>Order</Label>
                <Input type="number" value={groupForm.order} onChange={(e) => setGroupForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Label *</Label>
              <Input value={groupForm.label} onChange={(e) => setGroupForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Reports" />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <select className="h-9 w-full rounded border border-border bg-background px-3 text-sm" value={groupForm.icon} onChange={(e) => setGroupForm((f) => ({ ...f, icon: e.target.value }))}>
                {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={createGroupMutation.isPending || updateGroupMutation.isPending}>
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- ITEM FORM DIALOG ---- */}
      <Dialog open={itemFormOpen} onOpenChange={setItemFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
            <DialogDescription>Items are individual sidebar links shown under a group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Group *</Label>
                <select className="h-9 w-full rounded border border-border bg-background px-3 text-sm" value={itemForm.groupKey} onChange={(e) => setItemForm((f) => ({ ...f, groupKey: e.target.value }))}>
                  <option value="">Select group...</option>
                  {groups.map((g) => <option key={g.id} value={g.key}>{g.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Order</Label>
                <Input type="number" value={itemForm.order} onChange={(e) => setItemForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Key *</Label>
                <Input value={itemForm.key} onChange={(e) => setItemForm((f) => ({ ...f, key: e.target.value.replace(/\s/g, '_').toLowerCase() }))} placeholder="e.g. revenue_report" disabled={!!editingItem} />
              </div>
              <div className="space-y-1.5">
                <Label>Label *</Label>
                <Input value={itemForm.label} onChange={(e) => setItemForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Revenue Report" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Href</Label>
              <Input value={itemForm.href} onChange={(e) => setItemForm((f) => ({ ...f, href: e.target.value }))} placeholder="/reports/revenue" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <Input value={itemForm.icon} onChange={(e) => setItemForm((f) => ({ ...f, icon: e.target.value }))} placeholder="BarChart3" />
              </div>
              <div className="space-y-1.5">
                <Label>Feature Key</Label>
                <Input value={itemForm.featureKey} onChange={(e) => setItemForm((f) => ({ ...f, featureKey: e.target.value }))} placeholder="reports" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="admin-only" checked={itemForm.adminOnly} onChange={(e) => setItemForm((f) => ({ ...f, adminOnly: e.target.checked }))} className="accent-primary" />
              <Label htmlFor="admin-only" className="text-sm cursor-pointer">Admin only (hide from regular staff)</Label>
            </div>
            <div className="space-y-2">
              <Label>Required Permissions</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {GYM_FEATURES.map((feat) => (
                  <div key={feat} className="flex items-center gap-2 p-1.5 rounded border border-border">
                    <input type="checkbox" id={`feat-${feat}`} checked={itemForm.permissions.includes(feat)} onChange={() => togglePerm(feat)} className="accent-primary" />
                    <Label htmlFor={`feat-${feat}`} className="text-xs cursor-pointer flex-1">{feat}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveItem} disabled={createItemMutation.isPending || updateItemMutation.isPending}>
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirm */}
      <ConfirmDialog
        open={!!deleteGroupTarget}
        onOpenChange={() => setDeleteGroupTarget(null)}
        title="Delete Group"
        description={`Delete group "${deleteGroupTarget?.label}"? Items in this group will be hidden.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteGroupTarget) deleteGroupMutation.mutate(deleteGroupTarget.id); }}
        destructive
      />

      {/* Delete Item Confirm */}
      <ConfirmDialog
        open={!!deleteItemTarget}
        onOpenChange={() => setDeleteItemTarget(null)}
        title="Delete Menu Item"
        description={`Delete item "${deleteItemTarget?.label}"? It will be hidden from the sidebar.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteItemTarget) deleteItemMutation.mutate(deleteItemTarget.id); }}
        destructive
      />

      {/* Restore Group Confirm */}
      <ConfirmDialog
        open={!!restoreGroupTarget}
        onOpenChange={() => setRestoreGroupTarget(null)}
        title="Restore Group"
        description={`Restore "${restoreGroupTarget?.label}" and make it visible in the sidebar?`}
        confirmLabel="Restore"
        onConfirm={() => { if (restoreGroupTarget) restoreGroupMutation.mutate(restoreGroupTarget.id); }}
      />

      {/* Restore Item Confirm */}
      <ConfirmDialog
        open={!!restoreItemTarget}
        onOpenChange={() => setRestoreItemTarget(null)}
        title="Restore Menu Item"
        description={`Restore "${restoreItemTarget?.label}" and make it visible in the sidebar?`}
        confirmLabel="Restore"
        onConfirm={() => { if (restoreItemTarget) restoreItemMutation.mutate(restoreItemTarget.id); }}
      />
    </AdminShell>
  );
};
