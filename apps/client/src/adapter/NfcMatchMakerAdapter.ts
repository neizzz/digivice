import {
  MatchInfo,
  MatchMakerPort,
} from "../application/port/out/MatchMakerPort";

type InfraNfcController = {
  readMessage: (argObj: object) => Promise<string>;
  writeMessage: (argObj: object) => Promise<string>;
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

  async testWrite(message: unknown): Promise<string> {
    // const receivedMessage = await this._getNfcController().readMessage({
    //   test: 123,
    // });
    console.log("testWrite:", message);
    const tagMessage = await this._getNfcController().writeMessage({
      message,
    });
    return `tag created with a message: "${tagMessage}"`;
  }

  async testRead(): Promise<string> {
    const receivedMessage = await this._getNfcController().readMessage({});
    return `onRead: ${receivedMessage}`;
  }

  async testStop(): Promise<string> {
    const receivedMessage = await this._getNfcController().stop({});
    return `onStop: ${receivedMessage}`;
  }

  private _getNfcController(): InfraNfcController {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.nfcController as InfraNfcController;
  }
}
