import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Bot, Eye, EyeOff, MapPin, Mic, MicOff, RefreshCw, Wifi, Wind, SprayCan } from "lucide-react";

import { useCurrentTime } from "../hooks/useCurrentTime";
import { useSttHealth } from "../hooks/useSttHealth";
import "./Header.css";

const SCREENSAVER_LONG_PRESS_MS = 650;

function Header({
  variant = "default",
  onAiBack,
  onActivateScreensaver,
  screensaverIdleDisabled = false,
  onToggleScreensaverIdle,
  airPurifierOn = false,
  fragranceOn = false,
  fragranceDiffusing = false,
  arduinoConnected = false,
}) {
  const { timeLabel } = useCurrentTime();
  const sttStatus = useSttHealth();
  const isAiConsult = variant === "ai-consult";
  const whisperTitle = `위스퍼 ${sttStatus.label} · ${sttStatus.detail}`;
  const deviceRunning =
    airPurifierOn || fragranceOn || fragranceDiffusing;
  const [screensaverHolding, setScreensaverHolding] = useState(false);
  const longPressTimerRef = useRef(null);
  const suppressClickRef = useRef(false);

  const clearScreensaverLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startScreensaverLongPress = useCallback((event) => {
    if (!onToggleScreensaverIdle) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    suppressClickRef.current = false;
    clearScreensaverLongPress();
    setScreensaverHolding(true);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      suppressClickRef.current = true;
      setScreensaverHolding(false);
      onToggleScreensaverIdle();
    }, SCREENSAVER_LONG_PRESS_MS);
  }, [clearScreensaverLongPress, onToggleScreensaverIdle]);

  const finishScreensaverLongPress = useCallback(() => {
    clearScreensaverLongPress();
    setScreensaverHolding(false);
  }, [clearScreensaverLongPress]);

  const handleScreensaverClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onActivateScreensaver?.();
  }, [onActivateScreensaver]);

  let deviceLabel = "대기";
  let deviceTone = "idle";
  if (airPurifierOn && (fragranceOn || fragranceDiffusing)) {
    deviceLabel = "공기·향기 가동";
    deviceTone = "running";
  } else if (airPurifierOn) {
    deviceLabel = "공기청정 가동";
    deviceTone = "running";
  } else if (fragranceDiffusing) {
    deviceLabel = "발향 중";
    deviceTone = "scent";
  } else if (fragranceOn) {
    deviceLabel = "향기 가동";
    deviceTone = "scent";
  }

  const screensaverLabel = screensaverIdleDisabled
    ? "화면보호기 꺼짐, 길게 눌러 자동 전환 켜기"
    : "화면보호기, 길게 눌러 자동 전환 끄기";

  return (
    <header className={`app-header ${isAiConsult ? "ai-consult" : ""}`}>
      <div
        className={`header-panel header-panel-default ${isAiConsult ? "is-hidden" : ""}`}
      >
        <div className="header-left">
          <div className="header-icon-box">
            <MapPin size={20} strokeWidth={2.4} />
          </div>

          <div className="header-text">
            <p>현재 위치</p>
            <h2>인천대학교</h2>
          </div>
        </div>

        <div className="header-right">
          <div
            className={`header-device-chip ${deviceTone}`}
            title={
              arduinoConnected
                ? "기기 연결됨"
                : "기기 연결 대기"
            }
          >
            {airPurifierOn ? <Wind size={13} strokeWidth={2.6} /> : null}
            {(fragranceOn || fragranceDiffusing) && !airPurifierOn ? (
              <SprayCan size={13} strokeWidth={2.6} />
            ) : null}
            {deviceRunning ? (
              <span className="header-device-dot" aria-hidden="true" />
            ) : (
              <span className="header-device-idle-dot" aria-hidden="true" />
            )}
            <strong>{deviceLabel}</strong>
            {!arduinoConnected && <em>오프라인</em>}
          </div>
          <button
            type="button"
            className="header-refresh-btn"
            onClick={() => window.location.reload()}
            aria-label="새로고침"
            title="새로고침"
          >
            <RefreshCw size={18} strokeWidth={2.4} />
          </button>
          {onActivateScreensaver ? (
            <button
              type="button"
              className={`header-screensaver-btn${screensaverIdleDisabled ? " is-idle-off" : ""}${screensaverHolding ? " is-holding" : ""}`}
              onClick={handleScreensaverClick}
              onPointerDown={startScreensaverLongPress}
              onPointerUp={finishScreensaverLongPress}
              onPointerCancel={finishScreensaverLongPress}
              onContextMenu={(event) => event.preventDefault()}
              aria-label={screensaverLabel}
              title={screensaverLabel}
            >
              {screensaverIdleDisabled ? (
                <EyeOff size={18} strokeWidth={2.4} />
              ) : (
                <Eye size={18} strokeWidth={2.4} />
              )}
            </button>
          ) : null}
          <span
            className={`header-status-icon is-${sttStatus.tone}`}
            title={whisperTitle}
            aria-label={whisperTitle}
          >
            {sttStatus.tone === "off" ? (
              <MicOff size={20} strokeWidth={2.4} />
            ) : (
              <Mic size={20} strokeWidth={2.4} />
            )}
          </span>
          <Wifi className="header-wifi" size={20} strokeWidth={2.4} />
          <span>{timeLabel}</span>
        </div>
      </div>

      <div
        className={`header-panel header-panel-ai ${isAiConsult ? "" : "is-hidden"}`}
      >
        <button className="header-ai-back" type="button" onClick={onAiBack}>
          <ArrowLeft size={22} />
          <span>돌아가기</span>
        </button>

        <div className="header-ai-title">
          <Bot size={22} />
          <strong>AI 향기 상담</strong>
        </div>

        <span className="header-ai-live">LIVE</span>
      </div>
    </header>
  );
}

export default Header;
