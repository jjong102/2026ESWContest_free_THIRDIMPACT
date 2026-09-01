document.addEventListener("contextmenu", (event) => event.preventDefault());

document.addEventListener("selectstart", (event) => {
  if (event.target?.closest?.("input, textarea")) return;
  event.preventDefault();
});

document.addEventListener("dragstart", (event) => event.preventDefault());

function isZoomShortcut(event) {
  if (!(event.ctrlKey || event.metaKey)) return false;
  return (
    event.key === "+" ||
    event.key === "-" ||
    event.key === "=" ||
    event.key === "0" ||
    event.code === "NumpadAdd" ||
    event.code === "NumpadSubtract"
  );
}

document.addEventListener(
  "keydown",
  (event) => {
    if (isZoomShortcut(event)) event.preventDefault();
  },
  { capture: true },
);

document.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  },
  { capture: true, passive: false },
);
