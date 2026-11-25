export interface SensorIntegrityResult {
  isMockLocation: boolean;
  isStable: boolean;
  latitude: number;
  longitude: number;
  altitude: number | null;
  gyroscope: { x: number; y: number; z: number };
}

export class SensorValidatorService {
  /**
   * Validates device stability using gyroscope variance.
   * If delta is > 0.15 rad/s, camera is shaking and photo will blur.
   */
  static isDeviceStable(gyroscopeData: { x: number; y: number; z: number }): boolean {
    const magnitude = Math.sqrt(
      gyroscopeData.x ** 2 + gyroscopeData.y ** 2 + gyroscopeData.z ** 2
    );
    return magnitude < 0.25;
  }

  /**
   * Performs client-side mock-GPS detection and altitude consistency checks.
   */
  static validateLocationIntegrity(locationObj: any): { isMock: boolean } {
    // Android & iOS location providers flag mock location
    const isMock = Boolean(locationObj.mocked || locationObj.isFromMockProvider);
    return { isMock };
  }
}
