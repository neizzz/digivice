// TODO: move to domain layer
export type MatchRequest = {
  userName: string;
  /** TODO: 레벨, 전투력, 체력 등.. */
};
export type MatchInfo = {};

export interface MatchMakerPort {
  isInitialized: () => boolean;
  findMatch: (matchRequest: MatchRequest) => Promise<MatchInfo>;
}
