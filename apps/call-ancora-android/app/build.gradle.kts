plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.ancorasaude.callancora"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.ancorasaude.callancora"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-prova"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("com.google.android.material:material:1.12.0")
    // Leitura do QR de pareamento (ZXing embutido, sem Google Play Services).
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    // Token do dispositivo guardado criptografado.
    implementation("androidx.security:security-crypto:1.0.0")
    // Animações do app: molas com física (troca de tela, contato chegando, contador) e transições.
    implementation("androidx.dynamicanimation:dynamicanimation:1.0.0")
    implementation("androidx.transition:transition:1.5.0")
    testImplementation("junit:junit:4.13.2")
}
