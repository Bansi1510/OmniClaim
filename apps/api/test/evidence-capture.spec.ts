import { BadRequestException } from '@nestjs/common';
import { ClaimsService } from '../src/modules/claims/claims.service';

describe('Live Camera & Staff Exception Evidence Upload Security', () => {
  const validJpegBase64 = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    Buffer.from('JFIF_TEST_IMAGE_PAYLOAD_DATA'),
  ]).toString('base64');

  const fakeExeBase64 = Buffer.from('MZ_NOT_AN_IMAGE_EXECUTABLE_BINARY_12345').toString('base64');

  it('rejects non-image payloads even when extension/mimeType claims image/jpeg', async () => {
    const mockPrisma: any = {
      claim: {
        findUnique: jest.fn().mockResolvedValue({ id: 'clm-1', incidentLatitude: 37.7, incidentLongitude: -122.4 }),
      },
    };
    const service = new ClaimsService(mockPrisma, {} as any);

    await expect(
      service.uploadLiveCameraEvidence(
        'clm-1',
        { captureStep: 'FRONT_VIEW', imageBase64: fakeExeBase64, mimeType: 'image/jpeg' },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('stores live camera JPEG, records server timestamp, SHA-256 checksum, and writes audit log', async () => {
    const mockPrisma: any = {
      claim: {
        findUnique: jest.fn().mockResolvedValue({ id: 'clm-1', incidentLatitude: 37.7, incidentLongitude: -122.4 }),
      },
      claimEvidence: {
        create: jest.fn(({ data }) => Promise.resolve(data)),
      },
      claimAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'aud-1' }),
      },
    };
    const service = new ClaimsService(mockPrisma, {} as any);

    const record = await service.uploadLiveCameraEvidence(
      'clm-1',
      { captureStep: 'NUMBER_PLATE', imageBase64: validJpegBase64, mimeType: 'image/jpeg' },
      'policyholder-1',
    );

    expect(record.captureSource).toBe('LIVE_CAMERA');
    expect(record.captureStep).toBe('NUMBER_PLATE');
    expect(record.uploadedById).toBe('policyholder-1');
    expect(record.checksumSha256).toHaveLength(64);
    expect(record.mimeType).toBe('image/jpeg');
    expect(mockPrisma.claimAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('requires documented reason for staff exception uploads and logs STAFF_EVIDENCE_EXCEPTION_UPLOAD', async () => {
    const mockPrisma: any = {
      claim: {
        findUnique: jest.fn().mockResolvedValue({ id: 'clm-1', incidentLatitude: 37.7, incidentLongitude: -122.4 }),
      },
      claimEvidence: {
        create: jest.fn(({ data }) => Promise.resolve(data)),
      },
      claimAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'aud-2' }),
      },
    };
    const service = new ClaimsService(mockPrisma, {} as any);

    await expect(
      service.uploadStaffExceptionEvidence(
        'clm-1',
        { captureStep: 'FRONT_VIEW', imageBase64: validJpegBase64, exceptionReason: 'no' },
        'adjuster-1',
      ),
    ).rejects.toThrow(BadRequestException);

    const record = await service.uploadStaffExceptionEvidence(
      'clm-1',
      {
        captureStep: 'FRONT_VIEW',
        imageBase64: validJpegBase64,
        exceptionReason: 'Police report collision scene photo received from precinct.',
      },
      'adjuster-1',
    );
    expect(record.captureSource).toBe('STAFF_EXCEPTION');
    expect(record.exceptionReason).toContain('Police report');
    expect(mockPrisma.claimAuditLog.create.mock.calls[0][0].data.action).toBe(
      'STAFF_EVIDENCE_EXCEPTION_UPLOAD',
    );
  });
});
