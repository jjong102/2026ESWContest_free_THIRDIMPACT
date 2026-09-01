import PeekHead from "./PeekHead";

function PandaCharacter({ expression = "rest", look, compact = false }) {
  return (
    <PeekHead toneClass="peek-panda" expression={expression} look={look} compact={compact}>
      <span className="peek-ear peek-ear-left" />
      <span className="peek-ear peek-ear-right" />
      <span className="peek-panda-patch peek-panda-patch-left" />
      <span className="peek-panda-patch peek-panda-patch-right" />
      <span className="peek-eye peek-eye-left" />
      <span className="peek-eye peek-eye-right" />
      <span className="peek-blush peek-blush-left" />
      <span className="peek-blush peek-blush-right" />
      <span className="peek-panda-nose" />
    </PeekHead>
  );
}

export default PandaCharacter;
