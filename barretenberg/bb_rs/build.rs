use cmake::Config;
use std::env;
use std::path::PathBuf;

fn main() {
    // Notify Cargo to rerun this build script if `build.rs` changes.
    println!("cargo:rerun-if-changed=build.rs");

    // cfg!(target_os = "<os>") does not work so we get the value
    // of the target_os environment variable to determine the target OS.
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();

    // Build the C++ code using CMake and get the build directory path.
    let dst;
    // iOS
    if target_os == "ios" {
        dst = Config::new("../cpp")
            .generator("Ninja")
            .configure_arg("-DCMAKE_BUILD_TYPE=RelWithAssert")
            .configure_arg("-DPLATFORM=OS64")
            .configure_arg("-DDEPLOYMENT_TARGET=14.0")
            .configure_arg("--toolchain=../cpp/ios.toolchain.cmake")
            .build_target("bb")
            .build();
    }
    // Android
    else if target_os == "android" {
        let android_abi = if env::var("CARGO_CFG_TARGET_ARCH").unwrap() == "arm" {
            "armeabi-v7a"
        } else {
            "arm64-v8a"
        };

        dst = Config::new("../cpp")
            .generator("Ninja")
            .configure_arg("-DCMAKE_BUILD_TYPE=RelWithAssert")
            .configure_arg(&format!("-DANDROID_ABI={}", android_abi))
            .configure_arg("-DANDROID_PLATFORM=android-33")
            .configure_arg(&format!(
                "--toolchain={}/ndk/{}/build/cmake/android.toolchain.cmake",
                env!("ANDROID_HOME"),
                env!("NDK_VERSION")
            ))
            .build_target("bb")
            .build();
    }
    // MacOS and other platforms
    else {
        dst = Config::new("../cpp")
            .generator("Ninja")
            .configure_arg("-DCMAKE_BUILD_TYPE=RelWithAssert")
            .build_target("bb")
            .build();
    }

    // Add the library search path for Rust to find during linking.
    println!("cargo:rustc-link-search={}/build/lib", dst.display());

    // Link the `barretenberg` static library.
    println!("cargo:rustc-link-lib=static=barretenberg");

    // Link the C++ standard library.
    if cfg!(target_os = "macos") || cfg!(target_os = "ios") {
        println!("cargo:rustc-link-lib=c++");
    } else {
        println!("cargo:rustc-link-lib=stdc++");
    }

    let mut builder = bindgen::Builder::default();

    if target_os == "android" {
        let android_abi = if env::var("CARGO_CFG_TARGET_ARCH").unwrap() == "arm" {
            "armeabi-v7a"
        } else {
            "arm64-v8a"
        };

        builder = builder
            // Add the include path for headers.
            .clang_args([
                "-std=c++20",
                "-xc++",
                &format!("-I{}/build/include", dst.display()),
                &format!(
                    "-I{}/ndk/{}/toolchains/llvm/prebuilt/{}/sysroot/usr/include/c++/v1",
                    env!("ANDROID_HOME"),
                    env!("NDK_VERSION"),
                    env!("HOST_TAG")
                ),
                &format!(
                    "-I{}/ndk/{}/toolchains/llvm/prebuilt/{}/sysroot/usr/include",
                    env!("ANDROID_HOME"),
                    env!("NDK_VERSION"),
                    env!("HOST_TAG")
                ),
                &format!(
                    "-I{}/ndk/{}/toolchains/llvm/prebuilt/{}/sysroot/usr/include/{}",
                    env!("ANDROID_HOME"),
                    env!("NDK_VERSION"),
                    env!("HOST_TAG"),
                    if android_abi == "armeabi-v7a" {
                        "arm-linux-androideabi"
                    } else {
                        "aarch64-linux-android"
                    }
                ),
            ]);
    } else if target_os == "ios" {
        builder = builder
        // Add the include path for headers.
        .clang_args([
            "-std=c++20",
            "-xc++",
            &format!("-I{}/build/include", dst.display()),
            "-I/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/usr/include/c++/v1",
            "-I/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/usr/include"
        ]);
    } else if target_os == "macos" {
        builder = builder
            // Add the include path for headers.
            .clang_args([
                "-std=c++20",
                "-xc++",
                &format!("-I{}/build/include", dst.display()),
                "-I/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/usr/include/c++/v1",
                "-I/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/usr/include",
            ]);
    } else {
        builder = builder
            // Add the include path for headers.
            .clang_args([
                "-std=c++20",
                "-xc++",
                &format!("-I{}/build/include", dst.display()),
            ]);
    }

    let bindings = builder
        // The input header we would like to generate bindings for.
        .header_contents(
            "wrapper.hpp",
            r#"
                #include <barretenberg/crypto/pedersen_commitment/c_bind.hpp>
                #include <barretenberg/crypto/pedersen_hash/c_bind.hpp>
                #include <barretenberg/crypto/poseidon2/c_bind.hpp>
                #include <barretenberg/crypto/blake2s/c_bind.hpp>
                #include <barretenberg/crypto/schnorr/c_bind.hpp>
                #include <barretenberg/srs/c_bind.hpp>
                #include <barretenberg/examples/simple/c_bind.hpp>
                #include <barretenberg/common/c_bind.hpp>
                #include <barretenberg/dsl/acir_proofs/c_bind.hpp>
            "#,
        )
        .allowlist_function("pedersen_commit")
        .allowlist_function("pedersen_hash")
        .allowlist_function("pedersen_hashes")
        .allowlist_function("pedersen_hash_buffer")
        .allowlist_function("poseidon_hash")
        .allowlist_function("poseidon_hashes")
        .allowlist_function("blake2s")
        .allowlist_function("blake2s_to_field_")
        .allowlist_function("schnorr_construct_signature")
        .allowlist_function("schnorr_verify_signature")
        .allowlist_function("schnorr_multisig_create_multisig_public_key")
        .allowlist_function("schnorr_multisig_validate_and_combine_signer_pubkeys")
        .allowlist_function("schnorr_multisig_construct_signature_round_1")
        .allowlist_function("schnorr_multisig_construct_signature_round_2")
        .allowlist_function("schnorr_multisig_combine_signatures")
        .allowlist_function("aes_encrypt_buffer_cbc")
        .allowlist_function("aes_decrypt_buffer_cbc")
        .allowlist_function("srs_init_srs")
        .allowlist_function("srs_init_grumpkin_srs")
        .allowlist_function("examples_simple_create_and_verify_proof")
        .allowlist_function("test_threads")
        .allowlist_function("common_init_slab_allocator")
        .allowlist_function("acir_get_circuit_sizes")
        .allowlist_function("acir_new_acir_composer")
        .allowlist_function("acir_new_goblin_acir_composer")
        .allowlist_function("acir_delete_acir_composer")
        .allowlist_function("acir_create_circuit")
        .allowlist_function("acir_init_proving_key")
        .allowlist_function("acir_create_proof")
        .allowlist_function("acir_goblin_accumulate")
        .allowlist_function("acir_goblin_prove")
        .allowlist_function("acir_load_verification_key")
        .allowlist_function("acir_init_verification_key")
        .allowlist_function("acir_get_verification_key")
        .allowlist_function("acir_get_proving_key")
        .allowlist_function("acir_verify_proof")
        .allowlist_function("acir_goblin_verify_accumulator")
        .allowlist_function("acir_goblin_verify")
        .allowlist_function("acir_get_solidity_verifier")
        .allowlist_function("acir_serialize_proof_into_fields")
        .allowlist_function("acir_serialize_verification_key_into_fields")
        .allowlist_function("acir_prove_ultra_honk")
        .allowlist_function("acir_verify_ultra_honk")
        .allowlist_function("acir_write_vk_ultra_honk")
        .allowlist_function("acir_prove_and_verify_ultra_honk")
        // Tell cargo to invalidate the built crate whenever any of the included header files changed.
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        // Finish the builder and generate the bindings.
        .generate()
        // Unwrap the Result and panic on failure.
        .expect("Unable to generate bindings");

    // Write the bindings to the $OUT_DIR/bindings.rs file.
    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}
