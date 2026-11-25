import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SensorValidatorService } from '../services/sensor-validator';
import { OfflineQueueService } from '../services/offline-queue';

const CAPTURE_STEPS = [
  { step: 'FRONT_BUMPER', label: 'Front Bumper Angle', hint: 'Align front grill inside wireframe guide' },
  { step: 'REAR_BUMPER', label: 'Rear Bumper Angle', hint: 'Align trunk and rear bumper inside outline' },
  { step: 'DRIVER_SIDE', label: 'Driver Side Profile', hint: 'Capture both doors and wheel arches' },
  { step: 'PASSENGER_SIDE', label: 'Passenger Side Profile', hint: 'Capture passenger panels' },
  { step: 'REPAIR_BILL', label: 'Garage Repair Bill / Invoice', hint: 'Ensure all line item prices are readable' },
];

export function GuidedCameraScreen({ onComplete }: { onComplete: () => void }) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const currentStep = CAPTURE_STEPS[currentStepIdx];

  const handleCapture = async () => {
    // Sensor validation: stability and anti-spoofing
    const mockGyro = { x: 0.05, y: 0.04, z: 0.02 };
    const isStable = SensorValidatorService.isDeviceStable(mockGyro);

    if (!isStable) {
      Alert.alert('Device Unstable', 'Please hold device steady to prevent photo blur.');
      return;
    }

    // Enqueue into offline ingestion queue
    await OfflineQueueService.enqueue({
      id: `ev-${Date.now()}`,
      claimId: 'CLM-DEMO-001',
      angleStep: currentStep.step,
      photoUri: `file:///storage/emulated/0/DCIM/omniclaim_${currentStep.step}.jpg`,
      timestamp: new Date().toISOString(),
      latitude: 37.7749,
      longitude: -122.4194,
      isMockLocation: false,
      gyroscope: mockGyro,
    });

    if (currentStepIdx < CAPTURE_STEPS.length - 1) {
      setCurrentStepIdx((idx) => idx + 1);
    } else {
      Alert.alert('All Angles Captured', 'All evidence photos captured with sensor telemetry.', [
        { text: 'View Tracker', onPress: onComplete },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Progress Indicator */}
      <View style={styles.header}>
        <Text style={styles.stepTitle}>
          Step {currentStepIdx + 1} of {CAPTURE_STEPS.length}: {currentStep.label}
        </Text>
        <Text style={styles.stepHint}>{currentStep.hint}</Text>
      </View>

      {/* AR Ghost Alignment Wireframe Viewfinder */}
      <View style={styles.viewfinder}>
        <View style={styles.ghostWireframe}>
          <Text style={styles.ghostLabel}>AR GHOST SILHOUETTE ALIGNMENT</Text>
        </View>
        <View style={styles.sensorBadge}>
          <Text style={styles.sensorText}>✔ Gyroscope Stable | GPS Verified</Text>
        </View>
      </View>

      {/* Bottom Shutter Controls */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.shutterButton} onPress={handleCapture}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#0f172a' },
  stepTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  stepHint: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  viewfinder: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ghostWireframe: {
    width: '85%',
    height: '70%',
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
  },
  ghostLabel: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  sensorBadge: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sensorText: { color: '#10b981', fontSize: 11, fontWeight: 'bold' },
  footer: { height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ffffff' },
});
