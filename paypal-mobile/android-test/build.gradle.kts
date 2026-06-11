// 根项目的 Gradle 配置。
// 只声明插件版本 (apply false), 真正应用插件在子模块 app/build.gradle.kts 里。

plugins {
    id("com.android.application") version "8.7.1" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
