package com.ch00n9h09.montto

object WorldDataSnapshotFactory {
    internal fun requiresAuthoritativeRefresh(
        authoritativeSnapshot: HomeWidgetSnapshot?,
        nowMs: Long,
    ): Boolean {
        if (authoritativeSnapshot == null) {
            return true
        }

        if (authoritativeSnapshot.characterState == "egg") {
            return isEggMaturedPastHatchTime(authoritativeSnapshot, nowMs)
        }

        return isAuthoritativeSnapshotStale(authoritativeSnapshot, nowMs)
    }

    internal fun isAuthoritativeSnapshotStale(
        snapshot: HomeWidgetSnapshot,
        nowMs: Long,
    ): Boolean {
        if (snapshot.characterState == "egg") {
            return false
        }

        val completedAtMs = snapshot.snapshotComputedAtMs
            .takeIf { it > 0L }
            ?: snapshot.updatedAtMs.takeIf { it > 0L }
            ?: return true
        val staleAfterMs = HomeWidgetConstants.PERIODIC_REFRESH_INTERVAL_MINUTES *
            60 * 1000L

        return nowMs - completedAtMs >= staleAfterMs
    }

    internal fun isEggMaturedPastHatchTime(
        snapshot: HomeWidgetSnapshot?,
        nowMs: Long,
    ): Boolean {
        return snapshot?.characterState == "egg" &&
            snapshot.eggHatchTimeMs?.let { it <= nowMs } == true
    }
}
