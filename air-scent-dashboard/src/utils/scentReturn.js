import { fetchNavPose, worldMetersToMapPercent } from "../services/gdmMap";

const POSE_KEY = "air-scent:scent-return-pose";
const RETURNING_KEY = "air-scent:scent-returning";

let cachedPose = null;
let returning = false;

function readStoredPose() {
  if (cachedPose) return cachedPose;
  try {
    const raw = window.sessionStorage.getItem(POSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.x == null || parsed?.y == null) return null;
    cachedPose = parsed;
    return cachedPose;
  } catch {
    return null;
  }
}

export function saveScentReturnPose(pose, mapMeta) {
  if (pose?.x_m == null || pose?.y_m == null) return false;
  const mapped = mapMeta
    ? worldMetersToMapPercent(pose.x_m, pose.y_m, mapMeta)
    : null;
  cachedPose = {
    x: Number(pose.x_m),
    y: Number(pose.y_m),
    yaw: Number(pose.yaw) || 0,
    mapX: mapped?.x ?? null,
    mapY: mapped?.y ?? null,
  };
  returning = false;
  try {
    window.sessionStorage.setItem(POSE_KEY, JSON.stringify(cachedPose));
    window.sessionStorage.removeItem(RETURNING_KEY);
  } catch {
    // ignore
  }
  return true;
}

export async function captureScentReturnPose(pose, mapMeta) {
  let source = pose;
  if (source?.x_m == null || source?.y_m == null) {
    try {
      const amcl = await fetchNavPose();
      if (amcl?.x_m != null && amcl?.y_m != null) {
        source = amcl;
      }
    } catch {
      // keep source
    }
  }
  return saveScentReturnPose(source, mapMeta);
}

export function getScentReturnPose() {
  return readStoredPose();
}

export function beginScentReturn() {
  returning = true;
  try {
    window.sessionStorage.setItem(RETURNING_KEY, "1");
  } catch {
    // ignore
  }
}

export function isScentReturning() {
  if (returning) return true;
  try {
    return window.sessionStorage.getItem(RETURNING_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearScentReturn() {
  cachedPose = null;
  returning = false;
  try {
    window.sessionStorage.removeItem(POSE_KEY);
    window.sessionStorage.removeItem(RETURNING_KEY);
  } catch {
    // ignore
  }
}
