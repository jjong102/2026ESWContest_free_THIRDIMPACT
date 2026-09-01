import { useEffect, useState } from "react";

import AlpacaCharacter from "./screensaver/AlpacaCharacter";
import BearCharacter from "./screensaver/BearCharacter";
import ElephantCharacter from "./screensaver/ElephantCharacter";
import GiraffeCharacter from "./screensaver/GiraffeCharacter";
import PandaCharacter from "./screensaver/PandaCharacter";
import PigCharacter from "./screensaver/PigCharacter";
import { DEFAULT_SCREENSAVER_CHARACTER } from "../data/screensaverCharacters";

import "./EyeScreensaver.css";

function randomLook() {
  // 눈동자 이동량 (% of eye box)
  const x = (Math.random() * 2 - 1) * (10 + Math.random() * 14);
  const y = (Math.random() * 2 - 1) * (8 + Math.random() * 12);
  return { x, y };
}

function EyeScreensaver({
  active,
  onDismiss,
  characterId = DEFAULT_SCREENSAVER_CHARACTER,
}) {
  const [expression, setExpression] = useState("rest");
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) {
      setExpression("rest");
      setLook({ x: 0, y: 0 });
      return undefined;
    }

    let cancelled = false;
    const timers = new Set();

    const later = (fn, ms) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const scheduleLook = () => {
      setLook(randomLook());
      later(scheduleLook, 700 + Math.random() * 1600);
    };

    const doBlink = (then) => {
      setExpression("blink");
      later(() => {
        setExpression("rest");
        then?.();
      }, 110 + Math.random() * 50);
    };

    const scheduleBlink = () => {
      const doubleBlink = Math.random() < 0.28;
      doBlink(() => {
        if (doubleBlink) {
          later(() => {
            doBlink(() => {
              later(scheduleBlink, 1200 + Math.random() * 1800);
            });
          }, 90);
        } else {
          later(scheduleBlink, 1200 + Math.random() * 1800);
        }
      });
    };

    const scheduleCute = () => {
      later(() => {
        if (cancelled) return;
        // 귀여운 척(볼 바람)을 더 자주
        const pose = Math.random() < 0.7 ? "cute" : "happy";
        setExpression(pose);
        setLook({ x: 0, y: pose === "cute" ? 4 : 2 });
        later(() => {
          setExpression("rest");
          later(scheduleCute, 3800 + Math.random() * 4200);
        }, 1400 + Math.random() * 600);
      }, 2800 + Math.random() * 2200);
    };

    scheduleLook();
    later(scheduleBlink, 800 + Math.random() * 900);
    scheduleCute();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, [active, characterId]);

  const renderCharacter = () => {
    const props = { expression, look };
    switch (characterId) {
      case "bear":
        return <BearCharacter {...props} />;
      case "panda":
        return <PandaCharacter {...props} />;
      case "alpaca":
        return <AlpacaCharacter {...props} />;
      case "elephant":
        return <ElephantCharacter {...props} />;
      case "giraffe":
        return <GiraffeCharacter {...props} />;
      case "pig":
        return <PigCharacter {...props} />;
      default:
        return <BearCharacter {...props} />;
    }
  };

  return (
    <button
      type="button"
      className={`eye-screensaver ${active ? "visible" : ""}`}
      onClick={onDismiss}
      aria-label="화면 깨우기"
      tabIndex={active ? 0 : -1}
    >
      {renderCharacter()}
      <p className="eye-screensaver-hint">화면을 터치하면 돌아갑니다</p>
    </button>
  );
}

export default EyeScreensaver;
