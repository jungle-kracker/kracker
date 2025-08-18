// 메인 화면 및 로비 bgm
import home1 from "../audios/home.mp3";
import home2 from "../audios/home2.mp3";

// 전투 bgm
import battle1 from "../audios/battle.mp3";
import battle2 from "../audios/battle2.mp3";
import battle3 from "../audios/battle3.mp3";
import jungle  from "../audios/jungle.mp3";
import volcano1 from "../audios/volcano.mp3";
import volcano2 from "../audios/volcano2.mp3";

export type PageKey = "home" | "lobby" | "game";

// /, /lobby는 같은 트랙(홈 트랙), game은 전투 트랙
export const HOME_TRACKS = [home1, home2] as const;
export const GAME_TRACKS = [battle1, battle2, battle3, jungle, volcano1, volcano2] as const;

export const PAGE_TO_PLAYLIST: Record<PageKey, readonly string[]> = {
  home: HOME_TRACKS,
  lobby: HOME_TRACKS,
  game: GAME_TRACKS,
};