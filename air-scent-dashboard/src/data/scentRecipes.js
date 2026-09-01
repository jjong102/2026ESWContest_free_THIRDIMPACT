/** 미리 등록된 향 레시피 — AI 추천은 Woody / Floral / Citrus만 선택 */
export const SCENT_RECIPES = [
  {
    id: "R001",
    name: "Woody",
    displayName: "Woody",
    blend: { musk: 100, lavender: 0, woody: 0 },
    tags: ["Woody", "우디", "안정", "편안", "따뜻", "집중"],
    description: "Woody scent for a warm, steady space.",
  },
  {
    id: "R002",
    name: "Floral",
    displayName: "Floral",
    blend: { musk: 0, lavender: 100, woody: 0 },
    tags: ["Floral", "플로럴", "휴식", "수면", "편안", "스트레스"],
    description: "Floral scent to unwind and rest.",
  },
  {
    id: "R003",
    name: "Citrus",
    displayName: "Citrus",
    blend: { musk: 0, lavender: 0, woody: 100 },
    tags: ["Citrus", "시트러스", "상쾌", "활력", "집중", "깨끗"],
    description: "Citrus scent for a fresh lift.",
  },
];

export const SCENT_CHOICES = SCENT_RECIPES.map((recipe) => ({
  id: recipe.id,
  label: recipe.displayName,
}));

export function getRecipeById(recipeId) {
  return SCENT_RECIPES.find((recipe) => recipe.id === recipeId) ?? null;
}

export function getRecipeByName(name) {
  const display = scentDisplayName(name);
  return (
    SCENT_RECIPES.find((recipe) => recipe.displayName === display) ??
    SCENT_RECIPES[0]
  );
}

export function blendForFragrance(name) {
  return { ...getRecipeByName(name).blend };
}

export function channelsForFragrance(name) {
  const blend = blendForFragrance(name);
  return {
    musk: blend.musk > 0,
    lavender: blend.lavender > 0,
    woody: blend.woody > 0,
  };
}

export function scentDisplayName(name) {
  const text = String(name || "").trim();
  const lower = text.toLowerCase();
  if (/floral|lavender|라벤더|플로럴/.test(lower)) {
    return "Floral";
  }
  if (/citrus|시트러스/.test(lower)) {
    return "Citrus";
  }
  if (/woody|우디|우드|musk|머스크/.test(lower)) {
    return "Woody";
  }
  return text || "Woody";
}

/** 레시피별 시각적 향 무드 (결과 화면 이모티콘) */
export const RECIPE_VISUALS = {
  R001: { emojis: ["🪵", "🍂", "✨"], mood: "Woody" },
  R002: { emojis: ["💜", "🌸", "😌"], mood: "Floral" },
  R003: { emojis: ["🍋", "🍊", "💫"], mood: "Citrus" },
};

export function getRecipeVisuals(recipeId) {
  return (
    RECIPE_VISUALS[recipeId] ?? {
      emojis: ["✨", "🌸", "🍃"],
      mood: "Scent",
    }
  );
}
