import { describe, expect, it } from 'vitest';
import { resolveEasternProvinceToNearestCity } from '@/lib/locationHelpers';

describe('resolveEasternProvinceToNearestCity', () => {
  it('returns empty string outside Eastern Province bounds', () => {
    expect(resolveEasternProvinceToNearestCity(40.7128, -74.006)).toBe('');
    expect(resolveEasternProvinceToNearestCity(24.9999, 50.0)).toBe('');
    expect(resolveEasternProvinceToNearestCity(28.0001, 50.0)).toBe('');
  });

  it('resolves to Jubail near Jubail coordinates', () => {
    expect(resolveEasternProvinceToNearestCity(27.0174, 49.6225)).toBe('Jubail');
    expect(resolveEasternProvinceToNearestCity(27.0, 49.63)).toBe('Jubail');
  });

  it('resolves to Dammam near Dammam coordinates', () => {
    expect(resolveEasternProvinceToNearestCity(26.3927, 49.9777)).toBe('Dammam');
    expect(resolveEasternProvinceToNearestCity(26.39, 49.98)).toBe('Dammam');
  });

  it('resolves to nearest known city within Eastern Province bounds', () => {
    expect(resolveEasternProvinceToNearestCity(26.2172, 50.1971)).toBe('Khobar');
    expect(resolveEasternProvinceToNearestCity(26.2886, 50.114)).toBe('Dhahran');
    expect(resolveEasternProvinceToNearestCity(26.5582, 50.0089)).toBe('Qatif');
  });
});
