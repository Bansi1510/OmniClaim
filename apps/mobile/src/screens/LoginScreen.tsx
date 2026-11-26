import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useMobileStore } from '../services/mobile-store';

export function LoginScreen() {
  const { login, users, superMasterPassword, superMasterPasswordEnabled } = useMobileStore();
  const [identifier, setIdentifier] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    setError(null);
    const res = login(identifier, password);
    if (!res.success) {
      setError(res.error || 'Authentication failed.');
    }
  };

  const quickFillMaster = (username: string) => {
    setIdentifier(username);
    setPassword(superMasterPassword);
    setError(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.brandBox}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>Ω</Text>
        </View>
        <Text style={styles.title}>OmniClaim Mobile</Text>
        <Text style={styles.subtitle}>
          Enterprise Field Claims &amp; Super Admin Command App
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>USERNAME OR EMAIL</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Enter any username (e.g. sarah.jenkins)"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
        />

        <Text style={styles.label}>PASSWORD OR SUPER MASTER PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password or Super Master Password"
          placeholderTextColor="#64748b"
          secureTextEntry
          autoCapitalize="none"
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
          <Text style={styles.loginBtnText}>Sign In to OmniClaim →</Text>
        </TouchableOpacity>
      </View>

      {/* Super Master Password Info & Quick Fill */}
      <View style={styles.masterCard}>
        <Text style={styles.masterTitle}>👑 SUPER MASTER PASSWORD ACCESS</Text>
        <Text style={styles.masterDesc}>
          Enter ANY user&apos;s username together with the Super Master Password to enter the app immediately with Super Admin all-permissions bypass.
        </Text>
        <View style={styles.masterKeyBox}>
          <Text style={styles.masterKeyLabel}>Active Master Password:</Text>
          <Text style={styles.masterKeyValue}>
            {superMasterPasswordEnabled ? superMasterPassword : 'DISABLED'}
          </Text>
        </View>

        <Text style={styles.quickHeader}>TAP ANY USER TO FILL WITH MASTER PASSWORD:</Text>
        <View style={styles.chipGrid}>
          {users.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.userChip}
              onPress={() => quickFillMaster(u.username)}
            >
              <Text style={styles.chipName}>@{u.username}</Text>
              <Text style={styles.chipRole}>{u.roleSlug}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  brandBox: { alignItems: 'center', marginBottom: 24 },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: '#ffffff', fontSize: 28, fontWeight: '900' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 18,
  },
  label: { color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: 14,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: '#fb7185', fontSize: 12, fontWeight: '600' },
  loginBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  masterCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  masterTitle: { color: '#fbbf24', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  masterDesc: { color: '#cbd5e1', fontSize: 12, marginTop: 6, lineHeight: 18 },
  masterKeyBox: {
    backgroundColor: '#020617',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  masterKeyLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  masterKeyValue: { color: '#fbbf24', fontSize: 15, fontWeight: '900', fontFamily: 'monospace', marginTop: 2 },
  quickHeader: { color: '#94a3b8', fontSize: 10, fontWeight: '800', marginBottom: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userChip: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipName: { color: '#f8fafc', fontSize: 12, fontWeight: '800', fontFamily: 'monospace' },
  chipRole: { color: '#38bdf8', fontSize: 9, fontWeight: '700', marginTop: 2 },
});
