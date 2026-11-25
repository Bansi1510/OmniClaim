export interface QueuedEvidenceItem {
  id: string;
  claimId: string;
  angleStep: string;
  photoUri: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  isMockLocation: boolean;
  gyroscope: { x: number; y: number; z: number };
}

export class OfflineQueueService {
  private static queue: QueuedEvidenceItem[] = [];

  static async enqueue(item: QueuedEvidenceItem): Promise<void> {
    this.queue.push(item);
    console.log(`[OfflineQueue] Enqueued item ${item.id}. Pending uploads: ${this.queue.length}`);
  }

  static getPendingCount(): number {
    return this.queue.length;
  }

  static async processQueue(
    uploader: (item: QueuedEvidenceItem) => Promise<boolean>
  ): Promise<number> {
    let synced = 0;
    const remaining: QueuedEvidenceItem[] = [];

    for (const item of this.queue) {
      try {
        const success = await uploader(item);
        if (success) {
          synced++;
        } else {
          remaining.push(item);
        }
      } catch (e) {
        remaining.push(item);
      }
    }

    this.queue = remaining;
    return synced;
  }
}
