import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TIMELINE_STEPS = [
  { label: 'Accident Evidence Uploaded', status: 'COMPLETED', date: 'Nov 24, 2:30 PM' },
  { label: 'YOLO Damage Detection & OCR', status: 'COMPLETED', date: 'Nov 24, 2:31 PM' },
  { label: 'Bill Reconciliation & Phantom Diff', status: 'COMPLETED', date: 'Nov 24, 2:31 PM' },
  { label: 'Adjuster Assessment Approved', status: 'COMPLETED', date: 'Nov 24, 2:35 PM' },
  { label: 'Ledger Settlement & Instant Payout ($675.00)', status: 'IN_PROGRESS', date: 'Estimated < 2 mins' },
];

export function ClaimTrackerScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.claimNumber}>CLM-202611-9102</Text>
        <Text style={styles.subtext}>Honda Accord Touring (2022)</Text>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.cardTitle}>LIVE DISBURSEMENT TRACKER</Text>

        {TIMELINE_STEPS.map((step, idx) => (
          <View key={idx} style={styles.timelineRow}>
            <View style={styles.iconColumn}>
              <View
                style={[
                  styles.dot,
                  step.status === 'COMPLETED' ? styles.dotCompleted : styles.dotActive,
                ]}
              />
              {idx < TIMELINE_STEPS.length - 1 && <View style={styles.line} />}
            </View>
            <View style={styles.contentColumn}>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <Text style={styles.stepDate}>{step.date}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.payoutCard}>
        <Text style={styles.payoutTitle}>Authorized Settlement Payout</Text>
        <Text style={styles.payoutAmount}>$675.00</Text>
        <Text style={styles.payoutMethod}>Disbursing directly via Instant Bank Transfer (ACH)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20, paddingTop: 60 },
  header: { marginBottom: 20 },
  claimNumber: { color: '#f8fafc', fontSize: 24, fontWeight: '900', fontFamily: 'monospace' },
  subtext: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  timelineCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20, marginBottom: 20 },
  cardTitle: { color: '#64748b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 16 },
  timelineRow: { flexDirection: 'row', minHeight: 50 },
  iconColumn: { alignItems: 'center', width: 24 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotCompleted: { backgroundColor: '#10b981' },
  dotActive: { backgroundColor: '#38bdf8' },
  line: { width: 2, flex: 1, backgroundColor: '#334155', marginVertical: 4 },
  contentColumn: { flex: 1, marginLeft: 12, paddingBottom: 16 },
  stepLabel: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  stepDate: { color: '#64748b', fontSize: 11, marginTop: 2 },
  payoutCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  payoutTitle: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  payoutAmount: { color: '#34d399', fontSize: 32, fontWeight: '900', fontFamily: 'monospace', marginVertical: 6 },
  payoutMethod: { color: '#94a3b8', fontSize: 11 },
});
