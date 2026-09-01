export const SCREENSAVER_CHARACTERS = [
  {
    id: "bear",
    name: "곰",
    description: "아래에서 고개만 쏙 내민 갈색 곰",
    available: true,
    style: "peek",
  },
  {
    id: "panda",
    name: "판다",
    description: "검정 눈가리개 흰 판다",
    available: true,
    style: "peek",
  },
  {
    id: "elephant",
    name: "코끼리",
    description: "하늘색 귀와 코가 있는 코끼리",
    available: true,
    style: "peek",
  },
  {
    id: "alpaca",
    name: "알파카",
    description: "네모난 얼굴과 앞머리가 있는 알파카",
    available: true,
    style: "peek",
  },
  {
    id: "giraffe",
    name: "기린",
    description: "네모난 얼굴과 얼룩이 있는 기린",
    available: true,
    style: "peek",
  },
  {
    id: "pig",
    name: "돼지",
    description: "네모난 분홍 얼굴과 코가 있는 돼지",
    available: true,
    style: "peek",
  },
];

export const DEFAULT_SCREENSAVER_CHARACTER = "bear";

export function getScreensaverCharacter(id) {
  return (
    SCREENSAVER_CHARACTERS.find((item) => item.id === id) ??
    SCREENSAVER_CHARACTERS.find(
      (item) => item.id === DEFAULT_SCREENSAVER_CHARACTER
    )
  );
}
