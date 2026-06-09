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
const GENE_SYMBOL_SPRITE_URL = "/assets/game/sprites/gene-symbol.png";
const GENE_SYMBOL_BACKGROUND_POSITION_BY_LINE: Record<
  NonNullable<MainCharacterInfoSnapshot["geneLine"]>,
  string
> = {
  "green-slime": "0% 0",
  "skull-slime": "50% 0",
  "soil-slime": "100% 0",
};

type GeneOutcome = MainCharacterInfoSnapshot["geneOutcomes"][number];

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

function formatEggHatchRemainingTime(remainingMs: number | null): string {
  const safeRemainingMs =
    typeof remainingMs === "number" && Number.isFinite(remainingMs)
      ? Math.max(0, remainingMs)
      : 0;
  const totalSeconds = Math.floor(safeRemainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatGeneOutcomeProbability(
  probability: number,
  locale: string,
  fractionDigits?: number,
): string {
  const safeProbability = clampUnitInterval(probability);
  const fixedFractionDigits =
    typeof fractionDigits === "number" && Number.isFinite(fractionDigits)
      ? Math.max(0, fractionDigits)
      : null;
  const maximumFractionDigits =
    fixedFractionDigits ??
    (safeProbability > 0 && safeProbability < 0.1 ? 2 : 1);

  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fixedFractionDigits ?? 0,
    maximumFractionDigits,
  }).format(safeProbability);
}

function getEvolutionGaugeDescriptionKey(
  snapshot: MainCharacterInfoSnapshot,
):
  | "monsterInfo.evolutionPausedSick"
  | "monsterInfo.evolutionPausedLowStamina"
  | null {
  switch (snapshot.evolutionGaugeState) {
    case "paused_sick":
      return "monsterInfo.evolutionPausedSick";
    case "paused_low_stamina":
      return "monsterInfo.evolutionPausedLowStamina";
    case "charging":
    case "unavailable":
      return null;
  }

  return null;
}

const StatusBar: React.FC<{
  label: string;
  currentValue: number;
  maxValue: number;
  fillColor: string;
  description?: string | null;
}> = ({ label, currentValue, maxValue, fillColor, description }) => {
  const percent = clampUnitInterval(
    maxValue > 0 ? currentValue / maxValue : 0,
  );
  const percentLabel = `${(percent * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-2 text-left">
      <div className="text-[1.2rem] leading-[1.2] text-[#222]">{label}</div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={maxValue}
        aria-valuenow={Math.max(0, currentValue)}
        aria-valuetext={percentLabel}
        className="relative h-5 overflow-hidden border-2 border-[#222] bg-[#6f6f6f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]"
      >
        <div
          className="h-full border-r-2 border-[#222]/25"
          style={{
            width: `${percent * 100}%`,
            backgroundColor: fillColor,
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.9rem] leading-none font-bold text-white [text-shadow:0_1px_0_rgba(0,0,0,0.6)]">
          {percentLabel}
        </div>
      </div>
      {description ? (
        <div className="text-[1rem] leading-[1.2] font-bold text-[#9A4F00]">
          {description}
        </div>
      ) : null}
    </div>
  );
};

const ValueRow: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="flex items-end justify-between gap-3">
    <div className="text-[1.2rem] leading-[1.2] text-[#222]">{label}</div>
    <div className="text-[1.3rem] leading-none font-bold text-component-positive">
      {value}
    </div>
  </div>
);

const GeneSymbolIcon: React.FC<{
  geneLine: NonNullable<MainCharacterInfoSnapshot["geneLine"]>;
}> = ({ geneLine }) => (
  <span
    aria-label={geneLine}
    className="inline-block shrink-0 [image-rendering:pixelated]"
    role="img"
    style={{
      width: "1em",
      height: "1em",
      backgroundImage: `url(${GENE_SYMBOL_SPRITE_URL})`,
      backgroundPosition: GENE_SYMBOL_BACKGROUND_POSITION_BY_LINE[geneLine],
      backgroundRepeat: "no-repeat",
      backgroundSize: "300% 100%",
    }}
  />
);

const GeneOutcomeList: React.FC<{
  label?: string;
  locale: string;
  outcomes: MainCharacterInfoSnapshot["geneOutcomes"];
  probabilityFractionDigits?: number;
}> = ({ label, locale, outcomes, probabilityFractionDigits }) => {
  if (outcomes.length === 0) {
    return null;
  }

  const standardOutcomes = outcomes.filter(
    (outcome) => outcome.kind !== "mutation",
  );
  const mutationOutcomes = outcomes.filter(
    (outcome) => outcome.kind === "mutation",
  );
  const mutationLevel = mutationOutcomes[0]?.level;
  const mutationProbability = mutationOutcomes.reduce(
    (total, outcome) => total + outcome.probability,
    0,
  );
  const mutationKey = mutationOutcomes
    .map((outcome) => `${outcome.geneLine}:${outcome.level}`)
    .sort()
    .join("|");

  const renderOutcomeRow = (outcome: GeneOutcome) => (
    <div
      className="flex items-center justify-between gap-4 text-[1.2rem] leading-none"
      key={`${outcome.kind}:${outcome.geneLine}:${outcome.level}`}
    >
      <div className="flex items-end gap-[0.05em] font-bold text-[#222]">
        <GeneSymbolIcon geneLine={outcome.geneLine} />
        <span className="text-[0.8em]">Lv.{outcome.level}</span>
      </div>
      <div className="font-bold text-component-positive">
        {formatGeneOutcomeProbability(
          outcome.probability,
          locale,
          probabilityFractionDigits,
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 text-left">
      {label ? (
        <div className="text-[1.2rem] leading-[1.2] text-[#222]">{label}</div>
      ) : null}
      <div className="flex flex-col gap-2">
        {standardOutcomes.map(renderOutcomeRow)}
        {mutationOutcomes.length > 0 && mutationLevel !== undefined ? (
          <div
            className="flex items-center justify-between gap-4 text-[1.2rem] leading-none"
            key={`mutation:${mutationKey}`}
          >
            <div className="flex items-end gap-[0.05em] font-bold text-[#222]">
              <div className="flex items-center -space-x-[0.5em]">
                {mutationOutcomes.map((outcome) => (
                  <GeneSymbolIcon
                    geneLine={outcome.geneLine}
                    key={`${outcome.geneLine}:${outcome.level}`}
                  />
                ))}
              </div>
              <span className="text-[0.8em]">Lv.{mutationLevel}</span>
            </div>
            <div className="font-bold text-component-positive">
              {formatGeneOutcomeProbability(
                mutationProbability,
                locale,
                probabilityFractionDigits,
              )}
            </div>
          </div>
        ) : null}
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
  const evolutionGaugeDescriptionKey =
    getEvolutionGaugeDescriptionKey(snapshot);
  const evolutionGaugeDescription = evolutionGaugeDescriptionKey
    ? t(evolutionGaugeDescriptionKey)
    : null;

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
              <div className="flex items-center justify-end gap-1 text-[1.2rem] leading-none font-bold text-component-positive">
                {snapshot.geneLine ? (
                  <GeneSymbolIcon geneLine={snapshot.geneLine} />
                ) : null}
                {levelText}
              </div>
            </div>
            {snapshot.isEgg ? (
              <>
                <ValueRow
                  label={t("monsterInfo.hatchRemaining")}
                  value={formatEggHatchRemainingTime(
                    snapshot.eggHatchRemainingMs,
                  )}
                />
                <GeneOutcomeList
                  label={t("monsterInfo.hatch")}
                  locale={locale}
                  outcomes={snapshot.geneOutcomes}
                />
              </>
            ) : (
              <>
                <StatusBar
                  label={t("monsterInfo.stamina")}
                  currentValue={snapshot.stamina}
                  maxValue={snapshot.maxStamina}
                  fillColor={getStaminaFillColor(snapshot)}
                />
                <div className="flex flex-col gap-2">
                  <StatusBar
                    label={t("monsterInfo.evolution")}
                    currentValue={snapshot.evolutionGauge}
                    maxValue={snapshot.maxEvolutionGauge}
                    fillColor={EVOLUTION_FILL_COLOR}
                    description={evolutionGaugeDescription}
                  />
                  <GeneOutcomeList
                    label={t("monsterInfo.nextEvolution")}
                    locale={locale}
                    outcomes={snapshot.geneOutcomes}
                    probabilityFractionDigits={1}
                  />
                </div>
              </>
            )}
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
