// Gradle 项目结构配置。
// 声明插件仓库 + 依赖仓库, 并把 :app 模块加入到 build 中。

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    // 禁止子模块再声明自己的仓库, 强制统一从这里读
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "android-test"
include(":app")
