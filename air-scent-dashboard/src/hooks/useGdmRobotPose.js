import { useEffect, useState } from "react";

import {
  fetchGdmRobotPose,
  fetchGdmStatus,
  fetchNavPose,
} from "../services/gdmMap";

const POSE_POLL_MS = 500;
const STATUS_POLL_MS = 5000;

const initialPose = {
  live: false,
  x_px: null,
  y_px: null,
  x_m: null,
  y_m: null,
  yaw: null,
  source: null,
  error: null,
};

export default function useGdmRobotPose(enabled = true) {
  const [pose, setPose] = useState(initialPose);
  const [status, setStatus] = useState({
    hasFloorplan: false,
    hasRooms: false,
    map: null,
    robotPoseLive: false,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    const loadStatus = async () => {
      try {
        const data = await fetchGdmStatus();
        if (cancelled) return;
        setStatus({
          hasFloorplan: Boolean(data.has_floorplan),
          hasRooms: Boolean(data.has_rooms),
          map: data.map ?? null,
          robotPoseLive: Boolean(data.robot_pose_live),
        });
      } catch {
        if (cancelled) return;
        setStatus((prev) => ({ ...prev, hasFloorplan: false }));
      }
    };

    const loadPose = async () => {
      try {
        const gdm = await fetchGdmRobotPose();
        if (cancelled) return;

        if (gdm?.live && (gdm.x_px != null || gdm.x_m != null)) {
          setPose({
            live: true,
            x_px: gdm.x_px ?? null,
            y_px: gdm.y_px ?? null,
            x_m: gdm.x_m ?? null,
            y_m: gdm.y_m ?? null,
            yaw: gdm.yaw ?? null,
            source: gdm.source ?? "gdm_web",
            error: null,
          });
          return;
        }

        const amcl = await fetchNavPose();
        if (cancelled) return;

        if (amcl?.live && amcl.x_m != null && amcl.y_m != null) {
          setPose({
            live: true,
            x_px: null,
            y_px: null,
            x_m: amcl.x_m,
            y_m: amcl.y_m,
            yaw: amcl.yaw ?? null,
            source: amcl.source ?? "amcl",
            error: null,
          });
          setStatus((prev) => ({ ...prev, robotPoseLive: true }));
          return;
        }

        setPose({
          ...initialPose,
          error: gdm?.error || amcl?.error || "pose unavailable",
        });
      } catch (error) {
        if (cancelled) return;
        setPose((prev) => ({
          ...prev,
          live: false,
          error: error.message,
        }));
      }
    };

    loadStatus();
    loadPose();
    const statusTimer = setInterval(loadStatus, STATUS_POLL_MS);
    const poseTimer = setInterval(loadPose, POSE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(statusTimer);
      clearInterval(poseTimer);
    };
  }, [enabled]);

  return { pose, status };
}
