import {
  MatchInfo,
  MatchMakerPort,
} from "../application/port/out/MatchMakerPort";

type InfraNfcController = {
  startReadWrite: (argObj: object) => Promise<string>;
  startHce: (argObj: object) => Promise<string>;
  stop: (argObj: object) => Promise<string>;
};

export class NfcMatchMakerAdapter implements MatchMakerPort {
  constructor() {}

  isInitialized(): boolean {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return !!window.nfcController;
  }

  // TODO:
  findMatch(): Promise<MatchInfo> {
    return Promise.resolve({});
  }

  async testReadWrite(message: string): Promise<string> {
    // const receivedMessage = await this._getNfcController().readMessage({
    //   test: 123,
    // });
    const receivedMessage = await this._getNfcController().startReadWrite({
      message,
    });
    return `received message: ${receivedMessage}`;
  }

  async testHce(message: string): Promise<string> {
    const receivedMessage = await this._getNfcController().startHce({
      message,
    });
    return `received message: ${receivedMessage}`;
  }

  async testStop(): Promise<string> {
    const result = await this._getNfcController().stop({});
    return `stop: ${result}`;
  }

  private _getNfcController(): InfraNfcController {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.nfcController as InfraNfcController;
  }
}
