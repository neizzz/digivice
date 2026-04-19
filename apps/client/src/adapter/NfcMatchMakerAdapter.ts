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
        "❌ NFC is unavailable.\n\n" +
        "This feature only works in the Flutter native app.\n" +
        "You cannot test NFC in a desktop browser.\n\n" +
        "To test native features:\n" +
        "1. Run 'pnpm build:flutter' in the terminal\n" +
        "2. Run 'flutter run' inside the virtual_bridge directory";

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
