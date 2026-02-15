package com.slidemino.app.plugins;

import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "StoreInstall")
public class StoreInstallPlugin extends Plugin {

    private static final Set<String> TRUSTED_STORE_INSTALLERS = new HashSet<>(
        Arrays.asList(
            "com.android.vending", // Google Play
            "com.amazon.venezia", // Amazon Appstore
            "com.sec.android.app.samsungapps", // Galaxy Store
            "com.huawei.appmarket", // Huawei AppGallery
            "com.onestore.app", // ONE store
            "com.onestorecorp.gaa.storeapp", // ONE store (global)
            "com.skt.skaf.A000Z00040", // ONE store SKT
            "com.kt.olleh.storefront", // ONE store KT
            "com.lguplus.appstore", // ONE store LG U+
            "com.dti.folderlauncher" // ONE store 글로벌 배포 계열(구형 기기)
        )
    );

    @PluginMethod
    public void getInstallInfo(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        String packageName = getContext().getPackageName();

        String installerPackage = null;
        String initiatingPackage = null;
        int packageSource = -1;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                InstallSourceInfo sourceInfo = packageManager.getInstallSourceInfo(packageName);
                installerPackage = sourceInfo.getInstallingPackageName();
                initiatingPackage = sourceInfo.getInitiatingPackageName();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    packageSource = sourceInfo.getPackageSource();
                }
            } else {
                installerPackage = packageManager.getInstallerPackageName(packageName);
                initiatingPackage = installerPackage;
            }
        } catch (Exception ignored) {
            // 조회 실패 시에도 앱 로직은 안전하게 계속 동작한다.
        }

        boolean packageSourceSaysStore = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && packageSource != -1) {
            packageSourceSaysStore = packageSource == PackageInstaller.PACKAGE_SOURCE_STORE;
        }

        boolean installerSaysStore = installerPackage != null && TRUSTED_STORE_INSTALLERS.contains(installerPackage);
        boolean isStoreInstall = packageSourceSaysStore || installerSaysStore;

        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("installerPackage", installerPackage);
        result.put("initiatingPackage", initiatingPackage);
        result.put("packageSource", packageSource);
        result.put("isStoreInstall", isStoreInstall);
        result.put("channel", resolveChannel(isStoreInstall, installerPackage, packageSource));

        call.resolve(result);
    }

    private String resolveChannel(boolean isStoreInstall, String installerPackage, int packageSource) {
        if (isStoreInstall) {
            return "store";
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && packageSource != -1) {
            if (packageSource == PackageInstaller.PACKAGE_SOURCE_LOCAL_FILE || packageSource == PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE) {
                return "sideload";
            }
        }

        if (installerPackage == null || installerPackage.isEmpty()) {
            return "sideload";
        }

        if (installerPackage.contains("packageinstaller")) {
            return "sideload";
        }

        return "non_store_installer";
    }
}
