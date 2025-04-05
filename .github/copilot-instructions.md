이 프로젝트는 모바일 다마고찌 게임 컨셉을 가진 웹뷰기반 모바일앱 프로젝트입니다.

## virtual_bridge
* 이 디렉터리는 flutter로 되어있습니다.
* 웹뷰를 띄우고 웹뷰에서 사용할 네이티브 의존적인 기능들을 javascript channel로 제공합니다.

## apps
* 웹뷰에 띄워질 웹앱 구현이 있는 디렉터리입니다.
* apps/client는 react기반의 client ui들을 구현하는 워크스페이스입니다.
* apps/game은 다마고찌 게임로직들을 담고있는 게임 구현 워크스페이스입니다.
* apps/client내에 apps/game을 띄우고 있습니다.

## shared
* apps내에 여러 워크스페이스에서 공통으로 사용될만한 워크스페이스들을 추가하는 디렉터리입니다.


---

## code rules
* typescript any타입은 지양해야 합니다.