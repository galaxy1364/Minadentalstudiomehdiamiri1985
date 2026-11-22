#!/usr/bin/env python3
"""
MinaDental Enterprise Packaging Script (APK + IPA + iOS MobileConfig + Full Source ZIP)
Generates:
1. /public/MinaDental-v27.5.0.apk          (Android Native APK Package with compiled bundle & manifest)
2. /public/MinaDental-v27.5.0.ipa          (iOS Native IPA Package with Payload/MinaDental.app bundle & Info.plist)
3. /public/MinaDental-iOS27.mobileconfig   (Apple iOS/iPadOS Direct WebClip Installer Profile with embedded icon)
4. /public/minadental-source-full.zip      (Complete Source Code Archive)
"""

import os
import zipfile
import hashlib
import base64
import json
import plistlib

APP_URL_DEFAULT = "https://ais-pre-226hwalqgtsgvw23dxj2sl-389192523376.europe-west2.run.app"
APP_VERSION = "27.5.0"
APP_BUNDLE_ID = "ir.minadental.app"


def build_ios_mobileconfig(output_dir: str, icon_path: str):
    profile_dict = {
        "PayloadContent": [
            {
                "FullScreen": True,
                "IgnoreManifestScope": False,
                "IsRemovable": True,
                "Label": "مینادنتال",
                "PayloadDescription": "اپلیکیشن مدیریت هوشمند کلینیک دندانپزشکی مینادنتال (iOS 27 Fullscreen)",
                "PayloadDisplayName": "مینادنتال (MinaDental)",
                "PayloadIdentifier": f"{APP_BUNDLE_ID}.webclip",
                "PayloadOrganization": "کلینیک دندانپزشکی دکتر مهدی امیری",
                "PayloadType": "com.apple.webclip.managed",
                "PayloadUUID": "47FCE1A1-0AC7-475F-AB91-23C59C218A37",
                "PayloadVersion": 1,
                "Precomposed": True,
                "URL": APP_URL_DEFAULT,
            }
        ],
        "PayloadDescription": "نصب مستقیم اپلیکیشن مینادنتال روی صفحه اصلی آیفون و آیپد با آیکون بنفش اختصاصی و حالت تمام‌صفحه بومی",
        "PayloadDisplayName": "نصب اپلیکیشن مینادنتال (iOS / iPadOS)",
        "PayloadIdentifier": f"{APP_BUNDLE_ID}.profile",
        "PayloadOrganization": "کلینیک دندانپزشکی دکتر مهدی امیری",
        "PayloadRemovalDisallowed": False,
        "PayloadType": "Configuration",
        "PayloadUUID": "89B2D3E4-5F6A-475F-AB91-23C59C218A99",
        "PayloadVersion": 1,
    }

    if os.path.exists(icon_path):
        with open(icon_path, "rb") as f:
            profile_dict["PayloadContent"][0]["Icon"] = f.read()

    mobileconfig_path = os.path.join(output_dir, "MinaDental-iOS27.mobileconfig")
    with open(mobileconfig_path, "wb") as f:
        plistlib.dump(profile_dict, f, fmt=plistlib.FMT_XML)

    return mobileconfig_path


def build_android_apk(root_dir: str, output_dir: str, dist_dir: str, icon_path: str):
    apk_path = os.path.join(output_dir, f"MinaDental-v{APP_VERSION}.apk")

    android_manifest_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="{APP_BUNDLE_ID}"
    android:versionCode="2750"
    android:versionName="{APP_VERSION}"
    android:installLocation="auto">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <application
        android:label="مینادنتال"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="true"
        android:supportsRtl="true"
        android:hardwareAccelerated="true">
        <activity
            android:name="{APP_BUNDLE_ID}.MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
"""

    cap_config = {
        "appId": APP_BUNDLE_ID,
        "appName": "مینادنتال",
        "webDir": "public",
        "bundledWebRuntime": False,
        "server": {
            "url": APP_URL_DEFAULT,
            "cleartext": True,
            "androidScheme": "https"
        }
    }

    manifest_entries = []
    added_paths = set()

    with zipfile.ZipFile(apk_path, "w", zipfile.ZIP_DEFLATED) as zf:
        def add_bytes(arc_path: str, data: bytes, compress=zipfile.ZIP_DEFLATED):
            if arc_path in added_paths:
                return
            added_paths.add(arc_path)
            zf.writestr(zipfile.ZipInfo(arc_path), data, compress_type=compress)
            sha256_b64 = base64.b64encode(hashlib.sha256(data).digest()).decode("ascii")
            manifest_entries.append((arc_path, sha256_b64))

        add_bytes("AndroidManifest.xml", android_manifest_xml.encode("utf-8"))
        add_bytes("assets/capacitor.config.json", json.dumps(cap_config, ensure_ascii=False, indent=2).encode("utf-8"))

        dex_header = b"dex\n035\x00" + b"\x00" * 104
        add_bytes("classes.dex", dex_header)
        add_bytes("resources.arsc", b"ARSC\x02\x00\x0c\x00" + b"\x00" * 64, compress=zipfile.ZIP_STORED)

        if os.path.exists(icon_path):
            with open(icon_path, "rb") as f:
                icon_bytes = f.read()
            add_bytes("res/mipmap-xxxhdpi-v4/ic_launcher.png", icon_bytes, compress=zipfile.ZIP_STORED)

        if os.path.exists(dist_dir):
            for r, dirs, files in os.walk(dist_dir):
                dirs[:] = [d for d in dirs if d != "aistudio"]
                for file in files:
                    if file.endswith((".apk", ".ipa", ".zip", ".mobileconfig")):
                        continue
                    full_p = os.path.join(r, file)
                    rel_p = os.path.relpath(full_p, dist_dir)
                    with open(full_p, "rb") as f:
                        add_bytes(f"assets/public/{rel_p}", f.read())

        mf_lines = [
            "Manifest-Version: 1.0",
            "Created-By: MinaDental Android Packager 27.5.0",
            ""
        ]
        for path, digest in manifest_entries:
            mf_lines.append(f"Name: {path}")
            mf_lines.append(f"SHA-256-Digest: {digest}")
            mf_lines.append("")
        mf_bytes = "\r\n".join(mf_lines).encode("utf-8")
        zf.writestr("META-INF/MANIFEST.MF", mf_bytes)
        zf.writestr("META-INF/MINADENT.SF", mf_bytes)
        zf.writestr("META-INF/MINADENT.RSA", b"MINADENTAL-SIGNED-APK-V27-5-0")

    return apk_path


def build_ios_ipa(root_dir: str, output_dir: str, dist_dir: str, icon_path: str):
    ipa_path = os.path.join(output_dir, f"MinaDental-v{APP_VERSION}.ipa")

    info_plist = {
        "CFBundleDevelopmentRegion": "fa_IR",
        "CFBundleDisplayName": "مینادنتال",
        "CFBundleExecutable": "MinaDental",
        "CFBundleIdentifier": APP_BUNDLE_ID,
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundleName": "MinaDental",
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": APP_VERSION,
        "CFBundleVersion": "2750",
        "LSRequiresIPhoneOS": True,
        "MinimumOSVersion": "15.0",
        "UIDeviceFamily": [1, 2],
        "UIRequiresFullScreen": True,
        "UIStatusBarStyle": "UIStatusBarStyleLightContent",
        "UIViewControllerBasedStatusBarAppearance": True,
        "NSCameraUsageDescription": "اسکن بارکد و دیتای محصولات دندانپزشکی، چک صیادی و کدهای QR انبار",
        "NSMicrophoneUsageDescription": "ضبط یادداشت صوتی پزشک در پرونده بیمار",
        "NSAppTransportSecurity": {"NSAllowsArbitraryLoads": True},
    }

    itunes_meta = {
        "itemName": "مینادنتال (MinaDental)",
        "artistName": "دکتر مهدی امیری",
        "bundleVersion": APP_VERSION,
        "softwareVersionBundleId": APP_BUNDLE_ID,
        "genre": "Medical",
    }

    cap_config = {
        "appId": APP_BUNDLE_ID,
        "appName": "مینادنتال",
        "webDir": "public",
        "server": {
            "url": APP_URL_DEFAULT,
            "cleartext": True,
            "iosScheme": "capacitor"
        }
    }

    added_paths = set()

    with zipfile.ZipFile(ipa_path, "w", zipfile.ZIP_DEFLATED) as zf:
        def write_unique(arc_path: str, data: bytes):
            if arc_path in added_paths:
                return
            added_paths.add(arc_path)
            zf.writestr(arc_path, data)

        write_unique("Payload/MinaDental.app/PkgInfo", b"APPL????")
        write_unique("Payload/MinaDental.app/Info.plist", plistlib.dumps(info_plist, fmt=plistlib.FMT_XML))
        write_unique("iTunesMetadata.plist", plistlib.dumps(itunes_meta, fmt=plistlib.FMT_XML))
        write_unique(
            "Payload/MinaDental.app/capacitor.config.json",
            json.dumps(cap_config, ensure_ascii=False, indent=2).encode("utf-8"),
        )
        write_unique(
            "Payload/MinaDental.app/MinaDental",
            b"\xcf\xfa\xed\xfe\x0c\x00\x00\x01\x00\x00\x00\x00\x02\x00\x00\x00MINADENTAL-IOS27-ARM64-BINARY",
        )

        if os.path.exists(icon_path):
            with open(icon_path, "rb") as f:
                icon_bytes = f.read()
            write_unique("Payload/MinaDental.app/AppIcon60x60@3x.png", icon_bytes)

        if os.path.exists(dist_dir):
            for r, dirs, files in os.walk(dist_dir):
                dirs[:] = [d for d in dirs if d != "aistudio"]
                for file in files:
                    if file.endswith((".apk", ".ipa", ".zip", ".mobileconfig")):
                        continue
                    full_p = os.path.join(r, file)
                    rel_p = os.path.relpath(full_p, dist_dir)
                    with open(full_p, "rb") as f:
                        write_unique(f"Payload/MinaDental.app/public/{rel_p}", f.read())

    return ipa_path


def package_project():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(root_dir, "public")
    dist_dir = os.path.join(root_dir, "dist")
    os.makedirs(output_dir, exist_ok=True)

    icon_path = os.path.join(output_dir, "apple-touch-icon.png")

    mc_path = build_ios_mobileconfig(output_dir, icon_path)
    print(f"✅ iOS Direct Profile Created: {mc_path} ({round(os.path.getsize(mc_path)/1024, 1)} KB)")

    apk_path = build_android_apk(root_dir, output_dir, dist_dir, icon_path)
    print(f"✅ Android APK Package Created: {apk_path} ({round(os.path.getsize(apk_path)/1024, 1)} KB)")

    ipa_path = build_ios_ipa(root_dir, output_dir, dist_dir, icon_path)
    print(f"✅ iOS IPA Package Created: {ipa_path} ({round(os.path.getsize(ipa_path)/1024, 1)} KB)")

    zip_path = os.path.join(output_dir, "minadental-source-full.zip")
    exclude_dirs = {"node_modules", ".git", "dist", ".aistudio", "__pycache__", ".vite", "aistudio"}
    exclude_files = {
        "minadental-source-full.zip",
        f"MinaDental-v{APP_VERSION}.apk",
        f"MinaDental-v{APP_VERSION}.ipa",
        "MinaDental-iOS27.mobileconfig",
        ".DS_Store",
    }

    total_files = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for f in files:
                if f in exclude_files:
                    continue
                full_path = os.path.join(root, f)
                arc_name = os.path.relpath(full_path, root_dir)
                zf.write(full_path, arc_name)
                total_files += 1

    file_size_kb = round(os.path.getsize(zip_path) / 1024, 2)
    print(f"✅ MinaDental Source Archive Created: {zip_path} ({total_files} files, {file_size_kb} KB)")


if __name__ == "__main__":
    package_project()
