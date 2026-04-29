import { useMemo } from 'react';
import { Qibla, Coordinates } from 'adhan';

export function useQibla(latitude: number, longitude: number) {
  const qiblaDirection = useMemo(() => {
    const coords = new Coordinates(latitude, longitude);
    return Math.round(Qibla(coords));
  }, [latitude, longitude]);

  return qiblaDirection;
}
