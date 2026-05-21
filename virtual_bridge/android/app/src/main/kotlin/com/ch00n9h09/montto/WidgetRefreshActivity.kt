package com.ch00n9h09.montto

import android.os.Bundle
import android.os.Handler
import android.os.Looper

class WidgetRefreshActivity : MainActivity() {
    private val finishHandler = Handler(Looper.getMainLooper())
    private val fallbackFinishRunnable = Runnable {
        finish()
        overridePendingTransition(0, 0)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        finishHandler.postDelayed(fallbackFinishRunnable, 20_000)
        overridePendingTransition(0, 0)
    }

    override fun onDestroy() {
        finishHandler.removeCallbacks(fallbackFinishRunnable)
        super.onDestroy()
    }

    override fun isWidgetRefreshMode(): Boolean = true
}
