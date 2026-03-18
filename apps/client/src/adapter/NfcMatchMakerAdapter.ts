import type {
  MatchInfo,
  MatchMakerPort,
  MatchRequest,
} from "../application/port/out/MatchMakerPort";

type InfraNfcController = {
  startReadWrite: (argObj: object) => Promise<string>;
  startHce: (argObj: object) => Promise<string>;
  stop: (argObj: object) => Promise<string>;
};

export class NfcMatchMakerAdapter implements MatchMakerPort {
  // constructor() {}

  // isInitialized(): boolean {
  //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //   // @ts-ignore
  //   return !!window.nfcController;
  // }

  proposeMatch(matchRequest: MatchRequest): Promise<MatchInfo> {
    return new Promise((resolve, reject) => {
      this._getNfcController()
        .startReadWrite({ data: JSON.stringify(matchRequest) })
        .then((result: string) => {
          resolve(JSON.parse(result));
        })
        .catch((err: Error) => {
          reject(err);
        })
        .finally(() => {
          this._getNfcController().stop({});
        });
    });
  }

  receiveMatch(matchRequest: MatchRequest): Promise<MatchInfo> {
    return new Promise((resolve, reject) => {
      this._getNfcController()
        .startHce({ data: JSON.stringify(matchRequest) })
        .then((result: string) => {
          resolve(JSON.parse(result));
        })
        .catch((err: Error) => {
          reject(err);
        })
        .finally(() => {
          this._getNfcController().stop({});
        });
    });
  }

  async cancelMatch(): Promise<string> {
    return await this._getNfcController().stop({});
  }

  private _getNfcController(): InfraNfcController {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const controller = window.nfcController as InfraNfcController | undefined;

    if (!controller) {
      const errorMessage =
        "❌ NFC 기능을 사용할 수 없습니다.\n\n" +
        "이 기능은 Flutter 네이티브 앱에서만 동작합니다.\n" +
        "PC 브라우저 환경에서는 NFC 기능을 테스트할 수 없습니다.\n\n" +
        "네이티브 기능을 테스트하려면:\n" +
        "1. 터미널에서 'pnpm build:flutter' 실행\n" +
        "2. virtual_bridge 디렉터리에서 'flutter run' 실행";

      // 사용자에게 경고 표시
      alert(errorMessage);

      // 에러 던지기
      throw new Error(
        "NFC Controller is not available. This feature requires Flutter native app.",
      );
    }

    return controller;
  }
}
