import { MatchInfo, MatchMaker } from "../application/port/out/MatchMaker";

type InfraNfcController = {
  readMessage: (argObj: object) => Promise<string>;
  writeMessage: (argObj: object) => Promise<string>;
};

export class NfcMatchMakerAdapter implements MatchMaker {
  constructor() {
    // NOTE: flutter의 javascript interface 초기화.
    // 페이지 로드 후에 실행되는것이 보장되도록 하기 위해 여기서 초기화 함수 호출.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.__initJavascriptInterfaces.postMessage("");
  }

  isInitialized(): boolean {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return !!window.nfcController;
  }

  // TODO:
  findMatch(): Promise<MatchInfo> {
    return Promise.resolve({});
  }

  async testWrite(): Promise<string> {
    // const receivedMessage = await this._getNfcController().readMessage({
    //   test: 123,
    // });
    const receivedMessage = await this._getNfcController().writeMessage({
      test: 123,
    });
    return `onWritten: ${receivedMessage}`;
    // this._getNfcController().writeMessage({ test: "str" });
  }

  async testRead() {
    // const receivedMessage = await this._getNfcController().readMessage({
    //   test: 123,
    // });

    const receivedMessage = await this._getNfcController().readMessage({
      test: 123,
    });
    // console.log("testRead:", receivedMessage);
    // this._getNfcController().writeMessage({ test: "str" });

    return `onRead: ${receivedMessage}`;
  }

  private _getNfcController(): InfraNfcController {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.nfcController as InfraNfcController;
  }
}
