import {
  NAME_LABEL_FILL_COLOR,
  NAME_LABEL_FONT_FAMILIES,
  NAME_LABEL_FONT_WEIGHT,
  NAME_LABEL_STROKE_COLOR,
  NAME_LABEL_STROKE_WIDTH,
  type MainCharacterInfoSnapshot,
} from "@digivice/game";
import { DEFAULT_LOCALE, TRANSLATIONS } from "@shared/i18n";
import type React from "react";
import PopupLayer from "../components/PopupLayer";
import { useI18n } from "../i18n";

const STAMINA_LOW_COLOR = "#E2554B";
const STAMINA_MID_COLOR = "#F2A33A";
const STAMINA_HIGH_COLOR = "#49A95D";
const EVOLUTION_FILL_COLOR = "#59B8FF";
const MONSTER_INFO_TITLE_KEY = "monsterInfo.title";
const DOM_NAME_LABEL_STROKE_WIDTH = Math.max(1, NAME_LABEL_STROKE_WIDTH / 2);

function colorNumberToCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function createNameLabelTextShadow(strokeColor: string, strokeWidth: number): string {
  const shadowOffsets = new Set<string>();

  for (let offset = 1; offset <= strokeWidth; offset += 1) {
    shadowOffsets.add(`${offset}px 0 ${strokeColor}`);
    shadowOffsets.add(`-${offset}px 0 ${strokeColor}`);
    shadowOffsets.add(`0 ${offset}px ${strokeColor}`);
    shadowOffsets.add(`0 -${offset}px ${strokeColor}`);
    shadowOffsets.add(`${offset}px ${offset}px ${strokeColor}`);
    shadowOffsets.add(`-${offset}px ${offset}px ${strokeColor}`);
    shadowOffsets.add(`${offset}px -${offset}px ${strokeColor}`);
    shadowOffsets.add(`-${offset}px -${offset}px ${strokeColor}`);
  }

  return Array.from(shadowOffsets).join(", ");
}

function splitMonsterInfoTitleTemplate(locale: string): {
  hasNamePlaceholder: boolean;
  before: string;
  after: string;
} {
  const template =
    TRANSLATIONS[locale as keyof typeof TRANSLATIONS]?.[MONSTER_INFO_TITLE_KEY] ??
    TRANSLATIONS[DEFAULT_LOCALE][MONSTER_INFO_TITLE_KEY];
  const placeholderIndex = template.indexOf("{name}");

  if (placeholderIndex < 0) {
    return {
      hasNamePlaceholder: false,
      before: template,
      after: "",
    };
  }

  return {
    hasNamePlaceholder: true,
    before: template.slice(0, placeholderIndex),
    after: template.slice(placeholderIndex + "{name}".length),
  };
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function getStaminaFillColor(snapshot: MainCharacterInfoSnapshot): string {
  if (snapshot.stamina < snapshot.unhappyThreshold) {
    return STAMINA_LOW_COLOR;
  }

  if (snapshot.stamina < snapshot.boostedThreshold) {
    return STAMINA_MID_COLOR;
  }

  return STAMINA_HIGH_COLOR;
}

const StatusBar: React.FC<{
  label: string;
  currentValue: number;
  maxValue: number;
  fillColor: string;
}> = ({ label, currentValue, maxValue, fillColor }) => {
  const percent = clampUnitInterval(
    maxValue > 0 ? currentValue / maxValue : 0,
  );

  return (
    <div className="flex flex-col gap-2 text-left">
      <div className="text-[1.2rem] leading-[1.2] text-[#222]">{label}</div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={maxValue}
        aria-valuenow={Math.max(0, currentValue)}
        className="h-5 overflow-hidden border-2 border-[#222] bg-[#6f6f6f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]"
      >
        <div
          className="h-full border-r-2 border-[#222]/25 transition-[width] duration-150 ease-linear"
          style={{
            width: `${percent * 100}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>
    </div>
  );
};

const NameTitleText: React.FC<{
  text: string;
  fillColor: string;
  strokeColor: string;
}> = ({ text, fillColor, strokeColor }) => {
  const nameTitleTextStyle: React.CSSProperties = {
    fontFamily: NAME_LABEL_FONT_FAMILIES
      .map((fontFamily) =>
        fontFamily.includes(" ") ? `"${fontFamily}"` : fontFamily,
      )
      .join(", "),
    fontWeight: NAME_LABEL_FONT_WEIGHT,
  };
  const nameTitleOutlineStyle: React.CSSProperties = {
    ...nameTitleTextStyle,
    color: "transparent",
    textShadow: createNameLabelTextShadow(
      strokeColor,
      DOM_NAME_LABEL_STROKE_WIDTH,
    ),
  };
  const nameTitleFillStyle: React.CSSProperties = {
    ...nameTitleTextStyle,
    color: fillColor,
  };

  return (
    <span className="relative inline-block align-baseline">
      <span aria-hidden="true" className="opacity-0" style={nameTitleFillStyle}>
        {text}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={nameTitleOutlineStyle}
      >
        {text}
      </span>
      <span
        className="pointer-events-none absolute inset-0"
        style={nameTitleFillStyle}
      >
        {text}
      </span>
    </span>
  );
};

export interface MonsterInfoLayerProps {
  snapshot: MainCharacterInfoSnapshot;
  onClose: () => void;
  onBack?: () => void;
}

const MonsterInfoLayer: React.FC<MonsterInfoLayerProps> = ({
  snapshot,
  onClose,
  onBack,
}) => {
  const { locale, t } = useI18n();
  const levelText = snapshot.isEgg
    ? t("monsterInfo.levelEgg")
    : t("monsterInfo.levelPhase", { phase: snapshot.evolutionPhase });
  const titleText = t(MONSTER_INFO_TITLE_KEY, { name: snapshot.monsterName });
  const titleTemplate = splitMonsterInfoTitleTemplate(locale);
  const nameLabelFillColor = colorNumberToCssHex(NAME_LABEL_FILL_COLOR);
  const nameLabelStrokeColor = colorNumberToCssHex(NAME_LABEL_STROKE_COLOR);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <PopupLayer
        title={titleText}
        titleContent={
          titleTemplate.hasNamePlaceholder ? (
            <>
              {titleTemplate.before}
              <NameTitleText
                text={snapshot.monsterName}
                fillColor={nameLabelFillColor}
                strokeColor={nameLabelStrokeColor}
              />
              {titleTemplate.after}
            </>
          ) : (
            titleText
          )
        }
        content={
          <div className="flex flex-col gap-5 px-5 text-left">
            <div className="flex items-end justify-between gap-3">
              <div className="text-[1.2rem] leading-[1.2] text-[#222]">
                {t("monsterInfo.level")}
              </div>
              <div className="text-[1.3rem] leading-none font-bold text-component-positive">
                {levelText}
              </div>
            </div>
            <StatusBar
              label={t("monsterInfo.stamina")}
              currentValue={snapshot.stamina}
              maxValue={snapshot.maxStamina}
              fillColor={getStaminaFillColor(snapshot)}
            />
            <StatusBar
              label={t("monsterInfo.evolution")}
              currentValue={snapshot.evolutionGauge}
              maxValue={snapshot.maxEvolutionGauge}
              fillColor={EVOLUTION_FILL_COLOR}
            />
          </div>
        }
        onConfirm={onClose}
        onBack={onBack ?? onClose}
        confirmText={t("common.close")}
      />
    </div>
  );
};

export default MonsterInfoLayer;
