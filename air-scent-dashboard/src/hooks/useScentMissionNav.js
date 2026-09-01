import { useCallback, useEffect, useState } from "react";

import useGdmRobotPose from "./useGdmRobotPose";
import {
  cancelNavGoal,
  fetchGdmRooms,
  mapPercentToWorldMeters,
  sendNavGoal,
  yawFromRobotToMapPercent,
} from "../services/gdmMap";
import { fetchMoveUi, putMoveUi } from "../services/moveUi";
import { beginOdorTrip, clearOdorTrip } from "../utils/odorTrip";
import {
  captureScentReturnPose,
  clearScentReturn,
} from "../utils/scentReturn";
import { announceMoveTo, announceScentMission } from "../utils/robotAnnounce";

export function isScentMissionTo(navUi, wardId) {
  return (
    Boolean(navUi?.isNavigating) &&
    !navUi?.dropPin &&
    String(navUi?.selectedId ?? "") === String(wardId)
  );
}

export function isNotLocalized(locStatus) {
  return String(locStatus || "").toLowerCase() === "not_localized";
}

export default function useScentMissionNav({ onSelectWard } = {}) {
  const [mapMeta, setMapMeta] = useState(null);
  const [navUi, setNavUi] = useState({
    isNavigating: false,
    selectedId: null,
    dropPin: null,
    fragranceSpraying: false,
    fragranceWardId: null,
    locStatus: null,
  });
  const [navBusy, setNavBusy] = useState(false);
  const { pose: gdmPose } = useGdmRobotPose(true);

  useEffect(() => {
    let cancelled = false;
    fetchGdmRooms()
      .then((payload) => {
        if (cancelled) return;
        setMapMeta({
          resolution: payload?.resolution ?? null,
          origin: payload?.origin ?? null,
          image_size: payload?.image_size ?? null,
          map: payload?.map ?? null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const state = await fetchMoveUi();
        if (cancelled || !state) return;
        setNavUi({
          isNavigating: Boolean(state.isNavigating),
          selectedId: state.selectedId ? String(state.selectedId) : null,
          dropPin: state.dropPin ?? null,
          fragranceSpraying: Boolean(state.fragranceSpraying),
          fragranceWardId: state.fragranceWardId
            ? String(state.fragranceWardId)
            : null,
          locStatus:
            state.locStatus === "not_localized" ||
            state.locStatus === "localized"
              ? state.locStatus
              : null,
        });
      } catch {
        // keep last known nav status
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const startScentMission = useCallback(
    async (ward) => {
      if (!ward || navBusy) return;

      onSelectWard?.(ward.id);

      const goingHere = isScentMissionTo(navUi, ward.id);

      if (!goingHere && isNotLocalized(navUi.locStatus)) {
        return;
      }

      if (goingHere) {
        clearOdorTrip();
        clearScentReturn();
        setNavBusy(true);
        try {
          await cancelNavGoal();
          await putMoveUi({
            selectedId: ward.id,
            dropPin: null,
            isNavigating: false,
            scentMission: false,
          });
          setNavUi((prev) => ({
            ...prev,
            isNavigating: false,
            selectedId: ward.id,
            dropPin: null,
          }));
        } catch {
          // keep polling for actual status
        } finally {
          setNavBusy(false);
        }
        return;
      }

      const world = mapPercentToWorldMeters(ward.x, ward.y, mapMeta);
      if (!world) return;

      const yaw = yawFromRobotToMapPercent(gdmPose, ward.x, ward.y, mapMeta, {
        reverse: true,
      });

      setNavBusy(true);
      try {
        clearOdorTrip();
        await captureScentReturnPose(gdmPose, mapMeta);
        await sendNavGoal({
          x: world.x,
          y: world.y,
          yaw,
          frame_id: "map",
        });
        await putMoveUi({
          selectedId: ward.id,
          dropPin: null,
          navGoal: { x: Number(ward.x), y: Number(ward.y), yaw },
          isNavigating: true,
          scentMission: true,
          mode: "select",
        });
        setNavUi((prev) => ({
          ...prev,
          isNavigating: true,
          selectedId: ward.id,
          dropPin: null,
        }));
        announceScentMission(ward);
      } catch {
        clearScentReturn();
        setNavUi((prev) => ({ ...prev, isNavigating: false }));
      } finally {
        setNavBusy(false);
      }
    },
    [gdmPose, mapMeta, navBusy, navUi, onSelectWard]
  );

  const goToWard = useCallback(
    async (ward, { scent = true } = {}) => {
      if (!ward) return false;

      const alreadyGoing =
        Boolean(navUi?.isNavigating) &&
        !navUi?.dropPin &&
        String(navUi?.selectedId ?? "") === String(ward.id);

      if (!alreadyGoing && isNotLocalized(navUi.locStatus)) {
        return false;
      }

      if (alreadyGoing) {
        if (!scent) beginOdorTrip(ward.id);
        return true;
      }

      const world = mapPercentToWorldMeters(ward.x, ward.y, mapMeta);
      if (!world) return false;

      const yaw = yawFromRobotToMapPercent(gdmPose, ward.x, ward.y, mapMeta, {
        reverse: true,
      });

      if (!scent) {
        beginOdorTrip(ward.id);
      } else {
        clearOdorTrip();
      }

      setNavBusy(true);
      try {
        if (scent) {
          await captureScentReturnPose(gdmPose, mapMeta);
        } else {
          clearScentReturn();
        }
        await sendNavGoal({
          x: world.x,
          y: world.y,
          yaw,
          frame_id: "map",
        });
        await putMoveUi({
          selectedId: ward.id,
          dropPin: null,
          navGoal: { x: Number(ward.x), y: Number(ward.y), yaw },
          isNavigating: true,
          scentMission: Boolean(scent),
          mode: "select",
        });
        onSelectWard?.(ward.id);
        setNavUi((prev) => ({
          ...prev,
          isNavigating: true,
          selectedId: ward.id,
          dropPin: null,
        }));
        if (scent) {
          announceScentMission(ward);
        } else {
          announceMoveTo(ward);
        }
        return true;
      } catch {
        if (!scent) clearOdorTrip();
        else clearScentReturn();
        setNavUi((prev) => ({ ...prev, isNavigating: false }));
        return false;
      } finally {
        setNavBusy(false);
      }
    },
    [gdmPose, mapMeta, navUi, onSelectWard]
  );

  return {
    mapMeta,
    navUi,
    navBusy,
    startScentMission,
    goToWard,
  };
}
