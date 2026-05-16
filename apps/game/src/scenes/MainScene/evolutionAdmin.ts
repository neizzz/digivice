import {
  MONSTER_CHARACTER_KEYS,
  type EvolutionCandidateKind,
  type MonsterClassCode,
  type MonsterEvolutionCode,
  type MonsterGeneLine,
  getEvolutionSpec,
} from "./evolutionConfig";
import { CharacterKeyECS } from "./types";
import { resolveWeightedCandidate } from "./weightedSelection";

export type EvolutionAdminCatalogCandidate = {
  to: CharacterKeyECS;
  toCode: MonsterEvolutionCode;
  toDisplayName: string;
  weight: number;
  kind: EvolutionCandidateKind;
};

export type EvolutionAdminCatalogEntry = {
  key: CharacterKeyECS;
  code: MonsterEvolutionCode;
  displayName: string;
  spritesheetName: string;
  phase: number;
  classCode: MonsterClassCode;
  geneLine: MonsterGeneLine;
  candidates: EvolutionAdminCatalogCandidate[];
};

export type EvolutionAdminOverrideCandidate = {
  toCode: MonsterEvolutionCode;
  weight: number;
  kind: EvolutionCandidateKind;
};

export type EvolutionAdminOverrideEntry = {
  evolutionCandidates: EvolutionAdminOverrideCandidate[];
};

export type EvolutionAdminOverrideMap = Partial<
  Record<MonsterEvolutionCode, EvolutionAdminOverrideEntry>
>;

export type EvolutionAdminExportV1 = {
  schemaVersion: 1;
  overrides: EvolutionAdminOverrideMap;
};

export type EvolutionAdminValidationResult =
  | {
      ok: true;
      data: EvolutionAdminExportV1;
    }
  | {
      ok: false;
      errors: string[];
    };

export type EvolutionAdminSimulationResult = {
  toCode: MonsterEvolutionCode;
  count: number;
  percent: number;
};

function cloneCandidate(
  candidate: EvolutionAdminCatalogCandidate,
): EvolutionAdminCatalogCandidate {
  return { ...candidate };
}

function cloneEntry(entry: EvolutionAdminCatalogEntry): EvolutionAdminCatalogEntry {
  return {
    ...entry,
    candidates: entry.candidates.map(cloneCandidate),
  };
}

function serializeCandidates(
  candidates: readonly Pick<
    EvolutionAdminCatalogCandidate,
    "toCode" | "weight" | "kind"
  >[],
): string {
  return JSON.stringify(
    candidates.map((candidate) => ({
      toCode: candidate.toCode,
      weight: candidate.weight,
      kind: candidate.kind,
    })),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createCatalogEntry(
  characterKey: CharacterKeyECS,
): EvolutionAdminCatalogEntry {
  const spec = getEvolutionSpec(characterKey);

  if (!spec) {
    throw new Error(
      `[EvolutionAdmin] Missing evolution spec for characterKey=${characterKey}`,
    );
  }

  const candidates = spec.evolutionCandidates.map((candidate) => {
    const targetSpec = getEvolutionSpec(candidate.to);

    if (!targetSpec) {
      throw new Error(
        `[EvolutionAdmin] Missing target evolution spec for characterKey=${characterKey}, target=${candidate.to}`,
      );
    }

    return {
      to: candidate.to,
      toCode: targetSpec.code,
      toDisplayName: targetSpec.displayName,
      weight: candidate.weight,
      kind: candidate.kind,
    };
  });

  return {
    key: spec.key,
    code: spec.code,
    displayName: spec.displayName,
    spritesheetName: spec.spritesheetName,
    phase: spec.phase,
    classCode: spec.classCode,
    geneLine: spec.geneLine,
    candidates,
  };
}

function createBaseCatalogMap(
  baseCatalog: readonly EvolutionAdminCatalogEntry[],
): Map<MonsterEvolutionCode, EvolutionAdminCatalogEntry> {
  return new Map(baseCatalog.map((entry) => [entry.code, cloneEntry(entry)]));
}

const BASE_EVOLUTION_ADMIN_CATALOG: EvolutionAdminCatalogEntry[] =
  MONSTER_CHARACTER_KEYS.map((characterKey) => createCatalogEntry(characterKey))
    .sort((left, right) => {
      if (left.phase !== right.phase) {
        return left.phase - right.phase;
      }

      return left.code.localeCompare(right.code);
    })
    .map(cloneEntry);

export function getEvolutionAdminCatalog(): EvolutionAdminCatalogEntry[] {
  return BASE_EVOLUTION_ADMIN_CATALOG.map(cloneEntry);
}

export function buildEvolutionAdminExport(params: {
  baseCatalog?: readonly EvolutionAdminCatalogEntry[];
  currentCatalog: readonly EvolutionAdminCatalogEntry[];
}): EvolutionAdminExportV1 {
  const baseCatalog = params.baseCatalog ?? BASE_EVOLUTION_ADMIN_CATALOG;
  const baseCatalogMap = createBaseCatalogMap(baseCatalog);
  const overrides: EvolutionAdminOverrideMap = {};

  for (const entry of params.currentCatalog) {
    const baseEntry = baseCatalogMap.get(entry.code);

    if (!baseEntry || entry.candidates.length === 0) {
      continue;
    }

    if (
      serializeCandidates(baseEntry.candidates) === serializeCandidates(entry.candidates)
    ) {
      continue;
    }

    overrides[entry.code] = {
      evolutionCandidates: entry.candidates.map((candidate) => ({
        toCode: candidate.toCode,
        weight: candidate.weight,
        kind: candidate.kind,
      })),
    };
  }

  return {
    schemaVersion: 1,
    overrides,
  };
}

export function validateEvolutionAdminExport(
  input: unknown,
  baseCatalog: readonly EvolutionAdminCatalogEntry[] = BASE_EVOLUTION_ADMIN_CATALOG,
): EvolutionAdminValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: ["JSON root must be an object."],
    };
  }

  if (input.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1.");
  }

  if (!isRecord(input.overrides)) {
    errors.push("overrides must be an object.");
    return { ok: false, errors };
  }

  const baseCatalogMap = createBaseCatalogMap(baseCatalog);
  const sanitizedOverrides: EvolutionAdminOverrideMap = {};

  for (const [rawSourceCode, rawEntry] of Object.entries(input.overrides)) {
    const sourceCode = rawSourceCode as MonsterEvolutionCode;
    const baseEntry = baseCatalogMap.get(sourceCode);

    if (!baseEntry) {
      errors.push(`Unknown source code: ${rawSourceCode}`);
      continue;
    }

    if (baseEntry.candidates.length === 0) {
      errors.push(`Terminal stage cannot be overridden: ${rawSourceCode}`);
      continue;
    }

    if (!isRecord(rawEntry) || !Array.isArray(rawEntry.evolutionCandidates)) {
      errors.push(`Invalid override entry for ${rawSourceCode}.`);
      continue;
    }

    const sourceErrorStartIndex = errors.length;
    const baselineCandidatesByCode = new Map(
      baseEntry.candidates.map((candidate) => [candidate.toCode, candidate]),
    );
    const sanitizedCandidatesByCode = new Map<
      MonsterEvolutionCode,
      EvolutionAdminOverrideCandidate
    >();
    const seenTargetCodes = new Set<MonsterEvolutionCode>();
    rawEntry.evolutionCandidates.forEach((rawCandidate, index) => {
      if (!isRecord(rawCandidate)) {
        errors.push(
          `Invalid candidate at ${rawSourceCode}[${index}] - candidate must be an object.`,
        );
        return;
      }

      const { toCode, weight, kind } = rawCandidate;

      if (typeof toCode !== "string") {
        errors.push(
          `Invalid target code at ${rawSourceCode}[${index}] - toCode must be a string.`,
        );
        return;
      }

      const targetCode = toCode as MonsterEvolutionCode;
      const baselineCandidate = baselineCandidatesByCode.get(targetCode);

      if (!baselineCandidate) {
        errors.push(
          `Unknown target code for ${rawSourceCode}: ${String(toCode)}`,
        );
        return;
      }

      if (seenTargetCodes.has(targetCode)) {
        errors.push(
          `Duplicate target code for ${rawSourceCode}: ${String(toCode)}`,
        );
        return;
      }

      seenTargetCodes.add(targetCode);

      if (kind !== baselineCandidate.kind) {
        errors.push(
          `Kind mismatch for ${rawSourceCode} -> ${String(toCode)}. Expected ${baselineCandidate.kind}, received ${String(kind)}.`,
        );
      }

      if (
        typeof weight !== "number" ||
        !Number.isInteger(weight) ||
        weight < 0 ||
        weight > 100
      ) {
        errors.push(
          `Invalid weight for ${rawSourceCode} -> ${String(toCode)}. Weight must be an integer between 0 and 100.`,
        );
        return;
      }

      sanitizedCandidatesByCode.set(targetCode, {
        toCode: targetCode,
        weight,
        kind: baselineCandidate.kind,
      });
    });

    if (rawEntry.evolutionCandidates.length !== baseEntry.candidates.length) {
      errors.push(
        `Candidate count mismatch for ${rawSourceCode}. Expected ${baseEntry.candidates.length}, received ${rawEntry.evolutionCandidates.length}.`,
      );
    }

    for (const baseCandidate of baseEntry.candidates) {
      if (!sanitizedCandidatesByCode.has(baseCandidate.toCode)) {
        errors.push(
          `Missing candidate for ${rawSourceCode}: ${baseCandidate.toCode}`,
        );
      }
    }

    if (errors.length > sourceErrorStartIndex) {
      continue;
    }

    sanitizedOverrides[sourceCode] = {
      evolutionCandidates: baseEntry.candidates.map((baseCandidate) => {
        const sanitizedCandidate = sanitizedCandidatesByCode.get(
          baseCandidate.toCode,
        );

        if (!sanitizedCandidate) {
          throw new Error(
            `[EvolutionAdmin] Missing sanitized candidate for ${sourceCode} -> ${baseCandidate.toCode}`,
          );
        }

        return sanitizedCandidate;
      }),
    };
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    data: {
      schemaVersion: 1,
      overrides: sanitizedOverrides,
    },
  };
}

export function applyEvolutionAdminExport(params: {
  baseCatalog?: readonly EvolutionAdminCatalogEntry[];
  exportData: EvolutionAdminExportV1;
}): EvolutionAdminCatalogEntry[] {
  const baseCatalog = params.baseCatalog ?? BASE_EVOLUTION_ADMIN_CATALOG;
  const baseCatalogMap = createBaseCatalogMap(baseCatalog);

  return baseCatalog.map((entry) => {
    const baseEntry = baseCatalogMap.get(entry.code);
    const overrideEntry = params.exportData.overrides[entry.code];

    if (!baseEntry || !overrideEntry) {
      return cloneEntry(entry);
    }

    const overrideByCode = new Map(
      overrideEntry.evolutionCandidates.map((candidate) => [
        candidate.toCode,
        candidate,
      ]),
    );

    return {
      ...cloneEntry(baseEntry),
      candidates: baseEntry.candidates.map((candidate) => {
        const overrideCandidate = overrideByCode.get(candidate.toCode);

        if (!overrideCandidate) {
          return cloneCandidate(candidate);
        }

        return {
          ...cloneCandidate(candidate),
          weight: overrideCandidate.weight,
        };
      }),
    };
  });
}

export function simulateEvolutionAdminRolls(params: {
  entry: EvolutionAdminCatalogEntry;
  rollCount: number;
  random?: () => number;
}): EvolutionAdminSimulationResult[] {
  const { entry, rollCount, random = Math.random } = params;
  const normalizedRollCount = Math.max(0, Math.trunc(rollCount));

  if (entry.candidates.length === 0 || normalizedRollCount === 0) {
    return entry.candidates.map((candidate) => ({
      toCode: candidate.toCode,
      count: 0,
      percent: 0,
    }));
  }

  const counts = new Map<MonsterEvolutionCode, number>(
    entry.candidates.map((candidate) => [candidate.toCode, 0]),
  );

  for (let index = 0; index < normalizedRollCount; index += 1) {
    const candidate = resolveWeightedCandidate(entry.candidates, random());

    if (!candidate) {
      continue;
    }

    counts.set(candidate.toCode, (counts.get(candidate.toCode) ?? 0) + 1);
  }

  return entry.candidates.map((candidate) => {
    const count = counts.get(candidate.toCode) ?? 0;

    return {
      toCode: candidate.toCode,
      count,
      percent: normalizedRollCount > 0 ? (count / normalizedRollCount) * 100 : 0,
    };
  });
}
