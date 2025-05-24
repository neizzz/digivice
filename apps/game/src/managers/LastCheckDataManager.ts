import { FlutterStorage, type Storage, WebLocalStorage } from "@shared/storage";
import { EventBus, EventTypes } from "../utils/EventBus";

export type LastCheckData = {
  _savedAt: number;
  stamina: number;
  sickness: number;
  evolutionGauge: number;
};

class _LastCheckDataManager {
  private data?: LastCheckData;
  private storage: Storage;
  private readonly LAST_CHECK_DATA_KEY = "digivice_last_check_data";
  private isInitialized = false;

  constructor() {
    if (typeof window !== "undefined" && "storageController" in window) {
      this.storage = new FlutterStorage();
    } else {
      this.storage = new WebLocalStorage();
    }
  }

  public initialize(): void {
    if (this.isInitialized) return;
    // this._setupEventListeners();
    this.isInitialized = true;
    console.log("[LastCheckDataManager] 초기화 완료.");
  }

  public async loadData(): Promise<LastCheckData | undefined> {
    if (this.data) return this.data;

    const savedData = await this.storage.getItem(this.LAST_CHECK_DATA_KEY);

    if (!savedData) {
      console.warn("마지막 체크 데이터가 없습니다.");
      return undefined;
    }

    try {
      this.data = JSON.parse(savedData) as LastCheckData;
      return this.data;
    } catch (e) {
      throw new Error(`마지막 체크 데이터 로드 실패: ${e}`);
    }
  }

  public _saveData(data: LastCheckData): LastCheckData {
    this.data = data;
    this.data._savedAt = Date.now();
    this.storage.setItem(this.LAST_CHECK_DATA_KEY, JSON.stringify(data));
    return this.data;
  }

  // FIXME: 리팩토링 포인트(GameDataManager 저장 로직이 상이함. 일관성 이슈.)
  // private _setupEventListeners(): void {
  //   EventBus.subscribe(
  //     EventTypes.Character.CHARACTER_STATUS_UPDATED,
  //     async ({ status }) => {
  //       // Update timestamps for the properties that were updated
  //       if (!this.data) {
  //         console.warn("[LastCheckDatManager] 마지막 체크 데이터가 없습니다.");
  //         return;
  //       }

  //       const now = Date.now();
  //       const updatedData = {
  //         ...this.data,
  //         _savedAt: now,
  //       };

  //       if (status.stamina) {
  //         updatedData.stamina = now;
  //       }

  //       if (status.sickness) {
  //         updatedData.sickness = now;
  //       }

  //       if (status.evolutionGauge !== undefined) {
  //         updatedData.evolutionGauge = now;
  //       }

  //       console.log(
  //         "[LastCheckDataManager] 데이터 업데이트:",
  //         JSON.stringify(
  //           {
  //             _savedAt: `${updatedData._savedAt} (${new Date(
  //               updatedData._savedAt
  //             ).toLocaleString()})`,
  //             stamina: `${updatedData.stamina} (${new Date(
  //               updatedData.stamina
  //             ).toLocaleString()})`,
  //             sickness: `${updatedData.sickness} (${new Date(
  //               updatedData.sickness
  //             ).toLocaleString()})`,
  //             evolutionGauge: `${updatedData.evolutionGauge} (${new Date(
  //               updatedData.evolutionGauge
  //             ).toLocaleString()})`,
  //           },
  //           null,
  //           2
  //         )
  //       );

  //       await this._saveData(updatedData).catch((e) => {
  //         console.error("[LastCheckDataManager] 데이터 저장 실패:", e);
  //       });
  //     }
  //   );
  // }

  public async createInitialData(): Promise<LastCheckData> {
    const initialData: LastCheckData = {
      _savedAt: Date.now(),
      stamina: Date.now(),
      sickness: Date.now(),
      evolutionGauge: Date.now(),
    };

    return await this._saveData(initialData);
  }
}

export const LastCheckDataManager = new _LastCheckDataManager();
