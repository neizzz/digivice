package com.ch00n9h09.montto

internal object WorldDataSnapshotConfig {
    const val CHARACTER_OBJECT_TYPE = 1
    const val EGG_TEXTURE_KEY_START = 500
    const val EGG_TEXTURE_KEY_END = 529
    const val DEFAULT_EGG_HATCH_DURATION_MS = 30 * 60 * 1000L
    const val CHARACTER_STATE_EGG = 0
    const val CHARACTER_STATE_IDLE = 1
    const val CHARACTER_STATE_MOVING = 2
    const val CHARACTER_STATE_SLEEPING = 3
    const val CHARACTER_STATE_SICK = 4
    const val CHARACTER_STATE_EATING = 5
    const val CHARACTER_STATE_DEAD = 6

    const val CHARACTER_STATUS_URGENT = 2
    const val CHARACTER_STATUS_SICK = 3
    const val CHARACTER_STATUS_HAPPY = 4
    const val CHARACTER_STATUS_DISCOVER = 5

    const val MAX_STAMINA = 10.0
    const val LOW_STAMINA_THRESHOLD = 3.0
    const val BOOSTED_STAMINA_THRESHOLD = 7.0
    const val ANIMATION_FRAME_COUNT = 4

    const val STAMINA_DECREASE_INTERVAL_MS = 12 * 60 * 1000.0
    const val STAMINA_DECREASE_AMOUNT = 0.25
    const val HIGH_STAMINA_DECAY_MULTIPLIER = 1.3
    const val LOW_STAMINA_DECAY_MULTIPLIER = 0.7
    const val SLEEPING_STAMINA_DECAY_MULTIPLIER = 0.2
    const val PROJECTION_VERSION = 1
}
