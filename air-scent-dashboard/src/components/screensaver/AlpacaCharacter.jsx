import PeekHead from "./PeekHead";

function AlpacaCharacter({ expression = "rest", look, compact = false }) {
  return (
    <PeekHead
      toneClass="peek-alpaca"
      expression={expression}
      look={look}
      compact={compact}
    >
      <span className="peek-alpaca-ear peek-alpaca-ear-left" />
      <span className="peek-alpaca-ear peek-alpaca-ear-right" />
      <span className="peek-alpaca-bangs">
        <span className="peek-alpaca-bang" />
        <span className="peek-alpaca-bang" />
        <span className="peek-alpaca-bang" />
      </span>
      <span className="peek-eye peek-eye-left" />
      <span className="peek-eye peek-eye-right" />
      <span className="peek-blush peek-blush-left" />
      <span className="peek-blush peek-blush-right" />
      <span className="peek-alpaca-snout" />
    </PeekHead>
  );
}

export default AlpacaCharacter;
