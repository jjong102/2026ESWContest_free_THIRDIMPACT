import PeekHead from "./PeekHead";

function BearCharacter({ expression = "rest", look, compact = false }) {
  return (
    <PeekHead toneClass="peek-bear" expression={expression} look={look} compact={compact}>
      <span className="peek-ear peek-ear-left" />
      <span className="peek-ear peek-ear-right" />
      <span className="peek-eye peek-eye-left" />
      <span className="peek-eye peek-eye-right" />
      <span className="peek-blush peek-blush-left" />
      <span className="peek-blush peek-blush-right" />
      <span className="peek-bear-snout" />
      <span className="peek-bear-nose" />
    </PeekHead>
  );
}

export default BearCharacter;
