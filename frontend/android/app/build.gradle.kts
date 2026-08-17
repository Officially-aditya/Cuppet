import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

val releaseKeyPropertiesFile = rootProject.file("key.properties")
val releaseKeyProperties = Properties()
if (releaseKeyPropertiesFile.exists()) {
    releaseKeyPropertiesFile.inputStream().use { releaseKeyProperties.load(it) }
}

fun requiredReleaseKeyProperty(name: String): String =
    releaseKeyProperties.getProperty(name)
        ?: error("Missing $name in ${releaseKeyPropertiesFile.path}")

android {
    namespace = "in.cuppet.app"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "in.cuppet.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appAuthRedirectScheme"] = "sydney"
    }

    signingConfigs {
        create("release") {
            if (releaseKeyPropertiesFile.exists()) {
                keyAlias = requiredReleaseKeyProperty("keyAlias")
                keyPassword = requiredReleaseKeyProperty("keyPassword")
                storeFile = rootProject.file(requiredReleaseKeyProperty("storeFile"))
                storePassword = requiredReleaseKeyProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
