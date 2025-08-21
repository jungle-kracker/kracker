// src/game/managers/UIManager.ts
import { Debug } from "../debug/DebugManager";
import { LogCategory } from "../debug/Logger";

export interface UIConfig {
  position: {
    x: number;
    y: number;
    margin: number;
  };
  styles: {
    defaultFont: string;
    titleFont: string;
    backgroundColor: string;
    textColors: {
      title: string;
      instruction: string;
      debug: string;
      status: string;
      shadow: string;
    };
    padding: {
      x: number;
      y: number;
    };
  };
  visibility: {
    instructions: boolean;
    debugInfo: boolean;
    shadowStatus: boolean;
    mapStatus: boolean;
  };
}

const DEFAULT_UI_CONFIG: UIConfig = {
  position: {
    x: 10,
    y: 10,
    margin: 30,
  },
  styles: {
    defaultFont: "12px Arial",
    titleFont: "16px Arial",
    backgroundColor: "#000000",
    textColors: {
      title: "#ffffff",
      instruction: "#ffff00",
      debug: "#ff9900",
      status: "#00ff00",
      shadow: "#00ffff",
    },
    padding: {
      x: 8,
      y: 4,
    },
  },
  visibility: {
    instructions: true,
    debugInfo: false, // 디버그 정보 비활성화
    shadowStatus: true,
    mapStatus: true,
  },
};

interface UITextElement {
  key: string;
  text: Phaser.GameObjects.Text;
  visible: boolean;
}

export class UIManager {
  private scene: Phaser.Scene;
  private config: UIConfig;
  private uiContainer?: Phaser.GameObjects.Container;
  private uiElements: Map<string, UITextElement> = new Map();

  // === [닉네임 태그 관리] ====================================
  private nameTags: Map<string, Phaser.GameObjects.Text> = new Map();
  // HUD 컨테이너(UI 텍스트)는 depth 1000이므로 그 아래 혹은 위로 적절히
  private readonly NAME_TAG_DEPTH = 990;
  private readonly NAME_TAG_MAX_WIDTH = 110; // 너무 긴 닉네임 자동 축소

  // UI 상태
  private isVisible: boolean = true;
  private currentYOffset: number = 0;

  constructor(scene: Phaser.Scene, config?: Partial<UIConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_UI_CONFIG, ...config };

    Debug.log.info(LogCategory.UI, "UIManager 초기화됨");
  }

  // UI 생성
  initialize(): void {
    this.createContainer();
    // 모든 텍스트 생성 제거
    // this.createInstructionTexts();
    // this.createStatusTexts();

    this.updatePositions();

    // 디버그 텍스트 제거
    this.removeDebugText();

    Debug.log.info(LogCategory.UI, "UI 생성 완료");
  }

  // UI 완전 재생성 (모든 텍스트 제거용)
  forceRecreate(): void {
    this.destroy();
    this.initialize();
    Debug.log.info(LogCategory.UI, "UI 강제 재생성 완료 - 모든 텍스트 제거됨");
  }

  // UI 컨테이너 생성
  private createContainer(): void {
    this.uiContainer = this.scene.add.container(0, 0);
    this.uiContainer.setScrollFactor(0); // 카메라 이동에 영향받지 않음
    this.uiContainer.setDepth(1000); // 최상위 레이어

    Debug.log.debug(LogCategory.UI, "UI 컨테이너 생성됨");
  }

  // 안내 텍스트들 생성 - 모든 키 설정 텍스트 제거됨
  private createInstructionTexts(): void {
    // 모든 키 설정 텍스트 제거
    return;

    // if (!this.config.visibility.instructions) return;

    // this.currentYOffset = this.config.position.y;

    // // 맵 전환 안내
    // this.addTextElement("mapInstruction", "Press 1, 2, 3 to switch maps", {
    //   font: this.config.styles.titleFont,
    //   color: this.config.styles.textColors.title,
    // });

    // // 색상 변경 안내
    // this.addTextElement(
    //   "colorInstruction",
    //   "Q:빨강 E:주황 R:초록 T:파랑 Y:보라 U:핑크 I:기본",
    //   {
    //     font: this.config.styles.defaultFont,
    //     color: this.config.styles.textColors.instruction,
    //   }
    // );

    // // 그림자 조작 안내
    // this.addTextElement(
    //   "shadowInstruction",
    //   "그림자: 4,5,6(각도) 7(애니메이션) M,N,.,,(프리셋) BS(ON/OFF) 8,9,0(테스트)",
    //   {
    //     font: this.config.styles.defaultFont,
    //     color: this.config.styles.textColors.shadow,
    //   }
    // );

    // // 디버그 키 안내 - 제거됨
    // // if (this.config.visibility.debugInfo) {
    // //   this.addTextElement(
    // //     "debugInstruction",
    // //     "디버그: F1(패널) F2(모드) F3(로그레벨) F4(슬로우모션) F12(스크린샷)",
    // //     {
    // //       font: this.config.styles.defaultFont,
    // //       color: this.config.styles.textColors.debug,
    // //     }
    // //   );
    // }

    // Debug.log.debug(LogCategory.UI, "안내 텍스트 생성 완료");
  }

  // 상태 텍스트들 생성 - 모든 상태 텍스트 제거됨
  private createStatusTexts(): void {
    // 모든 상태 텍스트 제거
    return;

    // // 현재 맵 표시
    // if (this.config.visibility.mapStatus) {
    //   this.addTextElement("mapStatus", "Map: Loading...", {
    //     font: "14px Arial",
    //     color: this.config.styles.textColors.status,
    //   });
    // }

    // // 그림자 상태 표시
    // if (this.config.visibility.shadowStatus) {
    //   this.addTextElement("shadowStatus", "그림자: 초기화 중...", {
    //     font: this.config.styles.defaultFont,
    //     color: this.config.styles.textColors.shadow,
    //   });
    // }

    // Debug.log.debug(LogCategory.UI, "상태 텍스트 생성 완료");
  }

  // 닉네임 태그 생성
  public createNameTag(playerId: string, nickname: string): void {
    try {
      // Scene이 준비되지 않은 경우 안전하게 무시
      const add: any = (this.scene as any)?.add;
      if (!add || typeof add.text !== "function") {
        return;
      }

      // 기존 태그 있으면 제거
      const prev = this.nameTags.get(playerId);
      prev?.destroy();

      const text = this.scene.add
        .text(0, 0, nickname, {
          fontFamily: "Apple SD Gothic Neo",
          fontSize: "14px",
          color: "#FFFFFF",
          align: "center",
          padding: { left: 3, right: 3, top: 1, bottom: 1 },
        })
        .setOrigin(0.5, 1) // 중앙 정렬, 아래쪽 기준
        .setScrollFactor(1) // 월드 좌표 따라다님(카메라 스크롤 반영)
        .setDepth(this.NAME_TAG_DEPTH);

      // 너무 길면 자동 축소
      if (text.width > this.NAME_TAG_MAX_WIDTH) {
        text.setScale(this.NAME_TAG_MAX_WIDTH / text.width);
      }

      this.nameTags.set(playerId, text);
    } catch (e) {
      // 안전하게 무시
    }
  }

  // 닉네임 태그 위치 갱신 (hpBarTopY 바로 위에 촘촘히)
  public updateNameTagPosition(
    playerId: string,
    worldX: number,
    hpBarTopY: number
  ): void {
    const tag = this.nameTags.get(playerId);
    if (!tag) return;
    tag.setPosition(worldX, hpBarTopY - 15);
  }

  // 닉네임 변경 시 텍스트 교체
  public setNameTagText(playerId: string, nickname: string): void {
    const tag = this.nameTags.get(playerId);
    if (!tag) return this.createNameTag(playerId, nickname);
    tag.setText(nickname);
    // 길이 다시 보정
    if (tag.width > this.NAME_TAG_MAX_WIDTH)
      tag.setScale(this.NAME_TAG_MAX_WIDTH / tag.width);
    else tag.setScale(1);
  }

  // 특정 플레이어 태그 제거
  public destroyNameTag(playerId: string): void {
    const tag = this.nameTags.get(playerId);
    if (tag) tag.destroy();
    this.nameTags.delete(playerId);
  }

  // 전부 제거 (씬 종료/전환용)
  public destroyAllNameTags(): void {
    this.nameTags.forEach((t) => t.destroy());
    this.nameTags.clear();
  }

  // 텍스트 요소 추가 헬퍼
  private addTextElement(key: string, content: string, style: any): void {
    if (!this.uiContainer) return;

    const textStyle = {
      font: style.font || this.config.styles.defaultFont,
      color: style.color || this.config.styles.textColors.title,
      backgroundColor: this.config.styles.backgroundColor,
      padding: this.config.styles.padding,
    };

    const textObject = this.scene.add.text(
      this.config.position.x,
      this.currentYOffset,
      content,
      textStyle
    );

    this.uiContainer.add(textObject);

    this.uiElements.set(key, {
      key,
      text: textObject,
      visible: true,
    });

    this.currentYOffset += this.config.position.margin;

    Debug.log.trace(LogCategory.UI, `텍스트 요소 추가: ${key}`);
  }

  // UI 위치 업데이트
  updatePositions(): void {
    if (!this.uiContainer) return;

    // UI를 화면 왼쪽 상단에 고정
    this.uiContainer.setPosition(0, 0);

    Debug.log.trace(LogCategory.UI, "UI 위치 업데이트됨");
  }

  // 맵 상태 업데이트
  updateMapStatus(mapKey: string, mapName?: string): void {
    const element = this.uiElements.get("mapStatus");
    if (element) {
      const displayName = mapName || mapKey;
      element.text.setText(`Map: ${displayName}`);
      Debug.log.debug(LogCategory.UI, `맵 상태 업데이트: ${displayName}`);
    }
  }

  // 그림자 상태 업데이트
  updateShadowStatus(shadowConfig: any): void {
    const element = this.uiElements.get("shadowStatus");
    if (!element || !shadowConfig) return;

    const colorHex =
      shadowConfig.light?.color?.toString(16).padStart(6, "0") || "000000";
    const angle = shadowConfig.light?.angle || 0;
    const enabled = shadowConfig.enabled ? "ON" : "OFF";
    const depth = shadowConfig.depth || 0;

    element.text.setText(
      `그림자: ${enabled} | 각도: ${angle}° | 색상: #${colorHex} | depth: ${depth}`
    );

    Debug.log.debug(LogCategory.UI, "그림자 상태 업데이트됨", shadowConfig);
  }

  // 특정 텍스트 요소 업데이트
  updateText(key: string, newText: string): void {
    const element = this.uiElements.get(key);
    if (element) {
      element.text.setText(newText);
      Debug.log.trace(LogCategory.UI, `텍스트 업데이트: ${key} = ${newText}`);
    } else {
      Debug.log.warn(LogCategory.UI, `존재하지 않는 UI 요소: ${key}`);
    }
  }

  // 텍스트 요소 표시/숨김
  setElementVisible(key: string, visible: boolean): void {
    const element = this.uiElements.get(key);
    if (element) {
      element.text.setVisible(visible);
      element.visible = visible;
      Debug.log.debug(
        LogCategory.UI,
        `UI 요소 ${key}: ${visible ? "표시" : "숨김"}`
      );
    }
  }

  // 전체 UI 표시/숨김
  setVisible(visible: boolean): void {
    if (this.uiContainer) {
      this.uiContainer.setVisible(visible);
      this.isVisible = visible;
      Debug.log.info(LogCategory.UI, `전체 UI: ${visible ? "표시" : "숨김"}`);
    }
  }

  // UI 토글
  toggle(): boolean {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }

  // 모든 텍스트 제거
  removeDebugText(): void {
    // 모든 UI 텍스트 요소 제거
    this.uiElements.forEach((element, key) => {
      element.text.destroy();
      Debug.log.info(LogCategory.UI, `텍스트 제거됨: ${key}`);
    });
    this.uiElements.clear();
    Debug.log.info(LogCategory.UI, "모든 UI 텍스트 제거됨");
  }

  // 카테고리별 UI 표시/숨김 - 모든 텍스트 제거됨
  setInstructionsVisible(visible: boolean): void {
    // 모든 안내 텍스트 제거됨
    return;

    // const instructionKeys = [
    //   "mapInstruction",
    //   "colorInstruction",
    //   "shadowInstruction",
    //   // "debugInstruction", // 디버그 텍스트 제거
    // ];
    // instructionKeys.forEach((key) => {
    //   this.setElementVisible(key, visible);
    // });

    // this.config.visibility.instructions = visible;
    // Debug.log.info(LogCategory.UI, `안내 텍스트: ${visible ? "표시" : "숨김"}`);
  }

  setStatusVisible(visible: boolean): void {
    // 모든 상태 텍스트 제거됨
    return;

    // const statusKeys = ["mapStatus", "shadowStatus"];
    // statusKeys.forEach((key) => {
    //   this.setElementVisible(key, visible);
    // });

    // this.config.visibility.mapStatus = visible;
    // this.config.visibility.shadowStatus = visible;
    // Debug.log.info(LogCategory.UI, `상태 텍스트: ${visible ? "표시" : "숨김"}`);
  }

  // 설정 업데이트
  updateConfig(newConfig: Partial<UIConfig>): void {
    this.config = this.deepMerge(this.config, newConfig);
    Debug.log.info(LogCategory.UI, "UI 설정 업데이트됨", newConfig);

    // 필요시 UI 재생성
    if (newConfig.styles || newConfig.position) {
      this.recreateUI();
    }
  }

  // UI 재생성
  private recreateUI(): void {
    this.destroy();
    this.initialize();
    Debug.log.info(LogCategory.UI, "UI 재생성 완료");
  }

  // 깊은 병합 유틸리티
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  // 현재 설정 반환
  getConfig(): UIConfig {
    return { ...this.config };
  }

  // UI 요소 목록 반환
  getElements(): string[] {
    return Array.from(this.uiElements.keys());
  }

  // UI 상태 정보
  getStatus() {
    return {
      isVisible: this.isVisible,
      elementCount: this.uiElements.size,
      visibleElements: Array.from(this.uiElements.values()).filter(
        (el) => el.visible
      ).length,
      config: this.config,
    };
  }

  // 디버그 정보 출력
  logDebugInfo(): void {
    const status = this.getStatus();
    Debug.log.info(LogCategory.UI, "=== UI MANAGER DEBUG INFO ===");
    Debug.log.info(LogCategory.UI, "UI 상태", status);
    Debug.log.info(LogCategory.UI, "============================");
  }

  // 화면 크기 변경 처리
  handleResize(width: number, height: number): void {
    Debug.log.debug(LogCategory.UI, `UI 리사이즈: ${width}x${height}`);
    this.updatePositions();
  }

  // 정리
  destroy(): void {
    Debug.log.info(LogCategory.UI, "UIManager 정리 시작");

    if (this.uiContainer) {
      this.uiContainer.destroy();
      this.uiContainer = undefined;
    }

    this.uiElements.clear();
    this.currentYOffset = 0;

    Debug.log.info(LogCategory.UI, "UIManager 정리 완료");
  }
}
