package com.slidemino.app;

import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.slidemino.app.plugins.StoreInstallPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);

        // Android 15+ edge-to-edge 지원
        EdgeToEdge.enable(
            this,
            SystemBarStyle.dark(Color.TRANSPARENT),
            SystemBarStyle.dark(Color.TRANSPARENT)
        );

        // Android 12+ Splash Screen API를 즉시 종료
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> false);
        getApplication().setTheme(R.style.AppTheme_NoActionBar);
        setTheme(R.style.AppTheme_NoActionBar);

        // 스토어 설치 여부를 네이티브에서 판별하는 커스텀 플러그인 등록
        registerPlugin(StoreInstallPlugin.class);

        super.onCreate(savedInstanceState);
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
        hideNativeActionBarViews();
        getWindow().getDecorView().post(this::hideNativeActionBarViews);
        configureSystemBars();
        getWindow().getDecorView().post(this::configureSystemBars);

        // 🛡️ 시스템 accessibility font scaling 차단
        // OS 글꼴 크기 설정을 100%로 고정하여 WebView 내 UI 붕괴 방지
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            webView.getSettings().setTextZoom(100);
        }
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightNavigationBars(false);
        int systemUiVisibility = window.getDecorView().getSystemUiVisibility();
        systemUiVisibility &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            systemUiVisibility &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(systemUiVisibility);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
    }

    private void hideNativeActionBarViews() {
        hideSystemViewByName("action_bar_container");
        hideSystemViewByName("action_bar");
    }

    private void hideSystemViewByName(String idName) {
        int id = getResources().getIdentifier(idName, "id", "android");
        if (id == 0) return;
        View view = findViewById(id);
        if (view != null) {
            view.setVisibility(View.GONE);
        }
    }
}
