import PeekHead from "./PeekHead";

function GiraffeCharacter({ expression = "rest", look, compact = false }) {
  return (
    <PeekHead
      toneClass="peek-giraffe"
      expression={expression}
      look={look}
      compact={compact}
    >
      <span className="peek-giraffe-ossicone peek-giraffe-ossicone-left" />
      <span className="peek-giraffe-ossicone peek-giraffe-ossicone-right" />
      <span className="peek-ear peek-ear-left peek-giraffe-ear" />
      <span className="peek-ear peek-ear-right peek-giraffe-ear" />
      <span className="peek-giraffe-spot peek-giraffe-spot-1" />
      <span className="peek-giraffe-spot peek-giraffe-spot-2" />
      <span className="peek-giraffe-spot peek-giraffe-spot-3" />
      <span className="peek-giraffe-spot peek-giraffe-spot-4" />
      <span className="peek-giraffe-spot peek-giraffe-spot-5" />
      <span className="peek-eye peek-eye-left" />
      <span className="peek-eye peek-eye-right" />
      <span className="peek-blush peek-blush-left" />
      <span className="peek-blush peek-blush-right" />
      <span className="peek-giraffe-snout" />
      <span className="peek-giraffe-nose" />
    </PeekHead>
  );
}

export default GiraffeCharacter;
