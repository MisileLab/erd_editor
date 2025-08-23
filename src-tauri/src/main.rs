#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod erd;
mod commands;

use commands::{save_diagram_to_file, save_diagram_to_path, load_diagram_from_file, export_markdown, export_mermaid};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_diagram_to_file,
            save_diagram_to_path,
            load_diagram_from_file,
            export_markdown,
            export_mermaid
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}