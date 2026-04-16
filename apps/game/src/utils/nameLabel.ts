export const NAME_LABEL_MAX_WIDTH = 80;
export const NAME_LABEL_FONT_FAMILIES = [
  "Press Start 2P",
  "Apple Color Emoji",
  "Segoe UI Emoji",
  "Noto Color Emoji",
  "sans-serif",
] as const;
export const NAME_LABEL_FONT_SIZE = 10;
export const NAME_LABEL_FONT_WEIGHT = 400;
export const NAME_LABEL_STROKE_WIDTH = 3;
export const NAME_LABEL_FILL_COLOR = 0xffffff;
export const NAME_LABEL_STROKE_COLOR = 0x000000;

let measurementContext: CanvasRenderingContext2D | null | undefined;

export function countDisplayCharacters(value: string): number {
  return splitDisplayCharacters(value).length;
}

export function splitDisplayCharacters(value: string): string[] {
  const IntlWithSegmenter = Intl as typeof Intl & {
    Segmenter?: new (
      locales?: string | string[],
      options?: { granularity?: string },
    ) => {
      segment(input: string): Iterable<{ segment: string }>;
    };
  };

  const SegmenterCtor = IntlWithSegmenter.Segmenter;

  if (SegmenterCtor) {
    return Array.from(
      new SegmenterCtor(undefined, { granularity: "grapheme" }).segment(value),
      (item) => item.segment,
    );
  }

  return Array.from(value);
}

export function measureNameLabelWidth(value: string): number {
  if (!value) {
    return 0;
  }

  const context = getMeasurementContext();
  if (!context) {
    return (
      splitDisplayCharacters(value).length * NAME_LABEL_FONT_SIZE +
      NAME_LABEL_STROKE_WIDTH * 2
    );
  }

  context.font = `${NAME_LABEL_FONT_WEIGHT} ${NAME_LABEL_FONT_SIZE}px ${toCanvasFontFamilyList(
    NAME_LABEL_FONT_FAMILIES,
  )}`;
  return context.measureText(value).width + NAME_LABEL_STROKE_WIDTH * 2;
}

export function fitsNameLabelWidth(
  value: string,
  maxWidth = NAME_LABEL_MAX_WIDTH,
): boolean {
  return measureNameLabelWidth(value) <= maxWidth;
}

export function truncateNameLabelToWidth(
  value: string,
  maxWidth = NAME_LABEL_MAX_WIDTH,
): string {
  if (!value || fitsNameLabelWidth(value, maxWidth)) {
    return value;
  }

  const graphemes = splitDisplayCharacters(value);
  const ellipsis = "…";

  if (measureNameLabelWidth(ellipsis) > maxWidth) {
    return "";
  }

  let truncated = "";
  for (let i = 0; i < graphemes.length; i++) {
    const nextValue = `${truncated}${graphemes[i]}`;
    const candidate = `${nextValue}${ellipsis}`;

    if (!fitsNameLabelWidth(candidate, maxWidth)) {
      return truncated ? `${truncated}${ellipsis}` : ellipsis;
    }

    truncated = nextValue;
  }

  return truncated;
}

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (measurementContext !== undefined) {
    return measurementContext;
  }

  if (typeof document === "undefined") {
    measurementContext = null;
    return measurementContext;
  }

  const canvas = document.createElement("canvas");
  measurementContext = canvas.getContext("2d");
  return measurementContext;
}

function toCanvasFontFamilyList(fontFamilies: readonly string[]): string {
  return fontFamilies
    .map((fontFamily) =>
      fontFamily.includes(" ") ? `"${fontFamily}"` : fontFamily,
    )
    .join(", ");
}
