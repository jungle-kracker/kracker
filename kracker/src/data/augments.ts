// 증강 데이터 정의(JSON) + 이미지 매핑
import raw from "./augments.json";

export interface AugmentInfo {
  id: string; // 고유ID(파일명 기반)
  name: string; // 표시 이름(카드명)
  description: string; // 효과 설명(간단 요약)
  image: string; // 카드 이미지 경로
}

// 이미지 로더: 폴더 내 svg를 동적으로 로드하여 파일명 -> URL 매핑 생성
// CRA(Webpack) 환경에서 require.context 사용
const imageMap: Record<string, string> = (() => {
  try {
    const req = (require as any).context("../assets/cards", false, /\.svg$/);
    const map: Record<string, string> = {};
    req.keys().forEach((key: string) => {
      const fileName = key.replace(/^\.\//, "");
      const mod = req(key);
      const url: string = (mod && (mod.default || mod)) as string;
      map[fileName] = url;
    });
    return map;
  } catch (e) {
    // Fallback: 빈 맵
    return {} as Record<string, string>;
  }
})();

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


