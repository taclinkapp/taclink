// QR check-in payload helpers.
// Payload format: "TLCI:v1:<bookingId>" — versioned so we can evolve later.

export const QR_PREFIX = 'TLCI:v1:';

export const buildCheckinPayload = (bookingId: string) => `${QR_PREFIX}${bookingId}`;

export const parseCheckinPayload = (raw: string): { bookingId: string } | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(QR_PREFIX)) return null;
  const id = trimmed.slice(QR_PREFIX.length);
  // very loose UUID shape check
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return { bookingId: id };
};

// Haversine — meters between two lat/lng pairs.
export const distanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// ~10 ft trigger distance.
export const PROXIMITY_TRIGGER_METERS = 3;
