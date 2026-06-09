const String worldDataStorageKey = 'MainSceneWorldData';
const String worldDataSnapshotStorageKey = 'HomeWidgetSnapshotV1';
const String worldDataAuthoritativeSnapshotStorageKey =
    'HomeWidgetAuthoritativeSnapshotV1';
const String nativeWorldDataSnapshotKey = 'home_widget_snapshot_v1';
const String nativeWorldDataAuthoritativeSnapshotKey =
    'home_widget_authoritative_snapshot_v1';
const String nativeWorldDataStorageName = 'digivice_home_widget';
const String widgetRefreshLaunchMode = 'widget_refresh';
const String periodicRefreshReason = 'periodic_work';
const String periodicRefreshStatusKey = 'home_widget_periodic_refresh_status';
const String periodicRefreshStatusAtMsKey =
    'home_widget_periodic_refresh_status_at_ms';

const int characterObjectType = 1;
const int characterStateEgg = 0;
const int characterStateIdle = 1;
const int characterStateMoving = 2;
const int characterStateSleeping = 3;
const int characterStateSick = 4;
const int characterStateEating = 5;
const int characterStateDead = 6;

const int characterStatusUrgent = 2;
const int characterStatusSick = 3;
const int characterStatusHappy = 4;
const int characterStatusDiscover = 5;

const int eggTextureKeyStart = 500;
const int eggTextureKeyEnd = 529;
const int defaultEggHatchDurationMs = 30 * 60 * 1000;

const double maxStamina = 10;
const double lowStaminaThreshold = 3;
const double boostedStaminaThreshold = 7;
const int animationFrameCount = 4;

const int staminaDecreaseIntervalMs = 12 * 60 * 1000;
const double staminaDecreaseAmount = 0.25;
const double highStaminaDecayMultiplier = 1.3;
const double lowStaminaDecayMultiplier = 0.7;
const double sleepingStaminaDecayMultiplier = 0.2;
const int projectionVersion = 1;
