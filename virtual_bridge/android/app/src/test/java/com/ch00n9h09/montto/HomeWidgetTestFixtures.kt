package com.ch00n9h09.montto

import android.content.SharedPreferences

internal class FakeSharedPreferences : SharedPreferences {
    private val values = linkedMapOf<String, Any?>()

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(key: String?, defValue: String?): String? {
        return values[key] as? String ?: defValue
    }

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? {
        val stored = values[key] as? Set<String>
        return stored?.toMutableSet() ?: defValues
    }

    override fun getInt(key: String?, defValue: Int): Int {
        return values[key] as? Int ?: defValue
    }

    override fun getLong(key: String?, defValue: Long): Long {
        return values[key] as? Long ?: defValue
    }

    override fun getFloat(key: String?, defValue: Float): Float {
        return values[key] as? Float ?: defValue
    }

    override fun getBoolean(key: String?, defValue: Boolean): Boolean {
        return values[key] as? Boolean ?: defValue
    }

    override fun contains(key: String?): Boolean {
        return values.containsKey(key)
    }

    override fun edit(): SharedPreferences.Editor = Editor(values)

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) = Unit

    private class Editor(
        private val values: MutableMap<String, Any?>,
    ) : SharedPreferences.Editor {
        private val pending = linkedMapOf<String, Any?>()
        private var clearRequested = false

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putStringSet(
            key: String?,
            values: MutableSet<String>?,
        ): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = values?.toSet()
        }

        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = value
        }

        override fun remove(key: String?): SharedPreferences.Editor = apply {
            pending[key.orEmpty()] = null
        }

        override fun clear(): SharedPreferences.Editor = apply {
            clearRequested = true
            pending.clear()
        }

        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            if (clearRequested) {
                values.clear()
                clearRequested = false
            }
            pending.forEach { (key, value) ->
                if (value == null) {
                    values.remove(key)
                } else {
                    values[key] = value
                }
            }
            pending.clear()
        }
    }
}

internal fun buildHomeWidgetEggWorldData(
    hatchTimeMs: Long,
    resetMarkerId: String,
    pendingCharacterKey: Int,
    lastEcsSaved: Long = 1000L,
    syringeCount: Int = 0,
    positionX: Double = 100.0,
    positionY: Double = 100.0,
    extraEntitiesJson: String = "",
): String {
    val extraEntities = extraEntitiesJson.takeIf { it.isNotBlank() }
        ?.let { ",$it" }
        ?: ""
    return """
        {
          "world_metadata": {
            "name": "MainScene",
            "monster_name": "Test",
            "last_ecs_saved": $lastEcsSaved,
            "version": "1.0.0",
            "app_state": {
              "last_active_time": $lastEcsSaved,
              "use_local_time": true,
              "reset_bootstrap_marker_id": "$resetMarkerId"
            }
          },
          "entities": [
            {
              "components": {
                "object": {
                  "id": 10,
                  "type": 1,
                  "state": 0
                },
                "characterStatus": {
                  "characterKey": 0,
                  "stamina": 5,
                  "evolutionPhase": 0,
                  "statuses": []
                },
                "position": {
                  "x": $positionX,
                  "y": $positionY
                },
                "angle": {
                  "value": 0
                },
                "speed": {
                  "value": 0
                },
                "eggHatch": {
                  "hatchTime": $hatchTimeMs,
                  "hatchDurationMs": 30000,
                  "isReadyToHatch": true,
                  "syringeCount": $syringeCount,
                  "pendingCharacterKey": $pendingCharacterKey
                },
                "render": {
                  "textureKey": 517
                }
              }
            }
            $extraEntities
          ]
        }
    """.trimIndent()
}

internal fun buildHomeWidgetFoodEntityJson(
    id: Int = 20,
    state: Int = 2,
    freshness: Int = 2,
    createdTime: Long = 1000L,
    staleTime: Long = 10 * 60 * 1000L,
): String {
    return """
        {
          "components": {
            "object": {
              "id": $id,
              "type": 3,
              "state": $state
            },
            "position": {
              "x": 200,
              "y": 100
            },
            "freshness": {
              "freshness": $freshness
            },
            "freshnessTimer": {
              "createdTime": $createdTime,
              "staleTime": $staleTime,
              "isBeingEaten": false
            },
            "render": {
              "textureKey": 545,
              "scale": 3
            }
          }
        }
    """.trimIndent()
}


internal fun buildHomeWidgetCharacterWorldData(
    state: Int = 1,
    lastEcsSaved: Long = 1_000L,
    characterKey: Int = 1,
    evolutionPhase: Int = 1,
    evolutionGage: Double = 0.0,
    stamina: Double = 5.0,
    fatigue: Double = 35.0,
    nextDiseaseCheckTime: Long = 60_000L,
    nextNapCheckTime: Long = 60_000L,
    nextSleepTime: Long = 0L,
    nextWakeTime: Long = 0L,
    sleepMode: Int = 0,
    pendingSleepReason: Int = 0,
    sleepSessionStartedAt: Long = 0L,
    statuses: String = "[]",
    sickStartTime: Long = 0L,
    mutationRiskJson: String? = null,
    extraEntitiesJson: String = "",
): String {
    val mutationRisk = mutationRiskJson?.let { ""","mutationRisk":$it""" } ?: ""
    val extraEntities = extraEntitiesJson.takeIf { it.isNotBlank() }
        ?.let { ",$it" }
        ?: ""
    return """
        {
          "world_metadata": {
            "name": "MainScene",
            "monster_name": "Test",
            "last_ecs_saved": $lastEcsSaved,
            "version": "1.0.0",
            "app_state": {
              "last_active_time": $lastEcsSaved,
              "use_local_time": false,
              "reset_bootstrap_marker_id": "reset-current"
            }
          },
          "entities": [
            {
              "components": {
                "object": {
                  "id": 10,
                  "type": 1,
                  "state": $state
                },
                "characterStatus": {
                  "characterKey": $characterKey,
                  "stamina": $stamina,
                  "evolutionPhase": $evolutionPhase,
                  "evolutionGage": $evolutionGage,
                  "statuses": $statuses
                },
                "diseaseSystem": {
                  "nextCheckTime": $nextDiseaseCheckTime,
                  "sickStartTime": $sickStartTime
                },
                "sleepSystem": {
                  "fatigue": $fatigue,
                  "nextSleepTime": $nextSleepTime,
                  "nextWakeTime": $nextWakeTime,
                  "nextNapCheckTime": $nextNapCheckTime,
                  "nextNightWakeCheckTime": 0,
                  "sleepMode": $sleepMode,
                  "pendingSleepReason": $pendingSleepReason,
                  "pendingWakeReason": 0,
                  "sleepSessionStartedAt": $sleepSessionStartedAt
                },
                "eggHatch": {
                  "hatchTime": 0,
                  "hatchDurationMs": 0,
                  "isReadyToHatch": false,
                  "syringeCount": 0,
                  "pendingCharacterKey": 0
                },
                "render": {
                  "textureKey": 1
                }
                $mutationRisk
              }
            }
            $extraEntities
          ]
        }
    """.trimIndent()
}
