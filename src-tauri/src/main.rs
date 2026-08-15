// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "macos")]
    if let Some(exit_code) = tamagrid_lib::run_process_guard_if_requested() {
        std::process::exit(exit_code);
    }
    tamagrid_lib::run()
}
