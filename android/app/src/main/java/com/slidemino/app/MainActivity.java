package com.slidemino.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.slidemino.app.plugins.StoreInstallPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Android 12+ Splash Screen API를 즉시 종료
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> false);

        // 스토어 설치 여부를 네이티브에서 판별하는 커스텀 플러그인 등록
        registerPlugin(StoreInstallPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
