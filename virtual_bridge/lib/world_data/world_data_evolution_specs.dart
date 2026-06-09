const String evolutionCandidateKindBase = 'base';
const String evolutionCandidateKindSameLine = 'same_line_variant_mutation';
const String evolutionCandidateKindCrossLine = 'same_class_cross_line_mutation';

const double worldDataLifecycleMutationBaseRate = 0.01;
const int worldDataLifecycleMutationStackCap = 10;
const int worldDataLifecycleMutationDirtyExposureStackIntervalMs =
    2 * 60 * 60 * 1000;

class WorldDataEvolutionCandidate {
  final int to;
  final int weight;
  final String kind;

  const WorldDataEvolutionCandidate({
    required this.to,
    required this.weight,
    required this.kind,
  });
}

class WorldDataEvolutionSpec {
  final int key;
  final String geneLine;
  final String classCode;
  final int phase;
  final List<WorldDataEvolutionCandidate> candidates;

  const WorldDataEvolutionSpec({
    required this.key,
    required this.geneLine,
    required this.classCode,
    required this.phase,
    required this.candidates,
  });
}

const Map<int, WorldDataEvolutionSpec> worldDataEvolutionSpecs =
    <int, WorldDataEvolutionSpec>{
  1: WorldDataEvolutionSpec(
    key: 1,
    geneLine: 'green-slime',
    classCode: 'A',
    phase: 1,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 2, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 5, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 6, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  2: WorldDataEvolutionSpec(
    key: 2,
    geneLine: 'green-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 3, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 7, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 8, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 9, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  3: WorldDataEvolutionSpec(
    key: 3,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 4, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 10, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 11, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 12, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  4: WorldDataEvolutionSpec(
    key: 4,
    geneLine: 'green-slime',
    classCode: 'D',
    phase: 4,
    candidates: <WorldDataEvolutionCandidate>[],
  ),
  5: WorldDataEvolutionSpec(
    key: 5,
    geneLine: 'green-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 7, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 3, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 8, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 9, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  6: WorldDataEvolutionSpec(
    key: 6,
    geneLine: 'green-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 8, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 3, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 7, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 9, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  7: WorldDataEvolutionSpec(
    key: 7,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 10, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 4, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 11, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 12, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  8: WorldDataEvolutionSpec(
    key: 8,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 11, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 4, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 10, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 12, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  9: WorldDataEvolutionSpec(
    key: 9,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 12, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 4, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 10, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 11, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  10: WorldDataEvolutionSpec(
      key: 10,
      geneLine: 'green-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  11: WorldDataEvolutionSpec(
      key: 11,
      geneLine: 'green-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  12: WorldDataEvolutionSpec(
      key: 12,
      geneLine: 'green-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  14: WorldDataEvolutionSpec(
    key: 14,
    geneLine: 'skull-slime',
    classCode: 'A',
    phase: 1,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 16, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 17, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  16: WorldDataEvolutionSpec(
    key: 16,
    geneLine: 'skull-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 18, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 19, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  17: WorldDataEvolutionSpec(
    key: 17,
    geneLine: 'skull-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 19, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 18, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  18: WorldDataEvolutionSpec(
    key: 18,
    geneLine: 'skull-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 20, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 21, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  19: WorldDataEvolutionSpec(
    key: 19,
    geneLine: 'skull-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 21, weight: 60, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 20, weight: 40, kind: evolutionCandidateKindSameLine),
    ],
  ),
  20: WorldDataEvolutionSpec(
      key: 20,
      geneLine: 'skull-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  21: WorldDataEvolutionSpec(
      key: 21,
      geneLine: 'skull-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  22: WorldDataEvolutionSpec(
    key: 22,
    geneLine: 'soil-slime',
    classCode: 'A',
    phase: 1,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 24, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 25, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  24: WorldDataEvolutionSpec(
    key: 24,
    geneLine: 'soil-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 26, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 27, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 28, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  25: WorldDataEvolutionSpec(
    key: 25,
    geneLine: 'soil-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 27, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 26, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 28, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  26: WorldDataEvolutionSpec(
    key: 26,
    geneLine: 'soil-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 29, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 30, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 31, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  27: WorldDataEvolutionSpec(
    key: 27,
    geneLine: 'soil-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 30, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 29, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 31, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  28: WorldDataEvolutionSpec(
    key: 28,
    geneLine: 'soil-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 31, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 29, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 30, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  29: WorldDataEvolutionSpec(
      key: 29,
      geneLine: 'soil-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  30: WorldDataEvolutionSpec(
      key: 30,
      geneLine: 'soil-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  31: WorldDataEvolutionSpec(
      key: 31,
      geneLine: 'soil-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
};

const List<int> worldDataMonsterCharacterKeys = <int>[
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  14,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
];
