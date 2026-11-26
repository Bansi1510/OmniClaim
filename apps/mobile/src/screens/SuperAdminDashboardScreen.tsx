import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { ClaimStatus } from '@omniclaim/shared-types';
import { useMobileStore } from '../services/mobile-store';

type MobileAdminTab = 'claims' | 'users' | 'security' | 'masters';

interface SuperAdminDashboardScreenProps {
  onOpenCamera: () => void;
  onOpenTracker: () => void;
}

export function SuperAdminDashboardScreen({
  onOpenCamera,
  onOpenTracker,
}: SuperAdminDashboardScreenProps) {
  const store = useMobileStore();
  const [activeTab, setActiveTab] = useState<MobileAdminTab>('claims');
  const [notice, setNotice] = useState<string | null>(null);

  // Add Claim Form
  const [newClaimVehicle, setNewClaimVehicle] = useState('');
  const [newClaimPayout, setNewClaimPayout] = useState('650');

  // Add User Form
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRoleSlug, setNewRoleSlug] = useState('CLAIMS_ADJUSTER');

  // Master Password Form
  const [masterPwdInput, setMasterPwdInput] = useState(store.superMasterPassword);

  // Add Policy / Garage / Rule
  const [newPolicyHolder, setNewPolicyHolder] = useState('');
  const [newGarageName, setNewGarageName] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleThreshold, setNewRuleThreshold] = useState('800');

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2800);
  };

  const handleCreateClaim = () => {
    if (!newClaimVehicle.trim()) return;
    const claimNumber = `CLM-202611-${Math.floor(1000 + Math.random() * 9000)}`;
    store.addClaim({
      claimNumber,
      policyNumber: store.policies[0]?.policyNumber || 'POL-OMNI-2026-9081',
      vehicle: newClaimVehicle.trim(),
      status: 'TRIAGE_PENDING',
      netPayout: Number(newClaimPayout) || 500,
      fraudScore: 10,
    });
    setNewClaimVehicle('');
    notify(`Created ${claimNumber}`);
  };

  const cycleClaimStatus = (id: string, current: ClaimStatus) => {
    const order: ClaimStatus[] = ['TRIAGE_PENDING', 'MANUAL_REVIEW', 'APPROVED', 'SETTLED', 'REJECTED'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    store.updateClaim(id, { status: next });
    notify(`Force-updated status → ${next}`);
  };

  const handleCreateUser = () => {
    if (!newUsername.trim() || !newFullName.trim()) return;
    store.addUser({
      username: newUsername.toLowerCase().trim(),
      email: `${newUsername.toLowerCase().trim()}@omniclaim.internal`,
      fullName: newFullName.trim(),
      password: 'AdminOmniClaim2026!',
      roleSlug: newRoleSlug,
      permissions: newRoleSlug === 'SUPER_ADMIN' ? ['*'] : ['claims:read', 'claims:create'],
      isActive: true,
      isSuperAdmin: newRoleSlug === 'SUPER_ADMIN',
    });
    setNewUsername('');
    setNewFullName('');
    notify(`Added user @${newUsername.toLowerCase().trim()}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.godBadge}>👑 SUPER ADMIN GOD MODE</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={store.logout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Mobile Super Admin Dashboard</Text>
        <Text style={styles.heroSubtitle}>
          Skips ALL permission checks · Signed in as @{store.session?.username} ({store.session?.roleSlug})
        </Text>

        {/* Direct All-Access Shortcuts */}
        <View style={styles.shortcutRow}>
          <TouchableOpacity style={styles.shortcutBtn} onPress={onOpenCamera}>
            <Text style={styles.shortcutBtnText}>📷 AR Inspection Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutBtn} onPress={onOpenTracker}>
            <Text style={styles.shortcutBtnText}>⚡ Live Payout Tracker</Text>
          </TouchableOpacity>
        </View>
      </View>

      {notice && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>✔ {notice}</Text>
        </View>
      )}

      {/* KPI Strip */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>CLAIMS</Text>
          <Text style={styles.kpiVal}>{store.claims.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>USERS</Text>
          <Text style={styles.kpiVal}>{store.users.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>POLICIES</Text>
          <Text style={styles.kpiVal}>{store.policies.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>MASTER PWD</Text>
          <Text style={[styles.kpiVal, { color: store.superMasterPasswordEnabled ? '#fbbf24' : '#fb7185' }]}>
            {store.superMasterPasswordEnabled ? 'ON' : 'OFF'}
          </Text>
        </View>
      </View>

      {/* Dynamic CRUD Segment Tabs */}
      <View style={styles.tabRow}>
        {(
          [
            { id: 'claims', label: 'Claims CRUD' },
            { id: 'users', label: 'Users CRUD' },
            { id: 'security', label: 'Master Key' },
            { id: 'masters', label: 'Policies/Rules' },
          ] as Array<{ id: MobileAdminTab; label: string }>
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setActiveTab(t.id)}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TAB 1: CLAIMS DYNAMIC CRUD */}
      {activeTab === 'claims' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dynamic Claims CRUD &amp; Force Status Override</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Vehicle (e.g. 2025 Tesla Model 3)"
              placeholderTextColor="#64748b"
              value={newClaimVehicle}
              onChangeText={setNewClaimVehicle}
            />
            <TextInput
              style={styles.input}
              placeholder="Net Payout ($)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={newClaimPayout}
              onChangeText={setNewClaimPayout}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateClaim}>
              <Text style={styles.primaryBtnText}>+ Add New Claim</Text>
            </TouchableOpacity>
          </View>

          {store.claims.map((c) => (
            <View key={c.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemCode}>{c.claimNumber}</Text>
                <Text style={styles.statusBadge}>{c.status}</Text>
              </View>
              <Text style={styles.itemSub}>
                {c.vehicle} · Payout: ${c.netPayout} · Fraud: {c.fraudScore}/100
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.amberBtn}
                  onPress={() => cycleClaimStatus(c.id, c.status)}
                >
                  <Text style={styles.amberBtnText}>Force Next Status</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={() => {
                    store.deleteClaim(c.id);
                    notify(`Deleted ${c.claimNumber}`);
                  }}
                >
                  <Text style={styles.dangerBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* TAB 2: USERS CRUD & ONE-TAP IMPERSONATION */}
      {activeTab === 'users' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dynamic Users CRUD &amp; Impersonation</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Username (e.g. priya.patel)"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              value={newUsername}
              onChangeText={setNewUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#64748b"
              value={newFullName}
              onChangeText={setNewFullName}
            />
            <View style={styles.rolePillRow}>
              {['SUPER_ADMIN', 'CLAIMS_ADJUSTER', 'SIU_INVESTIGATOR', 'POLICYHOLDER'].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setNewRoleSlug(r)}
                  style={[styles.rolePill, newRoleSlug === r && styles.rolePillActive]}
                >
                  <Text style={styles.rolePillText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateUser}>
              <Text style={styles.primaryBtnText}>+ Create System User</Text>
            </TouchableOpacity>
          </View>

          {store.users.map((u) => (
            <View key={u.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemCode}>
                  {u.fullName} {u.isSuperAdmin ? '👑' : ''}
                </Text>
                <Text style={styles.statusBadge}>{u.roleSlug}</Text>
              </View>
              <Text style={styles.itemSub}>@{u.username} · {u.email}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.amberBtn}
                  onPress={() => {
                    store.impersonateUser(u.id, true);
                    notify(`Entered as @${u.username} (God Mode)`);
                  }}
                >
                  <Text style={styles.amberBtnText}>Login As</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    store.updateUser(u.id, { isSuperAdmin: !u.isSuperAdmin });
                    notify(`Toggled Super Admin for @${u.username}`);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>
                    {u.isSuperAdmin ? 'Revoke Super' : 'Make Super'}
                  </Text>
                </TouchableOpacity>
                {u.username !== 'superadmin' && (
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={() => {
                      store.deleteUser(u.id);
                      notify(`Deleted @${u.username}`);
                    }}
                  >
                    <Text style={styles.dangerBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* TAB 3: SUPER MASTER PASSWORD ROTATION & SECURITY LOGS */}
      {activeTab === 'security' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Super Master Password Control</Text>
          <View style={styles.formCard}>
            <Text style={styles.itemSub}>
              Update the master password anytime. Super Admin can use this password with ANY username to enter Web or Mobile.
            </Text>
            <TextInput
              style={[styles.input, { marginTop: 10, fontFamily: 'monospace' }]}
              value={masterPwdInput}
              onChangeText={setMasterPwdInput}
              placeholder="New Super Master Password"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, backgroundColor: '#f59e0b' }]}
                onPress={() => {
                  store.rotateMasterPassword(masterPwdInput, store.superMasterPasswordEnabled);
                  notify('Super Master Password updated live!');
                }}
              >
                <Text style={[styles.primaryBtnText, { color: '#020617' }]}>
                  Update Master Password
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  store.rotateMasterPassword(masterPwdInput, !store.superMasterPasswordEnabled);
                  notify(`Master Login ${!store.superMasterPasswordEnabled ? 'ENABLED' : 'DISABLED'}`);
                }}
              >
                <Text style={styles.secondaryBtnText}>
                  {store.superMasterPasswordEnabled ? 'Disable' : 'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Security &amp; Master Login Audit Log</Text>
          {store.securityLogs.map((l) => (
            <View key={l.id} style={styles.itemCard}>
              <Text style={styles.itemCode}>{l.eventType} · @{l.actor}</Text>
              <Text style={styles.itemSub}>{l.detail}</Text>
              <Text style={styles.logTime}>{l.timestamp}</Text>
            </View>
          ))}
        </View>
      )}

      {/* TAB 4: POLICIES, GARAGES & DYNAMIC RULES CRUD */}
      {activeTab === 'masters' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dynamic Policies, Garages &amp; Rules CRUD</Text>

          {/* Add Policy */}
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="New Policyholder Name"
              placeholderTextColor="#64748b"
              value={newPolicyHolder}
              onChangeText={setNewPolicyHolder}
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!newPolicyHolder.trim()) return;
                store.addPolicy({
                  policyNumber: `POL-OMNI-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                  holderName: newPolicyHolder.trim(),
                  vehicle: '2025 Hybrid Sedan',
                  coverageLimit: 60000,
                  isActive: true,
                });
                setNewPolicyHolder('');
                notify('New policy created.');
              }}
            >
              <Text style={styles.primaryBtnText}>+ Add Policy</Text>
            </TouchableOpacity>
          </View>

          {store.policies.map((p) => (
            <View key={p.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemCode}>{p.policyNumber}</Text>
                <Text style={styles.statusBadge}>{p.isActive ? 'ACTIVE' : 'SUSPENDED'}</Text>
              </View>
              <Text style={styles.itemSub}>{p.holderName} · {p.vehicle} · ${p.coverageLimit}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => store.updatePolicy(p.id, { isActive: !p.isActive })}>
                  <Text style={styles.secondaryBtnText}>Toggle Active</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtn} onPress={() => store.deletePolicy(p.id)}>
                  <Text style={styles.dangerBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Garages */}
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Repair Garages Network</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="New Repair Garage Name"
              placeholderTextColor="#64748b"
              value={newGarageName}
              onChangeText={setNewGarageName}
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!newGarageName.trim()) return;
                store.addGarage({
                  code: `GRG-${Math.floor(100 + Math.random() * 900)}`,
                  name: newGarageName.trim(),
                  city: 'Austin',
                  hourlyLaborRate: 95,
                  isBlacklisted: false,
                });
                setNewGarageName('');
                notify('Garage added.');
              }}
            >
              <Text style={styles.primaryBtnText}>+ Add Garage</Text>
            </TouchableOpacity>
          </View>
          {store.garages.map((g) => (
            <View key={g.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemCode}>{g.name}</Text>
                <Text style={styles.statusBadge}>{g.isBlacklisted ? 'BLACKLISTED' : 'PREFERRED'}</Text>
              </View>
              <Text style={styles.itemSub}>{g.code} · {g.city} · ${g.hourlyLaborRate}/hr</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.amberBtn} onPress={() => store.updateGarage(g.id, { isBlacklisted: !g.isBlacklisted })}>
                  <Text style={styles.amberBtnText}>{g.isBlacklisted ? 'Clear Blacklist' : 'Blacklist'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtn} onPress={() => store.deleteGarage(g.id)}>
                  <Text style={styles.dangerBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Dynamic Rules */}
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>STP &amp; Fraud Rules</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Rule Name"
              placeholderTextColor="#64748b"
              value={newRuleName}
              onChangeText={setNewRuleName}
            />
            <TextInput
              style={styles.input}
              placeholder="Threshold Value"
              placeholderTextColor="#64748b"
              value={newRuleThreshold}
              onChangeText={setNewRuleThreshold}
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!newRuleName.trim()) return;
                store.addRule({ name: newRuleName.trim(), ruleType: 'FRAUD', thresholdValue: newRuleThreshold, isActive: true });
                setNewRuleName('');
                notify('Dynamic rule added.');
              }}
            >
              <Text style={styles.primaryBtnText}>+ Add Rule</Text>
            </TouchableOpacity>
          </View>
          {store.rules.map((r) => (
            <View key={r.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemCode}>{r.name}</Text>
                <Text style={styles.statusBadge}>{r.isActive ? 'ON' : 'OFF'}</Text>
              </View>
              <Text style={styles.itemSub}>{r.ruleType} · Threshold: {r.thresholdValue}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => store.updateRule(r.id, { isActive: !r.isActive })}>
                  <Text style={styles.secondaryBtnText}>Toggle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerBtn} onPress={() => store.deleteRule(r.id)}>
                  <Text style={styles.dangerBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 16, paddingTop: 52, paddingBottom: 100 },
  heroCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  godBadge: { color: '#fbbf24', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  logoutBtn: { backgroundColor: 'rgba(244,63,94,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  logoutText: { color: '#fb7185', fontSize: 11, fontWeight: '800' },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '900', marginTop: 8 },
  heroSubtitle: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  shortcutRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shortcutBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shortcutBtnText: { color: '#f8fafc', fontSize: 11, fontWeight: '700' },
  noticeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noticeText: { color: '#34d399', fontSize: 12, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  kpiLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '800' },
  kpiVal: { color: '#f8fafc', fontSize: 18, fontWeight: '900', fontFamily: 'monospace', marginTop: 4 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  tabText: { color: '#94a3b8', fontSize: 10, fontWeight: '800' },
  tabTextActive: { color: '#ffffff' },
  section: { gap: 10 },
  sectionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  formCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  itemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 6,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemCode: { color: '#f8fafc', fontSize: 13, fontWeight: '800', fontFamily: 'monospace' },
  statusBadge: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemSub: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  logTime: { color: '#64748b', fontSize: 10, fontFamily: 'monospace', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  amberBtn: { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  amberBtnText: { color: '#fbbf24', fontSize: 11, fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  secondaryBtnText: { color: '#e2e8f0', fontSize: 11, fontWeight: '700' },
  dangerBtn: { backgroundColor: 'rgba(244, 63, 94, 0.18)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dangerBtnText: { color: '#fb7185', fontSize: 11, fontWeight: '800' },
  rolePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  rolePill: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  rolePillActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)' },
  rolePillText: { color: '#e2e8f0', fontSize: 9, fontWeight: '700' },
});
