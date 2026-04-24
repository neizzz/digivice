import { MainSceneWorld } from "../world";
import { defineQuery, hasComponent } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  DigestiveSystemComp,
  DiseaseSystemComp,
  SleepSystemComp,
  VitalityComp,
} from "../raw-components";
import { CharacterState, ObjectType, SleepMode, SleepReason } from "../types";
import { calculateDiseaseRate } from "../systems/DiseaseSystem";
import {
  getRemainingEvolutionGaugeTime,
  getRemainingStaminaDecreaseTime,
} from "../systems/CharacterManageSystem";
import { GAME_CONSTANTS } from "../config";
import { TimeOfDay } from "../timeOfDay";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);

type HTMLDebugGaugeUIOptions = {
  initiallyVisible?: boolean;
};

export class HTMLDebugGaugeUI {
  private _container: HTMLDivElement;
  private _primaryColumn!: HTMLDivElement;
  private _sleepColumn!: HTMLDivElement;
  private _world: MainSceneWorld;
  private _staminaText!: HTMLSpanElement;
  private _evolutionText!: HTMLSpanElement;
  private _digestiveText!: HTMLSpanElement;
  private _diseaseRateText!: HTMLSpanElement;
  private _deathTimeText!: HTMLSpanElement;
  private _sleepText!: HTMLSpanElement;
  private _fatigueText!: HTMLSpanElement;
  private _sleepCheckText!: HTMLSpanElement;
  private _currentCharacterEid: number = -1;
  private _isVisible: boolean;

  constructor(
    world: MainSceneWorld,
    parentElement: HTMLElement,
    options: HTMLDebugGaugeUIOptions = {},
  ) {
    this._world = world;
    this._isVisible = options.initiallyVisible ?? true;
    this._container = this._createContainer();
    this._setupUI();
    this._findFirstCharacter();

    parentElement.appendChild(this._container);
  }

  private _createContainer(): HTMLDivElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      top: 4px;
      left: 4px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 5px;
      padding: 10px;
      z-index: 998;
      font-family: 'Arial', sans-serif;
      color: white;
      font-size: 12px;
      min-width: 280px;
      display: ${this._isVisible ? "flex" : "none"};
      align-items: flex-start;
      gap: 16px;
      padding-top: 28px;
    `;

    if (!document.querySelector("#debug-gauge-ui-blink-style")) {
      const style = document.createElement("style");
      style.id = "debug-gauge-ui-blink-style";
      style.textContent = `
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `;
      document.head.appendChild(style);
    }

    return container;
  }

  private _setupUI(): void {
    const closeButton = this._createCloseButton();
    this._primaryColumn = this._createColumn();
    this._sleepColumn = this._createColumn();

    const staminaDiv = this._createMetricRow("Stamina: ", "#66ccff");

    this._staminaText = this._createMetricValue();
    staminaDiv.appendChild(this._staminaText);

    const evolutionDiv = this._createMetricRow("Evolution: ", "#ffcc66");

    this._evolutionText = this._createMetricValue();
    evolutionDiv.appendChild(this._evolutionText);

    const digestiveDiv = this._createMetricRow("Digestive: ", "#66ff66");

    this._digestiveText = this._createMetricValue();
    digestiveDiv.appendChild(this._digestiveText);

    const diseaseRateDiv = this._createMetricRow("Disease: ", "#ff8888");

    this._diseaseRateText = this._createMetricValue();
    diseaseRateDiv.appendChild(this._diseaseRateText);

    const deathTimeDiv = this._createMetricRow("Death: ", "#ff6666");

    this._deathTimeText = this._createMetricValue();
    deathTimeDiv.appendChild(this._deathTimeText);

    const sleepDiv = this._createMetricRow("Sleep: ", "#b388ff");

    this._sleepText = this._createMetricValue();
    sleepDiv.appendChild(this._sleepText);

    const fatigueDiv = this._createMetricRow("Fatigue: ", "#cda4ff");

    this._fatigueText = this._createMetricValue();
    fatigueDiv.appendChild(this._fatigueText);

    const sleepCheckDiv = this._createMetricRow("SleepChk:", "#d8b4fe");
    sleepCheckDiv.style.alignItems = "flex-start";
    sleepCheckDiv.style.flexDirection = "column";
    sleepCheckDiv.style.gap = "4px";

    this._sleepCheckText = this._createMetricValue();
    this._sleepCheckText.style.whiteSpace = "pre-wrap";
    this._sleepCheckText.style.lineHeight = "1.45";
    sleepCheckDiv.appendChild(this._sleepCheckText);

    this._primaryColumn.appendChild(staminaDiv);
    this._primaryColumn.appendChild(evolutionDiv);
    this._primaryColumn.appendChild(digestiveDiv);
    this._primaryColumn.appendChild(diseaseRateDiv);
    this._primaryColumn.appendChild(deathTimeDiv);

    this._sleepColumn.appendChild(sleepDiv);
    this._sleepColumn.appendChild(fatigueDiv);
    this._sleepColumn.appendChild(sleepCheckDiv);

    this._container.appendChild(closeButton);
    this._container.appendChild(this._primaryColumn);
    this._container.appendChild(this._sleepColumn);
  }

  private _createCloseButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "×";
    button.setAttribute("aria-label", "Close debug gauge UI");
    button.style.cssText = `
      position: absolute;
      top: 6px;
      right: 6px;
      width: 22px;
      height: 22px;
      padding: 0;
      background: rgba(80, 80, 80, 0.85);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: bold;
      line-height: 1;
      cursor: pointer;
    `;

    button.addEventListener("click", () => {
      this.hide();
    });

    return button;
  }

  private _findFirstCharacter(): void {
    const characters = characterQuery(this._world);

    for (let i = 0; i < characters.length; i++) {
      const eid = characters[i];
      if (ObjectComp.type[eid] === ObjectType.CHARACTER) {
        this._currentCharacterEid = eid;
        console.log(`[HTMLDebugGaugeUI] Found character entity: ${eid}`);
        return;
      }
    }

    console.warn("[HTMLDebugGaugeUI] No character entity found");
    this._currentCharacterEid = -1;
  }

  public update(): void {
    if (this._currentCharacterEid < 0) {
      this._findFirstCharacter();
      if (this._currentCharacterEid < 0) {
        this._staminaText.textContent = "N/A";
        this._evolutionText.textContent = "N/A";
        this._digestiveText.textContent = "N/A";
        this._diseaseRateText.textContent = "N/A";
        this._deathTimeText.textContent = "N/A";
        this._sleepText.textContent = "N/A";
        this._fatigueText.textContent = "N/A";
        this._sleepCheckText.textContent = "N/A";
        return;
      }
    }

    const currentTime = this._world.currentTime;
    const stamina = CharacterStatusComp.stamina[this._currentCharacterEid] || 0;
    const evolutionGauge =
      CharacterStatusComp.evolutionGage[this._currentCharacterEid] || 0;
    const remainingStaminaTime = getRemainingStaminaDecreaseTime(
      this._currentCharacterEid,
    );
    const remainingEvolutionTime = getRemainingEvolutionGaugeTime(
      this._currentCharacterEid,
    );

    let digestiveText = "N/A";
    if (
      hasComponent(this._world, DigestiveSystemComp, this._currentCharacterEid)
    ) {
      const currentLoad =
        DigestiveSystemComp.currentLoad[this._currentCharacterEid];
      const capacity = DigestiveSystemComp.capacity[this._currentCharacterEid];
      const nextPoopTime =
        DigestiveSystemComp.nextPoopTime[this._currentCharacterEid] || 0;
      const nextSmallPoopTime =
        DigestiveSystemComp.nextSmallPoopTime[this._currentCharacterEid] || 0;

      digestiveText = `${currentLoad.toFixed(1)}/${capacity}`;

      const activePoopTime =
        nextPoopTime > 0 ? nextPoopTime : nextSmallPoopTime;
      const poopLabel = nextPoopTime > 0 ? "💩" : "·💩";

      if (activePoopTime > 0) {
        const remainingTime = Math.max(0, activePoopTime - currentTime);
        const seconds = Math.ceil(remainingTime / 1000);

        if (remainingTime > 0) {
          digestiveText += ` (${poopLabel}${seconds}s)`;
        } else {
          digestiveText += ` (${poopLabel}NOW!)`;
        }
      }
    }

    const diseaseRate = calculateDiseaseRate(
      this._world,
      this._currentCharacterEid,
    ).rate;
    const nextDiseaseCheckTime = hasComponent(
      this._world,
      DiseaseSystemComp,
      this._currentCharacterEid,
    )
      ? DiseaseSystemComp.nextCheckTime[this._currentCharacterEid]
      : 0;
    const remainingDiseaseTime = Math.max(0, nextDiseaseCheckTime - currentTime);
    const deathTime = hasComponent(
      this._world,
      VitalityComp,
      this._currentCharacterEid,
    )
      ? VitalityComp.deathTime[this._currentCharacterEid]
      : 0;
    const remainingDeathTime = deathTime > 0 ? Math.max(0, deathTime - currentTime) : 0;
    const hasSleepSystem = hasComponent(
      this._world,
      SleepSystemComp,
      this._currentCharacterEid,
    );

    let sleepText = "N/A";
    let fatigueText = "N/A";
    let sleepCheckText = "N/A";

    if (hasSleepSystem) {
      const sleepMode = SleepSystemComp.sleepMode[this._currentCharacterEid];
      const nextSleepTime = SleepSystemComp.nextSleepTime[this._currentCharacterEid] || 0;
      const nextWakeTime = SleepSystemComp.nextWakeTime[this._currentCharacterEid] || 0;
      const nextNapCheckTime =
        SleepSystemComp.nextNapCheckTime[this._currentCharacterEid] || 0;
      const nextNightWakeCheckTime =
        SleepSystemComp.nextNightWakeCheckTime[this._currentCharacterEid] || 0;
      const pendingSleepReason =
        SleepSystemComp.pendingSleepReason[this._currentCharacterEid];
      const pendingWakeReason =
        SleepSystemComp.pendingWakeReason[this._currentCharacterEid];
      const fatigue = SleepSystemComp.fatigue[this._currentCharacterEid] || 0;
      const currentTimeOfDay = this._world.getTimeOfDay();

      const nextSleepRemaining =
        nextSleepTime > 0 ? Math.max(0, nextSleepTime - currentTime) : 0;
      const nextWakeRemaining =
        nextWakeTime > 0 ? Math.max(0, nextWakeTime - currentTime) : 0;
      const nextNapCheckRemaining =
        nextNapCheckTime > 0 ? Math.max(0, nextNapCheckTime - currentTime) : 0;
      const nextNightWakeCheckRemaining =
        nextNightWakeCheckTime > 0
          ? Math.max(0, nextNightWakeCheckTime - currentTime)
          : 0;

      sleepText = `${formatSleepMode(sleepMode)} | sleep:${formatRemainingSeconds(
        nextSleepRemaining,
      )} wake:${formatRemainingSeconds(nextWakeRemaining)}`;
      fatigueText = `${fatigue.toFixed(1)}/${GAME_CONSTANTS.FATIGUE_MAX}`;
      sleepCheckText =
        `  nap: ${formatNapCheckStatus({
          currentTime,
          currentTimeOfDay,
          state: ObjectComp.state[this._currentCharacterEid],
          nextNapCheckTime,
          nextSleepTime,
          fatigue,
          fatigueThreshold: GAME_CONSTANTS.FATIGUE_DAY_NAP_MIN_THRESHOLD,
        })}\n` +
        `  night: ${formatSleepCheckCountdown(
          nextNightWakeCheckTime,
          currentTime,
        )}\n` +
        `  ps: ${formatSleepCheckReason(pendingSleepReason)}\n` +
        `  pw: ${formatSleepCheckReason(pendingWakeReason)}`;
    }

    this._staminaText.textContent = `${stamina}/10 (${Math.ceil(
      remainingStaminaTime / 1000,
    )}s)`;
    this._evolutionText.textContent =
      remainingEvolutionTime === null
        ? `${evolutionGauge.toFixed(1)}/100.0 (paused)`
        : `${evolutionGauge.toFixed(1)}/100.0 (${Math.ceil(
            remainingEvolutionTime / 1000,
          )}s)`;
    this._digestiveText.textContent = digestiveText;
    this._diseaseRateText.textContent = `${(diseaseRate * 100).toFixed(
      1,
    )}% (${Math.ceil(remainingDiseaseTime / 1000)}s)`;
    this._deathTimeText.textContent =
      deathTime > 0
        ? `${Math.ceil(remainingDeathTime / 1000)}s`
        : "N/A";
    this._sleepText.textContent = sleepText;
    this._fatigueText.textContent = fatigueText;
    this._sleepCheckText.textContent = sleepCheckText;

    if (
      hasComponent(this._world, DigestiveSystemComp, this._currentCharacterEid)
    ) {
      const nextPoopTime =
        DigestiveSystemComp.nextPoopTime[this._currentCharacterEid] || 0;
      const nextSmallPoopTime =
        DigestiveSystemComp.nextSmallPoopTime[this._currentCharacterEid] || 0;
      const activePoopTime =
        nextPoopTime > 0 ? nextPoopTime : nextSmallPoopTime;

      if (activePoopTime > 0) {
        const remainingTime = Math.max(0, activePoopTime - currentTime);

        if (remainingTime <= 0) {
          this._digestiveText.style.color = "#ff0000";
          this._digestiveText.style.animation = "blink 1s infinite";
        } else if (remainingTime <= 3000) {
          this._digestiveText.style.color = "#ff8800";
          this._digestiveText.style.animation = "none";
        } else {
          this._digestiveText.style.color = "white";
          this._digestiveText.style.animation = "none";
        }
      } else {
        this._digestiveText.style.color = "white";
        this._digestiveText.style.animation = "none";
      }
    }

    if (diseaseRate >= 0.1) {
      this._diseaseRateText.style.color = "#ff5555";
    } else if (diseaseRate >= 0.05) {
      this._diseaseRateText.style.color = "#ffbb33";
    } else {
      this._diseaseRateText.style.color = "white";
    }

    if (deathTime > 0) {
      if (remainingDeathTime <= 0) {
        this._deathTimeText.style.color = "#ff0000";
        this._deathTimeText.style.animation = "blink 1s infinite";
      } else if (remainingDeathTime <= 10000) {
        this._deathTimeText.style.color = "#ff8800";
        this._deathTimeText.style.animation = "none";
      } else {
        this._deathTimeText.style.color = "white";
        this._deathTimeText.style.animation = "none";
      }
    } else {
      this._deathTimeText.style.color = "white";
      this._deathTimeText.style.animation = "none";
    }

    if (hasSleepSystem) {
      const sleepMode = SleepSystemComp.sleepMode[this._currentCharacterEid];
      const fatigue = SleepSystemComp.fatigue[this._currentCharacterEid] || 0;

      this._sleepText.style.color =
        sleepMode === SleepMode.AWAKE ? "white" : "#c084fc";
      this._sleepText.style.animation =
        sleepMode === SleepMode.NIGHT_SLEEP ? "blink 1.5s infinite" : "none";

      if (fatigue >= GAME_CONSTANTS.FATIGUE_DAY_NAP_MIN_THRESHOLD) {
        this._fatigueText.style.color = "#ffbb33";
      } else {
        this._fatigueText.style.color = "white";
      }

      this._sleepCheckText.style.color = "#dddddd";
      this._sleepCheckText.style.animation = "none";
    } else {
      this._sleepText.style.color = "white";
      this._sleepText.style.animation = "none";
      this._fatigueText.style.color = "white";
      this._fatigueText.style.animation = "none";
      this._sleepCheckText.style.color = "white";
      this._sleepCheckText.style.animation = "none";
    }
  }

  public show(): void {
    this._container.style.display = "flex";
    this._isVisible = true;
  }

  public hide(): void {
    this._container.style.display = "none";
    this._isVisible = false;
  }

  public destroy(): void {
    if (this._container.parentElement) {
      this._container.parentElement.removeChild(this._container);
    }
  }

  private _createColumn(): HTMLDivElement {
    const column = document.createElement("div");
    column.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
    `;
    return column;
  }

  private _createMetricRow(labelText: string, labelColor: string): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      align-items: baseline;
      gap: 4px;
    `;

    const label = document.createElement("span");
    label.textContent = labelText;
    label.style.color = labelColor;
    row.appendChild(label);

    return row;
  }

  private _createMetricValue(): HTMLSpanElement {
    const value = document.createElement("span");
    value.style.cssText = `
      color: white;
      font-weight: bold;
    `;
    return value;
  }
}

function formatSleepMode(mode: number): string {
  switch (mode) {
    case SleepMode.NIGHT_SLEEP:
      return "night";
    case SleepMode.DAY_NAP:
      return "nap";
    case SleepMode.INTERRUPTED_AWAKE:
      return "awake*";
    case SleepMode.AWAKE:
    default:
      return "awake";
  }
}

function formatSleepReason(reason: number): string {
  switch (reason) {
    case SleepReason.NIGHT:
      return "night";
    case SleepReason.RESLEEP:
      return "resleep";
    case SleepReason.NAP:
      return "nap";
    case SleepReason.SUNRISE:
      return "sunrise";
    case SleepReason.NIGHT_INTERRUPT:
      return "interrupt";
    case SleepReason.NONE:
    default:
      return "-";
  }
}

function formatSleepCheckReason(reason: number): string {
  if (reason === SleepReason.NONE) {
    return "inactive";
  }

  return formatSleepReason(reason);
}

function formatRemainingSeconds(remainingTime: number): string {
  if (remainingTime <= 0) {
    return "-";
  }

  return `${Math.ceil(remainingTime / 1000)}s`;
}

function formatSleepCheckCountdown(
  scheduledTime: number,
  currentTime: number,
): string {
  if (scheduledTime <= 0) {
    return "inactive";
  }

  const remainingTime = scheduledTime - currentTime;
  if (remainingTime <= 0) {
    return "ready";
  }

  return `${Math.ceil(remainingTime / 1000)}s`;
}

function formatNapCheckStatus(params: {
  currentTime: number;
  currentTimeOfDay: TimeOfDay;
  state: number;
  nextNapCheckTime: number;
  nextSleepTime: number;
  fatigue: number;
  fatigueThreshold: number;
}): string {
  const {
    currentTime,
    currentTimeOfDay,
    state,
    nextNapCheckTime,
    nextSleepTime,
    fatigue,
    fatigueThreshold,
  } = params;

  if (nextNapCheckTime <= 0) {
    return "inactive";
  }

  if (currentTimeOfDay !== TimeOfDay.Day) {
    return `blocked:${currentTimeOfDay}`;
  }

  if (state === CharacterState.SLEEPING) {
    return "blocked:sleeping";
  }

  if (nextSleepTime > 0) {
    return "blocked:reserved";
  }

  if (fatigue < fatigueThreshold) {
    return "blocked:fatigue";
  }

  return formatSleepCheckCountdown(nextNapCheckTime, currentTime);
}
