mod codex;

use codex::AppServerManager;
use tauri::Manager;

const EXIT_DISCONNECT_TIMEOUT: tokio::time::Duration = tokio::time::Duration::from_secs(5);

macro_rules! tamagrid_handlers {
    () => {
        tauri::generate_handler![
            codex::manager::detect_codex,
            codex::manager::choose_codex_executable,
            codex::manager::use_auto_detect_codex,
            codex::manager::connect_app_server,
            codex::manager::disconnect_app_server,
            codex::manager::codex_account_read,
            codex::manager::codex_rate_limits_read,
            codex::manager::codex_model_list,
            codex::manager::codex_thread_start,
            codex::manager::codex_thread_list,
            codex::manager::codex_thread_resume,
            codex::manager::codex_thread_read,
            codex::manager::codex_thread_name_set,
            codex::manager::codex_review_start,
            codex::manager::codex_turn_start,
            codex::manager::codex_turn_steer,
            codex::manager::codex_turn_interrupt,
            codex::manager::approve_request,
        ]
    };
    ($($extra:path),+ $(,)?) => {
        tauri::generate_handler![
            codex::manager::detect_codex,
            codex::manager::choose_codex_executable,
            codex::manager::use_auto_detect_codex,
            codex::manager::connect_app_server,
            codex::manager::disconnect_app_server,
            codex::manager::codex_account_read,
            codex::manager::codex_rate_limits_read,
            codex::manager::codex_model_list,
            codex::manager::codex_thread_start,
            codex::manager::codex_thread_list,
            codex::manager::codex_thread_resume,
            codex::manager::codex_thread_read,
            codex::manager::codex_thread_name_set,
            codex::manager::codex_review_start,
            codex::manager::codex_turn_start,
            codex::manager::codex_turn_steer,
            codex::manager::codex_turn_interrupt,
            codex::manager::approve_request,
            $($extra),+
        ]
    };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            .with_state_flags(window_state_flags())
            .build(),
    );

    let builder = builder
        // Dialog access stays in trusted Rust commands. No dialog capability is
        // granted to the WebView.
        .plugin(tauri_plugin_dialog::init())
        .manage(AppServerManager::default());
    #[cfg(feature = "packaged-soak-test")]
    let builder = builder.manage(codex::soak::ProcessTreeProbeState::default());
    #[cfg(feature = "packaged-soak-test")]
    let builder = builder.invoke_handler(tamagrid_handlers![
        codex::soak::run_protocol_soak,
        codex::soak::complete_protocol_soak,
    ]);
    #[cfg(not(feature = "packaged-soak-test"))]
    let builder = builder.invoke_handler(tamagrid_handlers![]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building TamaGrid");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            let state = app_handle.state::<AppServerManager>();
            // A connection handshake may still own the lifecycle lock when the
            // user closes immediately after launch. Bound that wait so the
            // window-state plugin can reach RunEvent::Exit and persist state.
            // Process jobs/groups remain the final child-process cleanup guard.
            let _ = tauri::async_runtime::block_on(async {
                tokio::time::timeout(
                    EXIT_DISCONNECT_TIMEOUT,
                    codex::manager::disconnect_app_server(state),
                )
                .await
            });
        }
    });
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn window_state_flags() -> tauri_plugin_window_state::StateFlags {
    use tauri_plugin_window_state::StateFlags;

    // VISIBLE lets the plugin reveal the initially hidden window only after it
    // has restored geometry, avoiding a flash at the default position. There
    // is intentionally no minimized flag, so TamaGrid always reopens usable.
    StateFlags::SIZE
        | StateFlags::POSITION
        | StateFlags::MAXIMIZED
        | StateFlags::FULLSCREEN
        | StateFlags::VISIBLE
}

#[cfg(all(test, not(any(target_os = "android", target_os = "ios"))))]
mod tests {
    use super::window_state_flags;
    use tauri_plugin_window_state::StateFlags;

    #[test]
    fn window_state_persists_geometry_without_changing_decorations() {
        let flags = window_state_flags();
        assert!(flags.contains(StateFlags::SIZE));
        assert!(flags.contains(StateFlags::POSITION));
        assert!(flags.contains(StateFlags::MAXIMIZED));
        assert!(flags.contains(StateFlags::FULLSCREEN));
        assert!(flags.contains(StateFlags::VISIBLE));
        assert!(!flags.contains(StateFlags::DECORATIONS));
    }
}
