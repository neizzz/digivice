part of 'world_data_lifecycle_service.dart';

class _WorldDataFoodInteractionService {
  const _WorldDataFoodInteractionService._();

  static _FoodInteractionProgressResult progressPendingFoodInteraction({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required int elapsedMs,
    required int previousLastEcsSaved,
  }) {
    if (elapsedMs <= 0 ||
        character.state == config.characterStateEgg ||
        character.state == config.characterStateDead) {
      return const _FoodInteractionProgressResult();
    }

    bool changed = false;
    int remainingElapsedMs = elapsedMs;
    int cursorMs = previousLastEcsSaved;
    int guard = 0;

    while (remainingElapsedMs > 0 && guard < 64) {
      guard += 1;

      final Map<String, dynamic> foodEating =
          WorldDataLifecycleService._readMap(
              character.components['foodEating']);
      if (character.state == config.characterStateEating ||
          WorldDataLifecycleService._readBool(foodEating['isActive']) == true) {
        final _FoodEntityRef? foodRef =
            _resolveEatingFoodRef(entities: entities, foodEating: foodEating);
        if (foodRef == null) {
          break;
        }
        final double durationMs =
            WorldDataLifecycleService._readDouble(foodEating['duration']) ??
                worldDataLifecycleFoodEatingDurationMs.toDouble();
        final double previousElapsedMs =
            WorldDataLifecycleService._readDouble(foodEating['elapsedTime']) ??
                0;
        final double remainingEatingMs =
            math.max(0, durationMs - previousElapsedMs);
        final int completionThresholdMs = remainingEatingMs.ceil();
        if (remainingElapsedMs >= completionThresholdMs) {
          final int consumedMs = math.min(
            remainingElapsedMs,
            completionThresholdMs,
          );
          _completeFoodInteraction(
            character: character,
            entities: entities,
            foodRef: foodRef,
            completionTimeMs: cursorMs + consumedMs,
          );
          changed = true;
          cursorMs += consumedMs;
          remainingElapsedMs -= consumedMs;
          continue;
        }

        final double nextElapsedMs = previousElapsedMs + remainingElapsedMs;
        _setFoodEatingProgress(
          character: character,
          foodRef: foodRef,
          elapsedMs: nextElapsedMs,
          durationMs: durationMs,
        );
        return const _FoodInteractionProgressResult(changed: true);
      }

      if (character.state == config.characterStateMoving) {
        final Map<String, dynamic> destination =
            WorldDataLifecycleService._readMap(
                character.components['destination']);
        if (WorldDataLifecycleService._readInt(destination['type']) ==
            worldDataLifecycleDestinationTypeTargeted) {
          final _FoodEntityRef? foodRef = _resolveTargetedFoodRef(
            entities: entities,
            destination: destination,
          );
          if (foodRef == null) {
            break;
          }
          destination['target'] = foodRef.index;
          destination['targetObjectId'] =
              WorldDataLifecycleService._readInt(foodRef.object['id']) ?? 0;

          if (isFoodStale(foodRef.components)) {
            _cancelPendingFoodTarget(character: character, foodRef: foodRef);
            changed = true;
            continue;
          }

          final Map<String, dynamic> position =
              WorldDataLifecycleService._readMap(
                  character.components['position']);
          final double? startX =
              WorldDataLifecycleService._readDouble(position['x']);
          final double? startY =
              WorldDataLifecycleService._readDouble(position['y']);
          final double? targetX =
              WorldDataLifecycleService._readDouble(destination['x']);
          final double? targetY =
              WorldDataLifecycleService._readDouble(destination['y']);
          if (startX == null ||
              startY == null ||
              targetX == null ||
              targetY == null) {
            break;
          }

          final double distance = math.sqrt(
            math.pow(targetX - startX, 2).toDouble() +
                math.pow(targetY - startY, 2).toDouble(),
          );
          final double speed = (WorldDataLifecycleService._readDouble(
                      WorldDataLifecycleService._readMap(
                          character.components['speed'])['value']) ??
                  WorldDataLifecycleService._resolveCharacterMovementSpeed(
                      character.characterKey))
              .clamp(0, double.infinity)
              .toDouble();
          final int remainingMoveMs =
              speed <= 0 ? 0 : (distance / speed).ceil();
          final int totalCompletionMs =
              remainingMoveMs + worldDataLifecycleFoodEatingDurationMs;

          if (remainingElapsedMs >= totalCompletionMs) {
            position['x'] = targetX;
            position['y'] = targetY;
            _completeFoodInteraction(
              character: character,
              entities: entities,
              foodRef: foodRef,
              completionTimeMs: cursorMs + totalCompletionMs,
            );
            changed = true;
            cursorMs += totalCompletionMs;
            remainingElapsedMs -= totalCompletionMs;
            continue;
          }

          if (remainingElapsedMs < remainingMoveMs) {
            final double ratio =
                remainingMoveMs <= 0 ? 1 : remainingElapsedMs / remainingMoveMs;
            position['x'] = startX + (targetX - startX) * ratio;
            position['y'] = startY + (targetY - startY) * ratio;
            return const _FoodInteractionProgressResult(changed: true);
          }

          position['x'] = targetX;
          position['y'] = targetY;
          final int eatingElapsedMs = remainingElapsedMs - remainingMoveMs;
          character.object['state'] = config.characterStateEating;
          foodRef.object['state'] = worldDataLifecycleFoodStateBeingIntaken;
          _setFoodEatingProgress(
            character: character,
            foodRef: foodRef,
            elapsedMs: eatingElapsedMs.toDouble(),
            durationMs: worldDataLifecycleFoodEatingDurationMs.toDouble(),
          );
          return const _FoodInteractionProgressResult(changed: true);
        }
      }

      if (!_startNextLandedFoodInteraction(character, entities)) {
        break;
      }
      changed = true;
    }

    return _FoodInteractionProgressResult(changed: changed);
  }

  static bool _startNextLandedFoodInteraction(
    _MutableCharacterSource character,
    List<dynamic> entities,
  ) {
    final int? state = character.state;
    if (state != config.characterStateIdle &&
        state != config.characterStateMoving) {
      return false;
    }

    final double stamina = character.stamina ?? config.maxStamina;
    if (stamina >= config.maxStamina) {
      return false;
    }

    final Map<String, dynamic> position =
        WorldDataLifecycleService._readMap(character.components['position']);
    final double? characterX =
        WorldDataLifecycleService._readDouble(position['x']);
    final double? characterY =
        WorldDataLifecycleService._readDouble(position['y']);
    if (characterX == null || characterY == null) {
      return false;
    }

    final _FoodEntityRef? foodRef = _findNearestLandedFoodRef(
      entities: entities,
      characterX: characterX,
      characterY: characterY,
    );
    if (foodRef == null) {
      return false;
    }

    final Map<String, dynamic> foodPosition =
        WorldDataLifecycleService._readMap(foodRef.components['position']);
    final double? targetX =
        WorldDataLifecycleService._readDouble(foodPosition['x']);
    final double? targetY =
        WorldDataLifecycleService._readDouble(foodPosition['y']);
    if (targetX == null || targetY == null) {
      return false;
    }

    foodRef.object['state'] = worldDataLifecycleFoodStateTargeted;
    character.object['state'] = config.characterStateMoving;
    final Map<String, dynamic> destination =
        WorldDataLifecycleService._ensureMap(
            character.components, 'destination');
    destination['type'] = worldDataLifecycleDestinationTypeTargeted;
    destination['target'] = foodRef.index;
    destination['targetObjectId'] =
        WorldDataLifecycleService._readInt(foodRef.object['id']) ?? 0;
    destination['x'] = targetX.round();
    destination['y'] = targetY.round();

    final Map<String, dynamic> speed =
        WorldDataLifecycleService._ensureMap(character.components, 'speed');
    final double currentSpeed =
        WorldDataLifecycleService._readDouble(speed['value']) ?? 0;
    if (currentSpeed <= 0) {
      speed['value'] = WorldDataLifecycleService._resolveCharacterMovementSpeed(
          character.characterKey);
    }

    return true;
  }

  static _FoodEntityRef? _findNearestLandedFoodRef({
    required List<dynamic> entities,
    required double characterX,
    required double characterY,
  }) {
    _FoodEntityRef? nearestFoodRef;
    double minDistance = double.infinity;

    for (int index = 0; index < entities.length; index += 1) {
      final _FoodEntityRef? foodRef = _readFoodEntityRef(entities, index);
      if (foodRef == null ||
          WorldDataLifecycleService._readInt(foodRef.object['state']) !=
              worldDataLifecycleFoodStateLanded ||
          isFoodStale(foodRef.components)) {
        continue;
      }

      final Map<String, dynamic> position =
          WorldDataLifecycleService._readMap(foodRef.components['position']);
      final double? foodX =
          WorldDataLifecycleService._readDouble(position['x']);
      final double? foodY =
          WorldDataLifecycleService._readDouble(position['y']);
      if (foodX == null || foodY == null) {
        continue;
      }

      final double distance = math.sqrt(
        math.pow(characterX - foodX, 2).toDouble() +
            math.pow(characterY - foodY, 2).toDouble(),
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestFoodRef = foodRef;
      }
    }

    return nearestFoodRef;
  }

  static void _completeFoodInteraction({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required _FoodEntityRef foodRef,
    required int completionTimeMs,
  }) {
    final double currentStamina = character.stamina ?? config.maxStamina;
    final double staminaBonus = _getStaminaBonusForFoodTexture(
      WorldDataLifecycleService._readInt(WorldDataLifecycleService._readMap(
          foodRef.components['render'])['textureKey']),
    );
    final double nextStamina =
        (currentStamina + staminaBonus).clamp(0, config.maxStamina).toDouble();
    character.characterStatus['stamina'] = nextStamina;
    if (currentStamina < config.maxStamina &&
        nextStamina >= config.maxStamina) {
      WorldDataLifecycleService._addStatus(
          character.statuses, config.characterStatusHappy);
    }

    WorldDataLifecycleService._addDigestiveLoad(character, completionTimeMs);
    _clearMovementAndEatingComponents(character);
    _resumeAfterEating(character, completionTimeMs);
    entities.removeAt(foodRef.index);
  }

  static void _setFoodEatingProgress({
    required _MutableCharacterSource character,
    required _FoodEntityRef foodRef,
    required double elapsedMs,
    required double durationMs,
  }) {
    final double safeDurationMs = durationMs <= 0
        ? worldDataLifecycleFoodEatingDurationMs.toDouble()
        : durationMs;
    final double safeElapsedMs = elapsedMs.clamp(0, safeDurationMs).toDouble();
    final double progress =
        (safeElapsedMs / safeDurationMs).clamp(0, 1).toDouble();
    final Map<String, dynamic> foodEating =
        WorldDataLifecycleService._ensureMap(
            character.components, 'foodEating');
    foodEating['targetFood'] = foodRef.index;
    foodEating['targetFoodObjectId'] =
        WorldDataLifecycleService._readInt(foodRef.object['id']) ?? 0;
    foodEating['progress'] = progress;
    foodEating['duration'] = safeDurationMs;
    foodEating['elapsedTime'] = safeElapsedMs;
    foodEating['isActive'] = true;

    final Map<String, dynamic> foodMask =
        WorldDataLifecycleService._ensureMap(foodRef.components, 'foodMask');
    foodMask['maskStoreIndex'] = worldDataLifecycleTextureKeyNull;
    foodMask['progress'] = progress;
    foodMask['isInitialized'] =
        WorldDataLifecycleService._readBool(foodMask['isInitialized']) ?? false;

    final Map<String, dynamic> freshnessTimer =
        WorldDataLifecycleService._readMap(
            foodRef.components['freshnessTimer']);
    if (freshnessTimer.isNotEmpty) {
      freshnessTimer['isBeingEaten'] = true;
    }
  }

  static void _clearMovementAndEatingComponents(
    _MutableCharacterSource character,
  ) {
    character.components.remove('foodEating');
    character.components.remove('destination');
    final Map<String, dynamic> speed =
        WorldDataLifecycleService._readMap(character.components['speed']);
    if (speed.isNotEmpty) {
      speed['value'] = 0;
    }
  }

  static void _resumeAfterEating(
    _MutableCharacterSource character,
    int completionTimeMs,
  ) {
    final int interruptedSleepMode = WorldDataLifecycleService._readInt(
            character.sleepSystem['interruptedSleepMode']) ??
        worldDataLifecycleSleepModeAwake;
    if (interruptedSleepMode == worldDataLifecycleSleepModeNightSleep) {
      WorldDataLifecycleService._enterSleep(
        character,
        completionTimeMs,
        worldDataLifecycleSleepModeNightSleep,
      );
      character.sleepSystem['interruptedSleepMode'] =
          worldDataLifecycleSleepModeAwake;
      return;
    }

    character.object['state'] =
        character.statuses.contains(config.characterStatusSick)
            ? config.characterStateSick
            : config.characterStateIdle;
    character.sleepSystem['interruptedSleepMode'] =
        worldDataLifecycleSleepModeAwake;
  }

  static void _cancelPendingFoodTarget({
    required _MutableCharacterSource character,
    required _FoodEntityRef foodRef,
  }) {
    character.object['state'] =
        character.statuses.contains(config.characterStatusSick)
            ? config.characterStateSick
            : config.characterStateIdle;
    final Map<String, dynamic> destination =
        WorldDataLifecycleService._ensureMap(
            character.components, 'destination');
    destination['type'] = worldDataLifecycleDestinationTypeNull;
    destination['target'] = worldDataLifecycleDestinationTypeNull;
    destination['targetObjectId'] = 0;
    final Map<String, dynamic> speed =
        WorldDataLifecycleService._readMap(character.components['speed']);
    if (speed.isNotEmpty) {
      speed['value'] = 0;
    }
    foodRef.object['state'] = worldDataLifecycleFoodStateLanded;
  }

  static _FoodEntityRef? _resolveEatingFoodRef({
    required List<dynamic> entities,
    required Map<String, dynamic> foodEating,
  }) {
    return _resolveFoodRefByObjectId(
            entities,
            WorldDataLifecycleService._readInt(
                foodEating['targetFoodObjectId'])) ??
        _findFoodRefByState(
          entities,
          worldDataLifecycleFoodStateBeingIntaken,
        ) ??
        _resolveFoodRefByTarget(entities,
            WorldDataLifecycleService._readInt(foodEating['targetFood']));
  }

  static _FoodEntityRef? _resolveTargetedFoodRef({
    required List<dynamic> entities,
    required Map<String, dynamic> destination,
  }) {
    return _resolveFoodRefByObjectId(
            entities,
            WorldDataLifecycleService._readInt(
                destination['targetObjectId'])) ??
        _findFoodRefByState(entities, worldDataLifecycleFoodStateTargeted) ??
        _resolveFoodRefByTarget(entities,
            WorldDataLifecycleService._readInt(destination['target']));
  }

  static _FoodEntityRef? _resolveFoodRefByObjectId(
    List<dynamic> entities,
    int? objectId,
  ) {
    if (objectId == null || objectId <= 0) {
      return null;
    }

    for (int index = 0; index < entities.length; index += 1) {
      final _FoodEntityRef? foodRef = _readFoodEntityRef(entities, index);
      if (foodRef != null &&
          WorldDataLifecycleService._readInt(foodRef.object['id']) ==
              objectId) {
        return foodRef;
      }
    }

    return null;
  }

  static _FoodEntityRef? _resolveFoodRefByTarget(
    List<dynamic> entities,
    int? target,
  ) {
    if (target != null && target >= 0 && target < entities.length) {
      final _FoodEntityRef? foodRef = _readFoodEntityRef(entities, target);
      if (foodRef != null) {
        return foodRef;
      }
    }
    return null;
  }

  static _FoodEntityRef? _findFoodRefByState(
    List<dynamic> entities,
    int state,
  ) {
    for (int index = 0; index < entities.length; index += 1) {
      final _FoodEntityRef? foodRef = _readFoodEntityRef(entities, index);
      if (foodRef != null &&
          WorldDataLifecycleService._readInt(foodRef.object['state']) ==
              state) {
        return foodRef;
      }
    }
    return null;
  }

  static _FoodEntityRef? _readFoodEntityRef(List<dynamic> entities, int index) {
    final dynamic entity = entities[index];
    if (entity is! Map<String, dynamic>) {
      return null;
    }
    final Map<String, dynamic> components =
        WorldDataLifecycleService._readMap(entity['components']);
    final Map<String, dynamic> object =
        WorldDataLifecycleService._readMap(components['object']);
    if (WorldDataLifecycleService._readInt(object['type']) !=
        worldDataLifecycleFoodObjectType) {
      return null;
    }
    return _FoodEntityRef(
      index: index,
      entity: entity,
      components: components,
      object: object,
    );
  }

  static Map<String, Object?> buildDiagnostics({
    required _MutableCharacterSource? character,
    required List<dynamic> entities,
  }) {
    final int foodCount = _countFoodEntities(entities);
    if (character == null) {
      return <String, Object?>{
        'characterState': null,
        'foodCount': foodCount,
      };
    }

    final Map<String, dynamic> foodEating =
        WorldDataLifecycleService._readMap(character.components['foodEating']);
    final Map<String, dynamic> destination =
        WorldDataLifecycleService._readMap(character.components['destination']);
    final _FoodEntityRef? eatingFoodRef =
        _resolveEatingFoodRef(entities: entities, foodEating: foodEating);
    final _FoodEntityRef? targetedFoodRef =
        _resolveTargetedFoodRef(entities: entities, destination: destination);

    return <String, Object?>{
      'characterState': character.state,
      'foodCount': foodCount,
      'eatingTargetRaw':
          WorldDataLifecycleService._readInt(foodEating['targetFood']),
      'eatingTargetObjectId':
          WorldDataLifecycleService._readInt(foodEating['targetFoodObjectId']),
      'resolvedEatingFoodObjectId': eatingFoodRef == null
          ? null
          : WorldDataLifecycleService._readInt(eatingFoodRef.object['id']),
      'resolvedEatingFoodState': eatingFoodRef == null
          ? null
          : WorldDataLifecycleService._readInt(eatingFoodRef.object['state']),
      'destinationTargetRaw':
          WorldDataLifecycleService._readInt(destination['target']),
      'destinationTargetObjectId':
          WorldDataLifecycleService._readInt(destination['targetObjectId']),
      'resolvedTargetFoodObjectId': targetedFoodRef == null
          ? null
          : WorldDataLifecycleService._readInt(targetedFoodRef.object['id']),
      'resolvedTargetFoodState': targetedFoodRef == null
          ? null
          : WorldDataLifecycleService._readInt(targetedFoodRef.object['state']),
    };
  }

  static int _countFoodEntities(List<dynamic> entities) {
    int count = 0;
    for (int index = 0; index < entities.length; index += 1) {
      if (_readFoodEntityRef(entities, index) != null) {
        count += 1;
      }
    }
    return count;
  }

  static bool isFoodStale(Map<String, dynamic> components) {
    return _resolveFoodFreshness(components) ==
        worldDataLifecycleFoodFreshnessStale;
  }

  static bool progressFoodFreshness(List<dynamic> entities, int nowMs) {
    bool changed = false;
    for (final dynamic entity in entities) {
      if (entity is! Map<String, dynamic>) {
        continue;
      }

      final Map<String, dynamic> components =
          WorldDataLifecycleService._readMap(entity['components']);
      final Map<String, dynamic> object =
          WorldDataLifecycleService._readMap(components['object']);
      if (WorldDataLifecycleService._readInt(object['type']) !=
          worldDataLifecycleFoodObjectType) {
        continue;
      }

      int? currentFreshness = _resolveFoodFreshness(components);
      if (currentFreshness == worldDataLifecycleFoodFreshnessFresh) {
        changed = _writeFoodFreshness(
              components,
              worldDataLifecycleFoodFreshnessNormal,
            ) ||
            changed;
        currentFreshness = worldDataLifecycleFoodFreshnessNormal;
      }

      final Map<String, dynamic> freshnessTimer =
          WorldDataLifecycleService._readMap(components['freshnessTimer']);
      if (WorldDataLifecycleService._readBool(freshnessTimer['isBeingEaten']) ==
          true) {
        continue;
      }

      final int? currentState =
          WorldDataLifecycleService._readInt(object['state']);
      if (currentFreshness == worldDataLifecycleFoodFreshnessStale) {
        if (currentState != worldDataLifecycleFoodStateBeingThrowing &&
            currentState != worldDataLifecycleFoodStateLanded) {
          object['state'] = worldDataLifecycleFoodStateLanded;
          changed = true;
        }
        continue;
      }

      final int? createdTime =
          WorldDataLifecycleService._readInt(freshnessTimer['createdTime']);
      if (createdTime == null) {
        continue;
      }
      final int staleTime = math.max(
        0,
        WorldDataLifecycleService._readInt(freshnessTimer['staleTime']) ??
            worldDataLifecycleFoodNormalToStaleMs,
      );
      if (nowMs - createdTime < staleTime) {
        continue;
      }

      changed = _writeFoodFreshness(
            components,
            worldDataLifecycleFoodFreshnessStale,
          ) ||
          changed;
      object['state'] = worldDataLifecycleFoodStateLanded;
      changed = true;
    }
    return changed;
  }

  static int? _resolveFoodFreshness(Map<String, dynamic> components) {
    final Map<String, dynamic> freshness =
        WorldDataLifecycleService._readMap(components['freshness']);
    final Map<String, dynamic> food =
        WorldDataLifecycleService._readMap(components['food']);
    return WorldDataLifecycleService._readInt(freshness['freshness']) ??
        WorldDataLifecycleService._readInt(food['freshness']);
  }

  static bool _writeFoodFreshness(
    Map<String, dynamic> components,
    int freshnessValue,
  ) {
    final Map<String, dynamic> freshness =
        WorldDataLifecycleService._readMap(components['freshness']);
    if (freshness.isNotEmpty) {
      if (WorldDataLifecycleService._readInt(freshness['freshness']) ==
          freshnessValue) {
        return false;
      }
      freshness['freshness'] = freshnessValue;
      return true;
    }

    final Map<String, dynamic> food =
        WorldDataLifecycleService._readMap(components['food']);
    if (food.isNotEmpty) {
      if (WorldDataLifecycleService._readInt(food['freshness']) ==
          freshnessValue) {
        return false;
      }
      food['freshness'] = freshnessValue;
      return true;
    }

    components['freshness'] = <String, dynamic>{
      'freshness': freshnessValue,
    };
    return true;
  }

  static double _getStaminaBonusForFoodTexture(int? textureKey) {
    if (textureKey == null ||
        textureKey < worldDataLifecycleFoodTextureKeyMin ||
        textureKey > worldDataLifecycleFoodTextureKeyMax) {
      return worldDataLifecycleDefaultFoodStaminaBonus;
    }
    final int foodIndex = textureKey - worldDataLifecycleFoodTextureKeyMin;
    return worldDataLifecycleFoodStaminaBonusDistribution[
            foodIndex % worldDataLifecycleFoodStaminaBonusDistribution.length]
        .toDouble();
  }

  static int countStaleFood(List<dynamic> entities) {
    int count = 0;
    for (final dynamic entity in entities) {
      if (entity is! Map<String, dynamic>) {
        continue;
      }
      final Map<String, dynamic> components =
          WorldDataLifecycleService._readMap(entity['components']);
      final Map<String, dynamic> object =
          WorldDataLifecycleService._readMap(components['object']);
      if (WorldDataLifecycleService._readInt(object['type']) !=
          worldDataLifecycleFoodObjectType) {
        continue;
      }
      if (WorldDataLifecycleService._readInt(object['state']) ==
          worldDataLifecycleFoodStateBeingThrowing) {
        continue;
      }
      if (isFoodStale(components)) {
        count += 1;
      }
    }
    return count;
  }
}
