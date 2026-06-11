// App 模块的 Gradle 配置 (Kotlin DSL)。
// 整个测试 app 只有这一个模块, 所有依赖 / SDK 版本都在这里声明。

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ppgms.paypalmobiletest"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ppgms.paypalmobiletest"
        // minSdk 23 跟 PayPal Android SDK 官方最低要求保持一致
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    // AndroidX 基础库 + Activity 的 KTX 扩展
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    // 提供 lifecycleScope, 让协程跟随 Activity 生命周期自动取消
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    // 协程支持 (IO 调度器 + suspend 函数)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    // Material3 组件 (MaterialCardView 等)
    implementation("com.google.android.material:material:1.12.0")

    // PayPal Mobile SDK — 支付逻辑 (启动浏览器 + 处理 return intent)
    implementation("com.paypal.android:paypal-web-payments:2.3.0")
    // PayPal Mobile SDK — 官方按钮组件 (PayPalButton / PayLaterButton / PayPalCreditButton)
    implementation("com.paypal.android:payment-buttons:2.3.0")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
