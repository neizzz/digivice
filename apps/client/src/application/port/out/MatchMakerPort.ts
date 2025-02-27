// TODO: move to domain layer
export type MatchRequest = {
  // FIXME:TODO: 테스트용
  testMessage: string;
  /** TODO: 레벨, 전투력, 체력 등.. */
  // userName: string;
};
export type MatchInfo = {
  // TODO:
};

export interface MatchMakerPort {
  isInitialized: () => boolean;

  /**
   * Proposes a match to another user by sending the current user's information.
   * @param {MatchRequest} matchRequest - Contains the current user's information to send to potential matches.
   * @returns {Promise<MatchInfo>} A promise that resolves to the matched user's information.
   */
  proposeMatch: (matchRequest: MatchRequest) => Promise<MatchInfo>;

  /**
   * Receives a match proposal and returns the matched user's information.
   * @param {MatchRequest} matchRequest - Contains the current user's information for matching.
   * @returns {Promise<MatchInfo>} A promise that resolves to the matched user's information.
   */
  receiveMatch: (matchRequest: MatchRequest) => Promise<MatchInfo>;

  /**
   * Cancels an active match request or ongoing matching process.
   * @returns {Promise<string>} A promise that resolves to a status message regarding the cancellation.
   */
  cancelMatch: () => Promise<string>;
}
