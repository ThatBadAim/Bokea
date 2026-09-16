package com.bokea.app;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

/**
 * Bokeà on Android is the web app in Bokeà/wwwroot, run from the APK.
 *
 * Nothing about the app is decided here. The one thing this adds is edge to
 * edge: the page is drawn behind the status bar and the gesture bar, and
 * Capacitor hands the insets to CSS, which the web app already reads through
 * env(safe-area-inset-*). Android 15 does this whether asked or not; asking
 * makes every older phone behave the same way.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Has to come before super.onCreate, which is where the window is set up.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
