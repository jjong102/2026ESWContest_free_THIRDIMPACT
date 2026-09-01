import PeekHead from "./PeekHead";

function ElephantCharacter({ expression = "rest", look, compact = false }) {
  return (
    <PeekHead
      toneClass="peek-elephant"
      expression={expression}
      look={look}
      compact={compact}
    >
      <span className="peek-ear peek-ear-left peek-elephant-ear" />
      <span className="peek-ear peek-ear-right peek-elephant-ear" />
      <span className="peek-eye peek-eye-left" />
      <span className="peek-eye peek-eye-right" />
      <span className="peek-blush peek-blush-left" />
      <span className="peek-blush peek-blush-right" />
      <span className="peek-elephant-trunk" />
    </PeekHead>
  );
}

export default ElephantCharacter;
