// QR check-in payload helpers.
//
// v1 (legacy, plaintext): "TLCI:v1:<bookingId>" — kept for backward compat
//   but no longer trusted for attendance.
// v2 (signed): "TLCI:v2:<base64url(payload)>.<base64url(hmacSha256)>"
//   The HMAC secret lives only on the server. Tokens are issued by the
//   `sign-checkin-qr` edge function and verified by `verify-checkin-qr`.
//   Payload is bound to bookingId, courseId, and the course's calendar day,
//   so a token can't be reused on a different day or for a different course.

export const QR_PREFIX_V1 = 'TLCI:v1:';
export const QR_PREFIX_V2 = 'TLCI:v2:';

// Legacy unsigned helpers — left intact for any non-attendance preview UI.
export const QR_PREFIX = QR_PREFIX_V1;
export const buildCheckinPayload = (bookingId: string) => `${QR_PREFIX_V1}${bookingId}`;

export const parseCheckinPayload = (raw: string): { bookingId: string } | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(QR_PREFIX_V1)) return null;
  const id = trimmed.slice(QR_PREFIX_V1.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return { bookingId: id };
};

// Quick client-side shape check for signed tokens — full verification is
// always done server-side via the verify-checkin-qr edge function.
export const looksLikeSignedToken = (raw: string) =>
  typeof raw === 'string' && raw.trim().startsWith(QR_PREFIX_V2);


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
