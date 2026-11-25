import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GuidedCameraScreen } from './src/screens/GuidedCameraScreen';
import { ClaimTrackerScreen } from './src/screens/ClaimTrackerScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'camera' | 'tracker'>('camera');

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {currentScreen === 'camera' ? (
        <GuidedCameraScreen onComplete={() => setCurrentScreen('tracker')} />
      ) : (
        <ClaimTrackerScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});
