# 저사양 게임 엔진 설정

## 개요

이 게임 엔진은 저사양 환경에서 최적의 성능을 발휘하도록 Pixi.js와 Matter.js를 결합하여 구성되었습니다.

## 설치 방법

```bash
npm install pixi.js matter-js
# TypeScript 타입 정의
npm install --save-dev @types/matter-js
```

## 기본 사용법

```typescript
import { Game } from "./game";

document.addEventListener("DOMContentLoaded", () => {
  // game-container라는 ID를 가진 HTML 요소에 게임을 마운트합니다
  const game = new Game("game-container");

  // 게임 정리가 필요할 때
  // game.destroy();
});
```

## 성능 최적화 팁

1. `antialias: false` 설정으로 렌더링 비용 절감
2. 불필요한 이벤트 리스너 최소화
3. 오브젝트 풀링 사용하여 가비지 컬렉션 최소화
4. 스프라이트 시트 활용으로 텍스처 로딩 최적화
5. Matter.js의 `enableSleeping: true` 설정으로 비활성 물체 계산 생략

## Phaser 대신 이 조합을 사용하는 이유

- 더 작은 번들 크기
- 필요한 기능만 선택적으로 사용 가능
- 더 세밀한 최적화 가능
