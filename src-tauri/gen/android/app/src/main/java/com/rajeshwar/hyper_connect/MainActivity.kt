package com.rajeshwar.hyper_connect

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import android.net.wifi.WifiManager
import android.content.Context

class MainActivity : TauriActivity() {
    private var multicastLock: WifiManager.MulticastLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
    }

    override fun onResume() {
        super.onResume()
        // Acquire multicast lock so mDNS packets aren't filtered by Android
        val wifiManager = applicationContext.getSystemService(
            Context.WIFI_SERVICE
        ) as WifiManager
        multicastLock = wifiManager.createMulticastLock("LanShareMDNS")
        multicastLock?.acquire()
    }

    override fun onPause() {
        super.onPause()
        multicastLock?.release()
    }
}
