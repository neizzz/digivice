export 'world_data_constants.dart'
    show
        characterObjectType,
        characterStateEgg,
        characterStateIdle,
        characterStateMoving,
        characterStateSleeping,
        characterStateSick,
        characterStateEating,
        characterStateDead,
        characterStatusUrgent,
        characterStatusSick,
        characterStatusHappy,
        characterStatusDiscover,
        eggTextureKeyStart,
        eggTextureKeyEnd,
        defaultEggHatchDurationMs,
        maxStamina,
        lowStaminaThreshold,
        boostedStaminaThreshold,
        animationFrameCount,
        staminaDecreaseIntervalMs,
        staminaDecreaseAmount,
        highStaminaDecayMultiplier,
        lowStaminaDecayMultiplier,
        sleepingStaminaDecayMultiplier,
        projectionVersion;

// World-data storage/snapshot wire keys live here. Some persisted string values
// intentionally keep their legacy `home_widget` names for Android/Flutter
// compatibility, but ownership is world-data, not the widget UI surface. Do not
// add gameplay/world-data balance constants here; edit world_data_constants.dart
// instead and regenerate the TypeScript constants.
const String worldDataStorageKey = 'MainSceneWorldData';
const String monsterBookStorageKey = 'MonsterBookData';
const String worldDataSnapshotStorageKey = 'HomeWidgetSnapshotV1';
const String worldDataAuthoritativeSnapshotStorageKey =
    'HomeWidgetAuthoritativeSnapshotV1';
const String nativeWorldDataSnapshotKey = 'home_widget_snapshot_v1';
const String nativeWorldDataAuthoritativeSnapshotKey =
    'home_widget_authoritative_snapshot_v1';
const String nativeWorldDataStorageName = 'digivice_home_widget';
const String widgetRefreshLaunchMode = 'widget_refresh';
const String periodicRefreshReason = 'periodic_work';
const String widgetPeriodicRefreshSource = 'widget_periodic_refresh';
const String periodicRefreshStatusKey = 'home_widget_periodic_refresh_status';
const String periodicRefreshStatusAtMsKey =
    'home_widget_periodic_refresh_status_at_ms';
const String refreshSmokeResultKey = 'home_widget_refresh_smoke_last_result';
const String refreshCompletedAtMsKey = 'home_widget_refresh_completed_at_ms';
const String refreshInFlightKey = 'home_widget_refresh_in_flight';
