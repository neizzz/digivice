import { MatchInfo, MatchMaker } from "../application/port/out/MatchMaker";

type InfraNfcController = {
  readMessage: (argObj: object) => void;
  writeMessage: (argObj: object) => void;
};

export class NfcMatchMakerAdapter implements MatchMaker {
  constructor() {
    // NOTE: flutter의 javascript interface 초기화.
    // 페이지 로드 후에 실행되는것이 보장되도록 하기 위해 여기서 초기화 함수 호출.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.__initJavascriptInterfaces.postMessage("");
  }

  // TODO:
  findMatch(): Promise<MatchInfo> {
    return Promise.resolve({});
  }

  test() {
    this._getNfcController().readMessage({ test: 123 });
    this._getNfcController().writeMessage({ test: "str" });
  }

  private _getNfcController(): InfraNfcController {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.nfcController as InfraNfcController;
  }
}
