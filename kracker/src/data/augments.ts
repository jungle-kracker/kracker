// 증강 데이터 정의(JSON) + 이미지 매핑
import raw from "./augments.json";

export interface AugmentInfo {
  id: string; // 고유ID(파일명 기반)
  name: string; // 표시 이름(카드명)
  description: string; // 효과 설명(간단 요약)
  image: string; // 카드 이미지 경로
}

// 이미지 파일은 정적 import가 필요하여 맵으로 관리
// JSON의 imageFile 값을 key로 사용
const imageMap: Record<string, string> = {
  "그날인류는떠올렸다.svg": require("../assets/cards/그날인류는떠올렸다.svg"),
  "기생충.svg": require("../assets/cards/기생충.svg"),
  "끈적여요.svg": require("../assets/cards/끈적여요.svg"),
  "끼얏호우.svg": require("../assets/cards/끼얏호우.svg"),
  "도망간다냥.svg": require("../assets/cards/도망간다냥.svg"),
  "독걸려랑.svg": require("../assets/cards/독걸려랑.svg"),
  "먼저가요.svg": require("../assets/cards/먼저가요.svg"),
  "목표를포착했다.svg": require("../assets/cards/목표를포착했다.svg"),
  "벌이야.svg": require("../assets/cards/벌이야.svg"),
  "빨리뽑기.svg": require("../assets/cards/빨리뽑기.svg"),
  "안아줘요.svg": require("../assets/cards/안아줘요.svg"),
  "앗따거.svg": require("../assets/cards/앗따거.svg"),
  "유령이다.svg": require("../assets/cards/유령이다.svg"),
  "이건폭탄이여.svg": require("../assets/cards/이건폭탄이여.svg"),
  "잠깐만.svg": require("../assets/cards/잠깐만.svg"),
  "준비끝.svg": require("../assets/cards/준비끝.svg"),
  "팅팅탕탕.svg": require("../assets/cards/팅팅탕탕.svg"),
  "풍선처럼.svg": require("../assets/cards/풍선처럼.svg"),
} as any;

const jsonData: Array<{ id: string; name: string; description: string; imageFile: string }> = (raw as any);

export const AUGMENTS: AugmentInfo[] = jsonData.map((a) => ({
  id: a.id,
  name: a.name,
  description: a.description,
  image: imageMap[a.imageFile] as string,
}));

export function getRandomAugments(count: number): AugmentInfo[] {
  const pool = [...AUGMENTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}


