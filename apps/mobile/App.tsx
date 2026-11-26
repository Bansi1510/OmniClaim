import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MobileStoreProvider, useMobileStore } from './src/services/mobile-store';
import { LoginScreen } from './src/screens/LoginScreen';
import { SuperAdminDashboardScreen } from './src/screens/SuperAdminDashboardScreen';
import { GuidedCameraScreen } from './src/screens/GuidedCameraScreen';
import { ClaimTrackerScreen } from './src/screens/ClaimTrackerScreen';

function MobileAppContent() {
  const { session, logout, canAccess, toggleBypassAllPermissions } = useMobileStore();
  const [currentScreen, setCurrentScreen] = useState<'superadmin' | 'camera' | 'tracker'>('camera');

  const isSuperOrMaster = Boolean(
    session &&
      (session.isSuperAdmin || session.isMasterLogin || session.bypassAllPermissions)
  );

  useEffect(() => {
    if (isSuperOrMaster) {
      setCurrentScreen('superadmin');
    } else if (session) {
      setCurrentScreen('camera');
    }
  }, [session?.userId, isSuperOrMaster]);

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Super Master Password Override Bar */}
      {session.isMasterLogin && (
        <View style={styles.masterBanner}>
          <Text style={styles.masterBannerText}>
            ⚡ MASTER LOGIN: @{session.username} ({session.bypassAllPermissions ? 'GOD MODE' : 'TARGET VIEW'})
          </Text>
          <TouchableOpacity onPress={toggleBypassAllPermissions} style={styles.masterToggleBtn}>
            <Text style={styles.masterToggleText}>
              {session.bypassAllPermissions ? 'Target View' : 'God Mode'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Screen Content */}
      <View style={styles.body}>
        {currentScreen === 'superadmin' && isSuperOrMaster ? (
          <SuperAdminDashboardScreen
            onOpenCamera={() => setCurrentScreen('camera')}
            onOpenTracker={() => setCurrentScreen('tracker')}
          />
        ) : currentScreen === 'camera' && canAccess('claims:create') ? (
          <GuidedCameraScreen onComplete={() => setCurrentScreen('tracker')} />
        ) : (
          <ClaimTrackerScreen />
        )}
      </View>

      {/* Dynamic RBAC Bottom Navigation Bar (Super Admin skips all permissions & sees ALL tabs!) */}
      <View style={styles.tabBar}>
        {isSuperOrMaster && (
          <TouchableOpacity
            style={[styles.navItem, currentScreen === 'superadmin' && styles.navItemActive]}
            onPress={() => setCurrentScreen('superadmin')}
          >
            <Text style={[styles.navText, currentScreen === 'superadmin' && styles.navTextAmber]}>
              👑 Super Admin
            </Text>
          </TouchableOpacity>
        )}

        {canAccess('claims:create') && (
          <TouchableOpacity
            style={[styles.navItem, currentScreen === 'camera' && styles.navItemActive]}
            onPress={() => setCurrentScreen('camera')}
          >
            <Text style={[styles.navText, currentScreen === 'camera' && styles.navTextActive]}>
              📷 Inspect
            </Text>
          </TouchableOpacity>
        )}

        {canAccess('claims:read') && (
          <TouchableOpacity
            style={[styles.navItem, currentScreen === 'tracker' && styles.navItemActive]}
            onPress={() => setCurrentScreen('tracker')}
          >
            <Text style={[styles.navText, currentScreen === 'tracker' && styles.navTextActive]}>
              ⚡ Tracker
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.navItem} onPress={logout}>
          <Text style={styles.navTextLogout}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <MobileStoreProvider>
      <StatusBar style="light" />
      <MobileAppContent />
    </MobileStoreProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  body: { flex: 1 },
  masterBanner: {
    backgroundColor: '#f59e0b',
    paddingTop: 42,
    paddingBottom: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masterBannerText: { color: '#020617', fontSize: 11, fontWeight: '900' },
  masterToggleBtn: { backgroundColor: '#020617', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  masterToggleText: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
  },
  navItem: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  navItemActive: { backgroundColor: 'rgba(59, 130, 246, 0.18)' },
  navText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  navTextActive: { color: '#38bdf8' },
  navTextAmber: { color: '#fbbf24' },
  navTextLogout: { color: '#fb7185', fontSize: 12, fontWeight: '700' },
});
