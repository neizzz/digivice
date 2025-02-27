import {
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
  constructor() {}

  isInitialized(): boolean {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return !!window.nfcController;
  }

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
    return window.nfcController as InfraNfcController;
  }
}
