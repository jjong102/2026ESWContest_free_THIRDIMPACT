import PeekHead from "./PeekHead";

function PigCharacter({ expression = "rest", look, compact = false }) {
  return (
    <PeekHead
      toneClass="peek-pig"
      expression={expression}
      look={look}
      compact={compact}
    >
      <span className="peek-pig-ear peek-pig-ear-left" />
      <span className="peek-pig-ear peek-pig-ear-right" />
      <span className="peek-eye peek-eye-left" />
      <span className="peek-eye peek-eye-right" />
      <span className="peek-blush peek-blush-left" />
      <span className="peek-blush peek-blush-right" />
      <span className="peek-pig-snout" />
    </PeekHead>
  );
}

export default PigCharacter;
