'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { DataGrid, type GridColumn } from '@/components/common/data-grid';
import { apiRequest } from '@/lib/api-client';
import { useDynamicStore, DynamicUser, DynamicRole } from '@/hooks/use-dynamic-store';
import { usePermissions } from '@/hooks/use-permissions';
import {
  SlidersHorizontal,
  Users,
  Shield,
  Layers,
  Package,
  Wrench,
  Car,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  UserPlus,
} from 'lucide-react';

type SetupTab = 'users' | 'roles' | 'categories' | 'vehicleTypes' | 'products' | 'garages' | 'parts';

const VALID_TABS: SetupTab[] = ['users', 'roles', 'categories', 'vehicleTypes', 'products', 'garages', 'parts'];

const SECTION_META: Record<SetupTab, { title: string; subtitle: string }> = {
  users: {
    title: 'Users',
    subtitle: 'Create multiple team members under the same or different roles and manage active accounts.',
  },
  roles: {
    title: 'Roles & Rights',
    subtitle: 'Configure custom roles and assign fine-grained permissions across portals.',
  },
  categories: {
    title: 'Policy Categories',
    subtitle: 'Manage top-level insurance categories and underwriting requirements.',
  },
  vehicleTypes: {
    title: 'Vehicle Types',
    subtitle: 'Configure vehicle classifications linked under each insurance category.',
  },
  products: {
    title: 'Policy Products',
    subtitle: 'Manage insurance plans, coverage ranges, add-ons, exclusions, and annual base rates.',
  },
  garages: {
    title: 'Repair Garages',
    subtitle: 'Maintain approved repair partner garages, cities, and hourly labor rates.',
  },
  parts: {
    title: 'Parts Catalog',
    subtitle: 'Maintain vehicle part master pricing for OEM and aftermarket reconciliation.',
  },
};

function MasterSetupContent() {
  const searchParams = useSearchParams();
  const { isSystemAdmin, bypassAllPermissions, hasPermission } = usePermissions();
  const {
    users,
    roles,
    garages,
    partsCatalog,
    addUser,
    updateUser,
    deleteUser,
    addRole,
    updateRole,
    deleteRole,
    addGarage,
    updateGarage,
    deleteGarage,
    addPart,
    updatePart,
    deletePart,
    refreshFromBackend,
  } = useDynamicStore();

  const isSuper = isSystemAdmin || bypassAllPermissions;
  const canUsers = isSuper || hasPermission('rbac:users_assign');
  const canRoles = isSuper || hasPermission('rbac:roles_create') || hasPermission('rbac:roles_update');
  const canCatalog = isSuper || hasPermission('products:manage');
  const canGarages = isSuper || hasPermission('garages:manage');
  const canParts = isSuper || hasPermission('parts:manage') || hasPermission('parts:update');

  const [tab, setTab] = useState<SetupTab>('users');

  useEffect(() => {
    const raw = searchParams.get('section') as SetupTab | null;
    if (raw && VALID_TABS.includes(raw)) {
      setTab(raw);
    } else if (!raw) {
      setTab('users');
    }
  }, [searchParams]);
  const [toast, setToast] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const [catRes, vtRes, prodRes] = await Promise.all([
      apiRequest<any[]>('GET', '/api/v1/policy-catalog/categories'),
      apiRequest<any[]>('GET', '/api/v1/policy-catalog/vehicle-types'),
      apiRequest<any[]>('GET', '/api/v1/policy-catalog/products'),
    ]);
    if (catRes.ok && catRes.data) setCategories(catRes.data);
    if (vtRes.ok && vtRes.data) setVehicleTypes(vtRes.data);
    if (prodRes.ok && prodRes.data) setProducts(prodRes.data);
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // ==========================================
  // USER MODAL STATE (supports creating multiple users with same role)
  // ==========================================
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<DynamicUser | null>(null);
  const [uName, setUName] = useState('');
  const [uUsername, setUUsername] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('OmniClaim@123');
  const [uRoleSlug, setURoleSlug] = useState('POLICYHOLDER');
  const [uActive, setUActive] = useState(true);
  const [uError, setUError] = useState<string | null>(null);

  const suggestUniqueUsername = (fullName: string, roleSlugVal: string) => {
    const rolePrefix = (roleSlugVal || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 10);
    const nameSlug = (fullName || 'member')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 18);
    const base = `${rolePrefix || 'user'}.${nameSlug || 'member'}`;
    let candidate = base;
    let attempt = 0;
    while (users.some((u) => u.username.toLowerCase() === candidate) && attempt < 25) {
      attempt += 1;
      candidate = `${base}.${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (users.some((u) => u.username.toLowerCase() === candidate)) {
      candidate = `${base}.${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return candidate;
  };

  const openAddUser = (presetRole?: string) => {
    const nextRole = presetRole || roles[0]?.slug || 'POLICYHOLDER';
    setEditingUser(null);
    setUName('');
    setUUsername(suggestUniqueUsername('', nextRole));
    setUEmail('');
    setUPassword('OmniClaim@123');
    setURoleSlug(nextRole);
    setUActive(true);
    setUError(null);
    setUserModal(true);
  };

  const openEditUser = (u: DynamicUser) => {
    setEditingUser(u);
    setUName(u.fullName);
    setUUsername(u.username);
    setUEmail(u.email);
    setUPassword('');
    setURoleSlug(u.roleSlug);
    setUActive(u.isActive);
    setUError(null);
    setUserModal(true);
  };

  const saveUser = (e: React.FormEvent, addAnotherSameRole = false) => {
    e.preventDefault();
    setUError(null);
    const rawUser = uUsername.trim().toLowerCase() || suggestUniqueUsername(uName, uRoleSlug);
    const cleanUser = users.some((u) => u.id !== editingUser?.id && u.username.toLowerCase() === rawUser)
      ? suggestUniqueUsername(uName || rawUser, uRoleSlug)
      : rawUser;
    const cleanEmail = uEmail.trim().toLowerCase();
    const duplicateEmail = users.find(
      (u) => u.id !== editingUser?.id && u.email.toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      setUError('A user with that email already exists.');
      return;
    }

    const matchedRole = roles.find((r) => r.slug === uRoleSlug);
    const initialPwd = editingUser ? uPassword : (uPassword.trim() || 'OmniClaim@123');
    const payload = {
      fullName: uName.trim(),
      username: cleanUser,
      email: cleanEmail,
      password: initialPwd,
      roleSlug: uRoleSlug,
      roleName: matchedRole?.name || uRoleSlug,
      isSuperAdmin: uRoleSlug === 'SUPER_ADMIN',
      isActive: uActive,
    };

    if (editingUser) {
      updateUser(editingUser.id, payload);
      notify(`Updated user ${payload.fullName} (${payload.roleName}).`);
      setUserModal(false);
    } else {
      addUser(payload);
      notify(
        `Created @${payload.username} (${payload.roleName}) with common initial password "${initialPwd}". User must change it after login.`
      );
      if (addAnotherSameRole) {
        setUName('');
        setUUsername(suggestUniqueUsername('', uRoleSlug));
        setUEmail('');
        setUPassword('OmniClaim@123');
      } else {
        setUserModal(false);
      }
    }
  };

  // ==========================================
  // ROLE MODAL STATE
  // ==========================================
  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<DynamicRole | null>(null);
  const [rName, setRName] = useState('');
  const [rSlug, setRSlug] = useState('');
  const [rDesc, setRDesc] = useState('');

  const openAddRole = () => {
    setEditingRole(null);
    setRName('');
    setRSlug('');
    setRDesc('');
    setRoleModal(true);
  };

  const openEditRole = (r: DynamicRole) => {
    setEditingRole(r);
    setRName(r.name);
    setRSlug(r.slug);
    setRDesc(r.description);
    setRoleModal(true);
  };

  const saveRole = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = (rSlug || rName).trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
    if (editingRole) {
      updateRole(editingRole.id, { name: rName.trim(), description: rDesc.trim() });
      notify(`Updated role "${rName}".`);
    } else {
      addRole({
        name: rName.trim(),
        slug: cleanSlug,
        description: rDesc.trim() || rName.trim(),
        isSystem: false,
        permissions: ['claims:read', 'policies:read'],
      });
      notify(`Created role "${rName}" (${cleanSlug}).`);
    }
    setRoleModal(false);
  };

  // ==========================================
  // CATEGORY MODAL STATE
  // ==========================================
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [cCode, setCCode] = useState('');
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cUnderwriting, setCUnderwriting] = useState(true);
  const [cSort, setCSort] = useState('10');

  const openAddCat = () => {
    setEditingCat(null);
    setCCode('');
    setCName('');
    setCDesc('');
    setCUnderwriting(true);
    setCSort(String(categories.length + 1));
    setCatModal(true);
  };

  const openEditCat = (c: any) => {
    setEditingCat(c);
    setCCode(c.code);
    setCName(c.name);
    setCDesc(c.description);
    setCUnderwriting(Boolean(c.requiresUnderwriting));
    setCSort(String(c.sortOrder ?? 1));
    setCatModal(true);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('POST', '/api/v1/policy-catalog/categories', {
      ...(editingCat ? { id: editingCat.id } : {}),
      code: cCode.trim().toUpperCase(),
      name: cName.trim(),
      description: cDesc.trim(),
      requiresUnderwriting: cUnderwriting,
      sortOrder: Number(cSort) || 1,
      isActive: true,
    });
    if (res.ok) {
      notify(editingCat ? `Updated category ${cName}.` : `Created category ${cName}.`);
      setCatModal(false);
      loadCatalog();
    } else {
      notify(res.error || 'Failed to save category.');
    }
  };

  // ==========================================
  // VEHICLE TYPE MODAL STATE
  // ==========================================
  const [vtModal, setVtModal] = useState(false);
  const [editingVt, setEditingVt] = useState<any | null>(null);
  const [vtCatCode, setVtCatCode] = useState('AUTO');
  const [vtCode, setVtCode] = useState('');
  const [vtName, setVtName] = useState('');
  const [vtDesc, setVtDesc] = useState('');
  const [vtSort, setVtSort] = useState('1');

  const openAddVt = () => {
    setEditingVt(null);
    setVtCatCode(categories[0]?.code || 'AUTO');
    setVtCode('');
    setVtName('');
    setVtDesc('');
    setVtSort(String(vehicleTypes.length + 1));
    setVtModal(true);
  };

  const openEditVt = (vt: any) => {
    setEditingVt(vt);
    setVtCatCode(vt.category?.code || 'AUTO');
    setVtCode(vt.code);
    setVtName(vt.name);
    setVtDesc(vt.description || '');
    setVtSort(String(vt.sortOrder ?? 1));
    setVtModal(true);
  };

  const saveVehicleType = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('POST', '/api/v1/policy-catalog/vehicle-types', {
      ...(editingVt ? { id: editingVt.id } : {}),
      categoryCode: vtCatCode,
      code: vtCode.trim().toUpperCase(),
      name: vtName.trim(),
      description: vtDesc.trim(),
      sortOrder: Number(vtSort) || 1,
      isActive: true,
    });
    if (res.ok) {
      notify(editingVt ? `Updated vehicle type ${vtName}.` : `Created vehicle type ${vtName}.`);
      setVtModal(false);
      loadCatalog();
    } else {
      notify(res.error || 'Failed to save vehicle type.');
    }
  };

  // ==========================================
  // PRODUCT MODAL STATE
  // ==========================================
  const [prodModal, setProdModal] = useState(false);
  const [editingProd, setEditingProd] = useState<any | null>(null);
  const [pCode, setPCode] = useState('');
  const [pCatCode, setPCatCode] = useState('AUTO');
  const [pVehicleTypeId, setPVehicleTypeId] = useState('');
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pRate, setPRate] = useState('950');
  const [pMinCov, setPMinCov] = useState('15000');
  const [pMaxCov, setPMaxCov] = useState('250000');
  const [pDeductible, setPDeductible] = useState('500');
  const [pAddons, setPAddons] = useState('Zero Depreciation, Roadside Assistance');
  const [pExclusions, setPExclusions] = useState('Intentional damage, Unlicensed driver');

  const openAddProd = () => {
    setEditingProd(null);
    setPCode(`PRD-PLAN-${Math.floor(100 + Math.random() * 900)}`);
    const defaultCat = categories[0]?.code || 'AUTO';
    setPCatCode(defaultCat);
    const matchingVt = vehicleTypes.find((v) => v.category?.code === defaultCat);
    setPVehicleTypeId(matchingVt?.id || '');
    setPName('');
    setPDesc('');
    setPRate('950');
    setPMinCov('15000');
    setPMaxCov('250000');
    setPDeductible('500');
    setPAddons('Zero Depreciation, Roadside Assistance');
    setPExclusions('Intentional damage, Unlicensed driver');
    setProdModal(true);
  };

  const openEditProd = (p: any) => {
    setEditingProd(p);
    setPCode(p.productCode);
    setPCatCode(p.category?.code || 'AUTO');
    setPVehicleTypeId(p.vehicleTypeId || '');
    setPName(p.name);
    setPDesc(p.description);
    setPRate(String(p.baseRateAnnual));
    setPMinCov(String(p.minCoverageAmount));
    setPMaxCov(String(p.maxCoverageAmount));
    setPDeductible(String(p.defaultDeductible));
    setPAddons(Array.isArray(p.addonsJson) ? p.addonsJson.join(', ') : '');
    setPExclusions(Array.isArray(p.exclusionsJson) ? p.exclusionsJson.join(', ') : '');
    setProdModal(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('POST', '/api/v1/policy-catalog/products', {
      ...(editingProd ? { id: editingProd.id } : {}),
      productCode: pCode.trim().toUpperCase(),
      categoryCode: pCatCode,
      ...(pVehicleTypeId ? { vehicleTypeId: pVehicleTypeId } : {}),
      name: pName.trim(),
      description: pDesc.trim(),
      baseRateAnnual: Number(pRate),
      minCoverageAmount: Number(pMinCov),
      maxCoverageAmount: Number(pMaxCov),
      defaultDeductible: Number(pDeductible),
      addonsJson: pAddons.split(',').map((s) => s.trim()).filter(Boolean),
      exclusionsJson: pExclusions.split(',').map((s) => s.trim()).filter(Boolean),
      isActive: true,
    });
    if (res.ok) {
      notify(editingProd ? `Updated product ${pName}.` : `Created product ${pName}.`);
      setProdModal(false);
      loadCatalog();
    } else {
      notify(res.error || 'Failed to save product.');
    }
  };

  // ==========================================
  // GARAGE & PART MODALS
  // ==========================================
  const [garageModal, setGarageModal] = useState(false);
  const [editingGarage, setEditingGarage] = useState<any | null>(null);
  const [gCode, setGCode] = useState('');
  const [gName, setGName] = useState('');
  const [gCity, setGCity] = useState('');
  const [gRate, setGRate] = useState('95');

  const saveGarage = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGarage) {
      updateGarage(editingGarage.id, {
        code: gCode.trim().toUpperCase(),
        name: gName.trim(),
        city: gCity.trim(),
        hourlyLaborRate: Number(gRate),
      });
      notify(`Updated garage ${gName}.`);
    } else {
      addGarage({
        code: gCode.trim().toUpperCase(),
        name: gName.trim(),
        city: gCity.trim(),
        hourlyLaborRate: Number(gRate),
        rating: 4.6,
        isPreferredNetwork: true,
        isBlacklisted: false,
      });
      notify(`Added garage ${gName}.`);
    }
    setGarageModal(false);
  };

  const [partModal, setPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any | null>(null);
  const [ptCode, setPtCode] = useState('');
  const [ptName, setPtName] = useState('');
  const [ptOem, setPtOem] = useState('450');
  const [ptAfter, setPtAfter] = useState('290');

  const savePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPart) {
      updatePart(editingPart.id, {
        partCode: ptCode.trim().toUpperCase(),
        partName: ptName.trim(),
        oemBasePrice: Number(ptOem),
        aftermarketPrice: Number(ptAfter),
      });
      notify(`Updated part ${ptName}.`);
    } else {
      addPart({
        partCode: ptCode.trim().toUpperCase(),
        partName: ptName.trim(),
        partType: 'BUMPER_FRONT',
        materialType: 'PLASTIC',
        oemBasePrice: Number(ptOem),
        aftermarketPrice: Number(ptAfter),
        defaultLaborHours: 2,
        laborRatePerHour: 90,
        isActive: true,
      });
      notify(`Added part ${ptName}.`);
    }
    setPartModal(false);
  };

  // ==========================================
  // GRID COLUMN DEFINITIONS
  // ==========================================
  const userCols: GridColumn<DynamicUser>[] = [
    {
      id: 'fullName',
      header: 'Full Name',
      accessor: (u) => u.fullName,
      cell: (u) => (
        <div>
          <div className="font-semibold text-foreground">{u.fullName}</div>
          <div className="text-[11px] font-mono text-muted-foreground">@{u.username}</div>
        </div>
      ),
    },
    { id: 'email', header: 'Email', accessor: (u) => u.email },
    {
      id: 'roleName',
      header: 'Assigned Role',
      accessor: (u) => u.roleName,
      cell: (u) => (
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
          {u.roleName}
        </span>
      ),
    },
    {
      id: 'isActive',
      header: 'Status',
      accessor: (u) => (u.isActive ? 'Active' : 'Inactive'),
      cell: (u) => (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            u.isActive
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
          }`}
        >
          {u.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const roleCols: GridColumn<DynamicRole>[] = [
    {
      id: 'name',
      header: 'Role Name',
      accessor: (r) => r.name,
      cell: (r) => (
        <div>
          <div className="font-bold text-foreground">{r.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground">{r.slug}</div>
        </div>
      ),
    },
    { id: 'description', header: 'Description', accessor: (r) => r.description },
    {
      id: 'userCount',
      header: 'Users',
      align: 'center',
      accessor: (r) => users.filter((u) => u.roleSlug === r.slug).length,
      cell: (r) => (
        <span className="font-mono font-bold text-primary">
          {users.filter((u) => u.roleSlug === r.slug).length}
        </span>
      ),
    },
    {
      id: 'permCount',
      header: 'Permissions',
      align: 'center',
      accessor: (r) => (r.permissions.includes('*') ? 999 : r.permissions.length),
      cell: (r) => (
        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold">
          {r.permissions.includes('*') ? 'All Rights' : `${r.permissions.length} Rights`}
        </span>
      ),
    },
  ];

  const catCols: GridColumn<any>[] = [
    {
      id: 'code',
      header: 'Code',
      accessor: (c) => c.code,
      cell: (c) => <span className="font-mono font-bold text-primary">{c.code}</span>,
    },
    { id: 'name', header: 'Category Name', accessor: (c) => c.name },
    { id: 'description', header: 'Description', accessor: (c) => c.description },
    {
      id: 'underwriting',
      header: 'Underwriting',
      accessor: (c) => (c.requiresUnderwriting ? 'Required' : 'Instant Issue'),
    },
    {
      id: 'products',
      header: 'Products',
      align: 'center',
      accessor: (c) => c.products?.length || 0,
    },
  ];

  const vtCols: GridColumn<any>[] = [
    {
      id: 'code',
      header: 'Code',
      accessor: (v) => v.code,
      cell: (v) => <span className="font-mono font-bold text-primary">{v.code}</span>,
    },
    { id: 'name', header: 'Vehicle Type', accessor: (v) => v.name },
    { id: 'category', header: 'Category', accessor: (v) => v.category?.name || v.category?.code || '—' },
    { id: 'description', header: 'Description', accessor: (v) => v.description || '—' },
    {
      id: 'products',
      header: 'Products',
      align: 'center',
      accessor: (v) => v._count?.products || 0,
    },
  ];

  const prodCols: GridColumn<any>[] = [
    {
      id: 'productCode',
      header: 'Code',
      accessor: (p) => p.productCode,
      cell: (p) => <span className="font-mono font-bold text-primary">{p.productCode}</span>,
    },
    { id: 'name', header: 'Product Name', accessor: (p) => p.name },
    { id: 'category', header: 'Category', accessor: (p) => p.category?.code || '—' },
    { id: 'vehicleType', header: 'Vehicle Type', accessor: (p) => p.vehicleType?.name || p.vehicleType?.code || 'All / N/A' },
    {
      id: 'baseRateAnnual',
      header: 'Annual Base Rate',
      align: 'right',
      accessor: (p) => Number(p.baseRateAnnual),
      cell: (p) => <span className="font-mono">${Number(p.baseRateAnnual).toLocaleString()}</span>,
    },
    {
      id: 'coverageRange',
      header: 'Coverage Range',
      accessor: (p) => `${p.minCoverageAmount} - ${p.maxCoverageAmount}`,
      cell: (p) => (
        <span className="font-mono text-xs">
          ${Number(p.minCoverageAmount).toLocaleString()} – ${Number(p.maxCoverageAmount).toLocaleString()}
        </span>
      ),
    },
  ];

  const garageCols: GridColumn<any>[] = [
    { id: 'code', header: 'Code', accessor: (g) => g.code },
    { id: 'name', header: 'Garage Name', accessor: (g) => g.name },
    { id: 'city', header: 'City', accessor: (g) => g.city },
    {
      id: 'hourlyLaborRate',
      header: 'Labor Rate / Hr',
      align: 'right',
      accessor: (g) => Number(g.hourlyLaborRate),
      cell: (g) => <span className="font-mono">${Number(g.hourlyLaborRate).toFixed(2)}</span>,
    },
    {
      id: 'preferred',
      header: 'Network',
      accessor: (g) => (g.isBlacklisted ? 'Blacklisted' : g.isPreferredNetwork ? 'Preferred' : 'Standard'),
    },
  ];

  const partCols: GridColumn<any>[] = [
    { id: 'partCode', header: 'Part Code', accessor: (p) => p.partCode },
    { id: 'partName', header: 'Part Name', accessor: (p) => p.partName },
    { id: 'materialType', header: 'Material', accessor: (p) => p.materialType },
    {
      id: 'oemBasePrice',
      header: 'OEM Price',
      align: 'right',
      accessor: (p) => Number(p.oemBasePrice),
      cell: (p) => <span className="font-mono">${Number(p.oemBasePrice).toFixed(2)}</span>,
    },
    {
      id: 'aftermarketPrice',
      header: 'Aftermarket',
      align: 'right',
      accessor: (p) => Number(p.aftermarketPrice),
      cell: (p) => <span className="font-mono">${Number(p.aftermarketPrice).toFixed(2)}</span>,
    },
  ];

  const activeMeta = SECTION_META[tab];

  return (
    <RequirePageAccess
      permission={[
        'rbac:users_assign',
        'rbac:roles_create',
        'rbac:roles_update',
        'products:manage',
        'garages:manage',
        'parts:manage',
        'parts:update',
        'superadmin:access',
      ]}
      title="Master Setup"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-6 w-6 text-primary" />
              <span>Master Setup › {activeMeta.title}</span>
            </h1>
            <p className="text-sm text-muted-foreground">{activeMeta.subtitle}</p>
          </div>
          {tab === 'users' && canUsers && (
            <button
              type="button"
              onClick={() => openAddUser()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" /> Add New User
            </button>
          )}
          {tab === 'roles' && canRoles && (
            <button
              type="button"
              onClick={openAddRole}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Custom Role
            </button>
          )}
          {tab === 'categories' && canCatalog && (
            <button
              type="button"
              onClick={openAddCat}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Policy Category
            </button>
          )}
          {tab === 'vehicleTypes' && canCatalog && (
            <button
              type="button"
              onClick={openAddVt}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Vehicle Type
            </button>
          )}
          {tab === 'products' && canCatalog && (
            <button
              type="button"
              onClick={openAddProd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Policy Product
            </button>
          )}
          {tab === 'garages' && canGarages && (
            <button
              type="button"
              onClick={() => {
                setEditingGarage(null);
                setGCode(`GRG-${Math.floor(100 + Math.random() * 900)}`);
                setGName('');
                setGCity('');
                setGRate('95');
                setGarageModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Garage
            </button>
          )}
          {tab === 'parts' && canParts && (
            <button
              type="button"
              onClick={() => {
                setEditingPart(null);
                setPtCode(`PRT-${Math.floor(100 + Math.random() * 900)}`);
                setPtName('');
                setPtOem('450');
                setPtAfter('290');
                setPartModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Part
            </button>
          )}
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {toast}
          </div>
        )}

        {/* DATA GRIDS */}
        {tab === 'users' && (
          <DataGrid
            data={users}
            columns={userCols}
            rowKey={(u) => u.id}
            pageSize={5}
            onRefresh={refreshFromBackend}
            title="All Users"
            subtitle="Create multiple users under the same or different roles"
            exportFileName="omniclaim-users"
            actions={(u) => [
              canUsers && {
                key: 'add-same-role',
                label: 'Add User w/ Same Role',
                icon: UserPlus,
                tone: 'primary' as const,
                onClick: () => openAddUser(u.roleSlug),
              },
              canUsers && {
                key: 'edit',
                label: 'Edit',
                icon: Edit2,
                onClick: () => openEditUser(u),
              },
              canUsers &&
                u.username !== 'superadmin' && {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  tone: 'danger' as const,
                  onClick: () => {
                    deleteUser(u.id);
                    notify(`Removed user ${u.fullName}.`);
                  },
                },
            ]}
          />
        )}

        {tab === 'roles' && (
          <DataGrid
            data={roles}
            columns={roleCols}
            rowKey={(r) => r.id}
            pageSize={5}
            onRefresh={refreshFromBackend}
            title="Roles & Access Levels"
            subtitle="Configure roles and assign fine-grained permissions"
            exportFileName="omniclaim-roles"
            actions={(r) => [
              canUsers && {
                key: 'add-user',
                label: 'Add User to Role',
                icon: UserPlus,
                tone: 'primary' as const,
                onClick: () => {
                  setTab('users');
                  openAddUser(r.slug);
                },
              },
              canRoles && {
                key: 'rights',
                label: 'Permissions',
                icon: KeyRound,
                onClick: () => {
                  window.location.href = `/admin/roles/${r.id}/rights`;
                },
              },
              canRoles && {
                key: 'edit',
                label: 'Edit',
                icon: Edit2,
                onClick: () => openEditRole(r),
              },
              canRoles &&
                !r.isSystem && {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  tone: 'danger' as const,
                  onClick: () => {
                    deleteRole(r.id);
                    notify(`Deleted role ${r.name}.`);
                  },
                },
            ]}
          />
        )}

        {tab === 'categories' && (
          <DataGrid
            data={categories}
            columns={catCols}
            rowKey={(c) => c.id}
            loading={catalogLoading}
            pageSize={5}
            onRefresh={loadCatalog}
            title="Policy Categories"
            subtitle="Insurance lines offered to customers"
            exportFileName="omniclaim-policy-categories"
            actions={(c) => [
              canCatalog && {
                key: 'edit',
                label: 'Edit',
                icon: Edit2,
                onClick: () => openEditCat(c),
              },
              canCatalog && {
                key: 'delete',
                label: 'Remove',
                icon: Trash2,
                tone: 'danger' as const,
                onClick: async () => {
                  const res = await apiRequest('DELETE', `/api/v1/policy-catalog/categories/${c.id}`);
                  if (res.ok) {
                    notify(`Removed/deactivated category ${c.name}.`);
                    loadCatalog();
                  } else {
                    notify(res.error || 'Failed to delete category.');
                  }
                },
              },
            ]}
          />
        )}

        {tab === 'vehicleTypes' && (
          <DataGrid
            data={vehicleTypes}
            columns={vtCols}
            rowKey={(v) => v.id}
            loading={catalogLoading}
            pageSize={5}
            onRefresh={loadCatalog}
            title="Configurable Vehicle Types"
            subtitle="Manage Car, Bike, Bus, Truck and custom vehicle classifications"
            exportFileName="omniclaim-vehicle-types"
            actions={(v) => [
              canCatalog && {
                key: 'edit',
                label: 'Edit',
                icon: Edit2,
                onClick: () => openEditVt(v),
              },
              canCatalog && {
                key: 'delete',
                label: 'Remove',
                icon: Trash2,
                tone: 'danger' as const,
                onClick: async () => {
                  const res = await apiRequest('DELETE', `/api/v1/policy-catalog/vehicle-types/${v.id}`);
                  if (res.ok) {
                    notify(`Removed/deactivated vehicle type ${v.name}.`);
                    loadCatalog();
                  } else {
                    notify(res.error || 'Failed to delete vehicle type.');
                  }
                },
              },
            ]}
          />
        )}

        {tab === 'products' && (
          <DataGrid
            data={products}
            columns={prodCols}
            rowKey={(p) => p.id}
            loading={catalogLoading}
            pageSize={5}
            onRefresh={loadCatalog}
            title="Policy Products & Plans"
            subtitle="Configure rates, coverage bounds, and deductibles"
            exportFileName="omniclaim-policy-products"
            actions={(p) => [
              canCatalog && {
                key: 'edit',
                label: 'Edit',
                icon: Edit2,
                onClick: () => openEditProd(p),
              },
              canCatalog && {
                key: 'delete',
                label: 'Remove',
                icon: Trash2,
                tone: 'danger' as const,
                onClick: async () => {
                  const res = await apiRequest('DELETE', `/api/v1/policy-catalog/products/${p.id}`);
                  if (res.ok) {
                    notify(`Removed/deactivated product ${p.name}.`);
                    loadCatalog();
                  } else {
                    notify(res.error || 'Failed to delete product.');
                  }
                },
              },
            ]}
          />
        )}

        {tab === 'garages' && (
          <DataGrid
            data={garages}
            columns={garageCols}
            rowKey={(g) => g.id}
            pageSize={5}
            onRefresh={refreshFromBackend}
            title="Approved Repair Garages"
            exportFileName="omniclaim-garages"
            actions={(g) => [
              canGarages && {
                key: 'edit',
                label: 'Edit',
                icon: Edit2,
                onClick: () => {
                  setEditingGarage(g);
                  setGCode(g.code);
                  setGName(g.name);
                  setGCity(g.city);
                  setGRate(String(g.hourlyLaborRate));
                  setGarageModal(true);
                },
              },
              canGarages && {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                tone: 'danger' as const,
                onClick: () => {
                  deleteGarage(g.id);
                  notify(`Deleted garage ${g.name}.`);
                },
              },
            ]}
          />
        )}

        {tab === 'parts' && (
          <DataGrid
            data={partsCatalog}
            columns={partCols}
            rowKey={(p) => p.id}
            pageSize={5}
            onRefresh={refreshFromBackend}
            title="Vehicle Parts Price Catalog"
            exportFileName="omniclaim-parts-catalog"
            actions={(p) => [
              canParts && {
                key: 'edit',
                label: 'Edit',
                icon: Edit2,
                onClick: () => {
                  setEditingPart(p);
                  setPtCode(p.partCode);
                  setPtName(p.partName);
                  setPtOem(String(p.oemBasePrice));
                  setPtAfter(String(p.aftermarketPrice));
                  setPartModal(true);
                },
              },
              canParts && {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                tone: 'danger' as const,
                onClick: () => {
                  deletePart(p.id);
                  notify(`Deleted part ${p.partName}.`);
                },
              },
            ]}
          />
        )}

        {/* USER CREATE/EDIT MODAL */}
        {userModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form
              onSubmit={(e) => saveUser(e, false)}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold">{editingUser ? 'Edit User' : 'Create New User'}</h3>
                <button type="button" onClick={() => setUserModal(false)} className="text-xs text-muted-foreground">
                  Close
                </button>
              </div>
              {uError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                  {uError}
                </div>
              )}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Full Name</label>
                  <input
                    required
                    value={uName}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setUName(nextName);
                      if (!editingUser) {
                        setUUsername(suggestUniqueUsername(nextName, uRoleSlug));
                      }
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Unique Username</label>
                    <input
                      required
                      value={uUsername}
                      onChange={(e) => setUUsername(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Email</label>
                    <input required type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Role (multiple users can share a role)</label>
                  <select
                    value={uRoleSlug}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setURoleSlug(nextRole);
                      if (!editingUser) {
                        setUUsername(suggestUniqueUsername(uName, nextRole));
                      }
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.slug}>
                        {r.name} ({r.slug})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    {editingUser ? 'New Password (leave blank to keep current)' : 'Common Initial Password (user changes after login)'}
                  </label>
                  <input
                    type={editingUser ? 'password' : 'text'}
                    required={!editingUser}
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                  />
                </div>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={uActive} onChange={(e) => setUActive(e.target.checked)} />
                  Active Account
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button type="button" onClick={() => setUserModal(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">
                  Cancel
                </button>
                {!editingUser && (
                  <button
                    type="button"
                    onClick={(e) => saveUser(e as any, true)}
                    className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20"
                  >
                    Save &amp; Add Another ({uRoleSlug})
                  </button>
                )}
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ROLE MODAL */}
        {roleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form onSubmit={saveRole} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-xs">
              <h3 className="text-base font-bold">{editingRole ? 'Edit Role' : 'Create Custom Role'}</h3>
              <div>
                <label className="block font-semibold mb-1">Role Name</label>
                <input required value={rName} onChange={(e) => setRName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              {!editingRole && (
                <div>
                  <label className="block font-semibold mb-1">Role Slug (optional, auto-generated)</label>
                  <input value={rSlug} onChange={(e) => setRSlug(e.target.value)} placeholder="e.g. REGIONAL_UNDERWRITER" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
                </div>
              )}
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea rows={2} value={rDesc} onChange={(e) => setRDesc(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRoleModal(false)} className="rounded-lg border border-border px-3 py-2 font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save Role</button>
              </div>
            </form>
          </div>
        )}

        {/* CATEGORY MODAL */}
        {catModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form onSubmit={saveCategory} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-xs">
              <h3 className="text-base font-bold">{editingCat ? 'Edit Policy Category' : 'Add Policy Category'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Code</label>
                  <input required disabled={Boolean(editingCat)} value={cCode} onChange={(e) => setCCode(e.target.value)} placeholder="CYBER" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Display Order</label>
                  <input type="number" value={cSort} onChange={(e) => setCSort(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Category Name</label>
                <input required value={cName} onChange={(e) => setCName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea required rows={2} value={cDesc} onChange={(e) => setCDesc(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={cUnderwriting} onChange={(e) => setCUnderwriting(e.target.checked)} />
                Requires Underwriting Review
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCatModal(false)} className="rounded-lg border border-border px-3 py-2 font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save Category</button>
              </div>
            </form>
          </div>
        )}

        {/* VEHICLE TYPE MODAL */}
        {vtModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form onSubmit={saveVehicleType} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-xs">
              <h3 className="text-base font-bold">{editingVt ? 'Edit Vehicle Type' : 'Add Vehicle Type'}</h3>
              <div>
                <label className="block font-semibold mb-1">Insurance Category</label>
                <select value={vtCatCode} onChange={(e) => setVtCatCode(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                  {categories.map((c) => (
                    <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Code</label>
                  <input required disabled={Boolean(editingVt)} value={vtCode} onChange={(e) => setVtCode(e.target.value)} placeholder="TRUCK" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Sort Order</label>
                  <input type="number" value={vtSort} onChange={(e) => setVtSort(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Vehicle Type Name</label>
                <input required value={vtName} onChange={(e) => setVtName(e.target.value)} placeholder="Commercial Pickup / Truck" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea rows={2} value={vtDesc} onChange={(e) => setVtDesc(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setVtModal(false)} className="rounded-lg border border-border px-3 py-2 font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save Vehicle Type</button>
              </div>
            </form>
          </div>
        )}

        {/* PRODUCT MODAL */}
        {prodModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form onSubmit={saveProduct} className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-xs">
              <h3 className="text-base font-bold">{editingProd ? 'Edit Policy Product' : 'Add Policy Product'}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Product Code</label>
                  <input required disabled={Boolean(editingProd)} value={pCode} onChange={(e) => setPCode(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category</label>
                  <select
                    value={pCatCode}
                    onChange={(e) => {
                      setPCatCode(e.target.value);
                      const firstMatch = vehicleTypes.find((v) => v.category?.code === e.target.value);
                      setPVehicleTypeId(firstMatch?.id || '');
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Vehicle Type</label>
                  <select value={pVehicleTypeId} onChange={(e) => setPVehicleTypeId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    <option value="">All / Not Applicable</option>
                    {vehicleTypes
                      .filter((v) => v.category?.code === pCatCode)
                      .map((v) => (
                        <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Product Name</label>
                <input required value={pName} onChange={(e) => setPName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea required rows={2} value={pDesc} onChange={(e) => setPDesc(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className="block font-semibold mb-1">Annual Rate ($)</label>
                  <input required type="number" value={pRate} onChange={(e) => setPRate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Min Cover ($)</label>
                  <input required type="number" value={pMinCov} onChange={(e) => setPMinCov(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Max Cover ($)</label>
                  <input required type="number" value={pMaxCov} onChange={(e) => setPMaxCov(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Deductible ($)</label>
                  <input required type="number" value={pDeductible} onChange={(e) => setPDeductible(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Add-ons (comma-separated)</label>
                  <input value={pAddons} onChange={(e) => setPAddons(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Exclusions (comma-separated)</label>
                  <input value={pExclusions} onChange={(e) => setPExclusions(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setProdModal(false)} className="rounded-lg border border-border px-3 py-2 font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save Product</button>
              </div>
            </form>
          </div>
        )}

        {/* GARAGE MODAL */}
        {garageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form onSubmit={saveGarage} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-xs">
              <h3 className="text-base font-bold">{editingGarage ? 'Edit Garage' : 'Add Repair Garage'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Code</label>
                  <input required value={gCode} onChange={(e) => setGCode(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hourly Labor ($)</label>
                  <input required type="number" value={gRate} onChange={(e) => setGRate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Garage Name</label>
                <input required value={gName} onChange={(e) => setGName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">City</label>
                <input required value={gCity} onChange={(e) => setGCity(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setGarageModal(false)} className="rounded-lg border border-border px-3 py-2 font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save Garage</button>
              </div>
            </form>
          </div>
        )}

        {/* PART MODAL */}
        {partModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form onSubmit={savePart} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-xs">
              <h3 className="text-base font-bold">{editingPart ? 'Edit Part' : 'Add Vehicle Part'}</h3>
              <div>
                <label className="block font-semibold mb-1">Part Code</label>
                <input required value={ptCode} onChange={(e) => setPtCode(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Part Name</label>
                <input required value={ptName} onChange={(e) => setPtName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">OEM Price ($)</label>
                  <input required type="number" value={ptOem} onChange={(e) => setPtOem(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Aftermarket ($)</label>
                  <input required type="number" value={ptAfter} onChange={(e) => setPtAfter(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPartModal(false)} className="rounded-lg border border-border px-3 py-2 font-semibold">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Save Part</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </RequirePageAccess>
  );
}

export default function MasterSetupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading Master Setup...</div>}>
      <MasterSetupContent />
    </Suspense>
  );
}
