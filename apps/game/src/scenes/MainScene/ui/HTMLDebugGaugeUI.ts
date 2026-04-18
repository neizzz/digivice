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
import { ObjectType, SleepMode, SleepReason } from "../types";
import { calculateDiseaseRate } from "../systems/DiseaseSystem";
import {
  getRemainingEvolutionGaugeTime,
  getRemainingStaminaDecreaseTime,
} from "../systems/CharacterManageSystem";
import { GAME_CONSTANTS } from "../config";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);

export class HTMLDebugGaugeUI {
  private _container: HTMLDivElement;
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

  constructor(world: MainSceneWorld, parentElement: HTMLElement) {
    this._world = world;
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
      left: 100px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 5px;
      padding: 10px;
      z-index: 998;
      font-family: 'Arial', sans-serif;
      color: white;
      font-size: 12px;
      min-width: 120px;
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
    const staminaDiv = document.createElement("div");

    const staminaLabel = document.createElement("span");
    staminaLabel.textContent = "Stamina: ";
    staminaLabel.style.cssText = `
      color: #66ccff;
    `;

    this._staminaText = document.createElement("span");
    this._staminaText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    staminaDiv.appendChild(staminaLabel);
    staminaDiv.appendChild(this._staminaText);

    const evolutionDiv = document.createElement("div");

    const evolutionLabel = document.createElement("span");
    evolutionLabel.textContent = "Evolution: ";
    evolutionLabel.style.cssText = `
      color: #ffcc66;
    `;

    this._evolutionText = document.createElement("span");
    this._evolutionText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    evolutionDiv.appendChild(evolutionLabel);
    evolutionDiv.appendChild(this._evolutionText);

    const digestiveDiv = document.createElement("div");

    const digestiveLabel = document.createElement("span");
    digestiveLabel.textContent = "Digestive: ";
    digestiveLabel.style.cssText = `
      color: #66ff66;
    `;

    this._digestiveText = document.createElement("span");
    this._digestiveText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    digestiveDiv.appendChild(digestiveLabel);
    digestiveDiv.appendChild(this._digestiveText);

    const diseaseRateDiv = document.createElement("div");

    const diseaseRateLabel = document.createElement("span");
    diseaseRateLabel.textContent = "Disease: ";
    diseaseRateLabel.style.cssText = `
      color: #ff8888;
    `;

    this._diseaseRateText = document.createElement("span");
    this._diseaseRateText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    diseaseRateDiv.appendChild(diseaseRateLabel);
    diseaseRateDiv.appendChild(this._diseaseRateText);

    const deathTimeDiv = document.createElement("div");

    const deathTimeLabel = document.createElement("span");
    deathTimeLabel.textContent = "Death: ";
    deathTimeLabel.style.cssText = `
      color: #ff6666;
    `;

    this._deathTimeText = document.createElement("span");
    this._deathTimeText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    deathTimeDiv.appendChild(deathTimeLabel);
    deathTimeDiv.appendChild(this._deathTimeText);

    const sleepDiv = document.createElement("div");

    const sleepLabel = document.createElement("span");
    sleepLabel.textContent = "Sleep: ";
    sleepLabel.style.cssText = `
      color: #b388ff;
    `;

    this._sleepText = document.createElement("span");
    this._sleepText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    sleepDiv.appendChild(sleepLabel);
    sleepDiv.appendChild(this._sleepText);

    const fatigueDiv = document.createElement("div");

    const fatigueLabel = document.createElement("span");
    fatigueLabel.textContent = "Fatigue: ";
    fatigueLabel.style.cssText = `
      color: #cda4ff;
    `;

    this._fatigueText = document.createElement("span");
    this._fatigueText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    fatigueDiv.appendChild(fatigueLabel);
    fatigueDiv.appendChild(this._fatigueText);

    const sleepCheckDiv = document.createElement("div");

    const sleepCheckLabel = document.createElement("span");
    sleepCheckLabel.textContent = "SleepChk: ";
    sleepCheckLabel.style.cssText = `
      color: #d8b4fe;
    `;

    this._sleepCheckText = document.createElement("span");
    this._sleepCheckText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    sleepCheckDiv.appendChild(sleepCheckLabel);
    sleepCheckDiv.appendChild(this._sleepCheckText);

    this._container.appendChild(staminaDiv);
    this._container.appendChild(evolutionDiv);
    this._container.appendChild(digestiveDiv);
    this._container.appendChild(diseaseRateDiv);
    this._container.appendChild(deathTimeDiv);
    this._container.appendChild(sleepDiv);
    this._container.appendChild(fatigueDiv);
    this._container.appendChild(sleepCheckDiv);
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

      digestiveText = `${currentLoad.toFixed(1)}/${capacity}`;

      if (nextPoopTime > 0) {
        const remainingTime = Math.max(0, nextPoopTime - currentTime);
        const seconds = Math.ceil(remainingTime / 1000);

        if (remainingTime > 0) {
          digestiveText += ` (💩${seconds}s)`;
        } else {
          digestiveText += ` (💩NOW!)`;
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
        `nap:${formatRemainingSeconds(nextNapCheckRemaining)} ` +
        `night:${formatRemainingSeconds(nextNightWakeCheckRemaining)} ` +
        `ps:${formatSleepReason(pendingSleepReason)} ` +
        `pw:${formatSleepReason(pendingWakeReason)}`;
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

      if (nextPoopTime > 0) {
        const remainingTime = Math.max(0, nextPoopTime - currentTime);

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
    this._container.style.display = "block";
  }

  public hide(): void {
    this._container.style.display = "none";
  }

  public destroy(): void {
    if (this._container.parentElement) {
      this._container.parentElement.removeChild(this._container);
    }
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

function formatRemainingSeconds(remainingTime: number): string {
  if (remainingTime <= 0) {
    return "-";
  }

  return `${Math.ceil(remainingTime / 1000)}s`;
}
