# 🎮 Kracker - 멀티플레이어 웹 슈팅 게임

## 📋 서비스 소개

**Kracker**는 크래프톤 정글에서 6일간 개발한 몰입형 멀티플레이어 웹 슈팅 게임입니다.

### 🎯 게임 기획의도

#### 1. **즉시 접근 가능한 웹 게임**

- 별도 설치 없이 브라우저에서 바로 플레이 가능
- 모바일과 데스크톱 모두 지원하는 반응형 디자인
- 실시간 멀티플레이어 경험 제공

#### 2. **전략적 증강 시스템**

- 라운드마다 다양한 증강(Augment) 카드 선택
- 각 증강은 무기, 총알, 플레이어 능력에 고유한 효과 부여
- "독걸려랑", "기생충", "벌이야!", "앗따거" 등 18가지 증강 카드
- 증강 조합을 통한 전략적 플레이 유도

#### 3. **팀 기반 전투 시스템**

- 2팀(팀A/팀B) 대전 방식
- 팀당 최대 3명, 총 6명까지 동시 플레이
- 라운드별 승패 기록과 최종 결과 집계

#### 4. **다양한 맵과 환경**

- 정글, 아레나, 하늘 사원 등 다양한 맵 제공
- 각 맵별 고유한 플랫폼 구조와 전략적 요소
- 실시간 맵 전환 기능

## 🛠 기술적 챌린지와 해결 방법

### 1. **실시간 멀티플레이어 동기화**

#### 🎯 도전 과제

- 20fps 실시간 플레이어 위치 동기화
- 총알 발사와 충돌 감지의 정확한 타이밍
- 네트워크 지연 보정과 부드러운 인터폴레이션

#### 💡 해결 방법

```typescript
// NetworkManager.ts - 최적화된 동기화 시스템
private movementThreshold = 5; // 5픽셀 이상 움직여야 전송
private maxUpdateRate = 1000 / 20; // 20fps로 제한

// 인터폴레이션을 통한 부드러운 움직임
interface RemotePlayer {
  interpolation: {
    targetX: number;
    targetY: number;
    currentX: number;
    currentY: number;
    targetVX: number;
    targetVY: number;
  };
}
```

### 2. **복잡한 증강 시스템 구현**

#### 🎯 도전 과제

- 18가지 증강의 다양한 효과를 동적으로 적용
- 무기, 총알, 플레이어 능력의 복합적 상호작용
- 라운드별 증강 선택과 효과 지속 관리

#### 💡 해결 방법

```json
// augments.json - 구조화된 증강 정의
{
  "id": "독걸려랑",
  "effects": {
    "weapon": {
      "magazineDelta": -2,
      "reloadTimeDeltaMs": 1000
    },
    "bullet": {
      "poisonDps": 5,
      "poisonTicks": 3
    }
  }
}
```

### 3. **고성능 렌더링 시스템**

#### 🎯 도전 과제

- 60fps 유지하면서 복잡한 캐릭터 애니메이션
- 실시간 그림자 시스템과 파티클 효과
- 다양한 해상도에서의 일관된 성능

#### 💡 해결 방법

```typescript
// GameConstants.ts - 성능 최적화 설정
const PERFORMANCE_CONSTANTS = {
  TARGET_FPS: 60,
  MIN_FPS: 30,

  // 업데이트 주기 최적화
  UPDATE_INTERVALS: {
    EVERY_FRAME: 0,
    EVERY_SECOND: 1000,
    EVERY_5_SECONDS: 5000,
    EVERY_10_SECONDS: 10000,
  },

  // 메모리 관리
  MEMORY_THRESHOLDS: {
    WARNING: 100,
    CRITICAL: 200,
    MAX: 500,
  },

  // 오브젝트 정리 시스템
  CLEANUP: {
    BULLET_BUFFER: 100,
    MAX_BULLETS: 1000,
    MAX_PARTICLES: 500,
  },
};
```

### 4. **실시간 오디오 시스템**

#### 🎯 도전 과제

- 배경음악과 효과음의 동적 전환
- 멀티플레이어 환경에서의 오디오 동기화
- 브라우저별 오디오 API 호환성

#### 💡 해결 방법

```typescript
// BgmProvider.tsx - 컨텍스트 기반 오디오 관리
export const BgmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);

  // 실시간 오디오 전환 및 볼륨 제어
};
```

### 5. **반응형 UI/UX 설계**

#### 🎯 도전 과제

- 다양한 화면 크기에서의 최적화된 UI
- 실시간 게임 상태 표시와 모달 시스템
- 직관적인 컨트롤과 피드백

#### 💡 해결 방법

```typescript
// 크로스헤어 커서 - 고급 UI 요소
const CrosshairCursor = () => {
  // 글로우 효과가 있는 커스텀 크로스헤어
  // 실시간 마우스 추적과 시각적 피드백
};
```

## 🚀 주요 기술 스택

### Frontend

- **React 18** + **TypeScript** - 타입 안전한 컴포넌트 기반 개발
- **Phaser 3** - 고성능 2D 게임 엔진
- **Socket.IO Client** - 실시간 통신
- **Styled Components** - CSS-in-JS 스타일링

### Backend

- **Node.js** + **Express** - 서버 프레임워크
- **Socket.IO** - 실시간 양방향 통신
- **TypeScript** - 타입 안전한 서버 개발

### 개발 도구

- **Vite** - 빠른 개발 환경
- **ESLint** + **Prettier** - 코드 품질 관리
- **Git** - 버전 관리

## 🎮 게임 특징

### 핵심 메커닉

- **플랫폼 슈팅**: 점프, 벽 잡기, 앉기 등 다양한 이동
- **실시간 전투**: 정확한 조준과 타이밍이 중요한 총알 전투
- **팀워크**: 팀원과의 협력과 전략적 플레이
- **진화 시스템**: 라운드별 증강 선택으로 캐릭터 강화

### 시각적 효과

- **고급 애니메이션**: 캐릭터별 고유한 움직임과 포즈
- **실시간 그림자**: 동적인 조명과 그림자 시스템
- **파티클 효과**: 총알 발사, 충돌, 증강 효과 등
- **반응형 디자인**: 모든 디바이스에서 최적화된 경험

## 🏆 개발 성과

- **6일간의 집중 개발**로 완성도 높은 멀티플레이어 게임 구현
- **실시간 네트워크 동기화**로 부드러운 멀티플레이어 경험 제공
- **복잡한 증강 시스템**으로 전략적 깊이 확보
- **고성능 렌더링**으로 60fps 안정적 게임 플레이
- **반응형 디자인**으로 다양한 디바이스 지원

---

**개발 기간**: 6일 (크래프톤 정글 몰입형 웹 개발 캠프)  
**팀 구성**: 프론트엔드 2명, 백엔드 1명  
**기술 스택**: React, TypeScript, Phaser 3, Socket.IO, Node.js
