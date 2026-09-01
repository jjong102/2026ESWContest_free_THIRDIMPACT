import "./PeekCharacter.css";

function PeekHead({
  toneClass,
  compact = false,
  expression = "rest",
  look = { x: 0, y: 0 },
  children,
}) {
  const expressionClass =
    expression === "blink"
      ? " is-blink"
      : expression === "cute"
        ? " is-cute"
        : expression === "happy"
          ? " is-happy"
          : "";

  return (
    <div
      className={`peek-stage${compact ? " is-compact" : ""}${expressionClass}`}
      aria-hidden="true"
      style={{
        "--look-x": `${look.x ?? 0}`,
        "--look-y": `${look.y ?? 0}`,
      }}
    >
      <div className={`peek-head ${toneClass}${expressionClass}`}>
        {children}
      </div>
    </div>
  );
}

export default PeekHead;
