let odorTripWardId = null;

export function beginOdorTrip(wardId) {
  odorTripWardId = wardId ? String(wardId) : null;
}

export function clearOdorTrip() {
  odorTripWardId = null;
}

export function isOdorTrip(wardId) {
  if (!odorTripWardId) return false;
  if (!wardId) return true;
  return String(wardId) === odorTripWardId;
}
