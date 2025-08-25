use tauri::command;
use crate::erd::ErdDiagram;
use serde::{Serialize, Deserialize};
use std::fs;
use tauri_plugin_dialog::DialogExt;
use std::sync::{Arc, Mutex};
use std::sync::mpsc;

#[derive(Serialize, Deserialize)]
pub struct LoadResult {
    pub diagram: ErdDiagram,
    pub file_path: String,
}

#[command]
pub async fn save_diagram_to_path(diagram: ErdDiagram, file_path: String) -> Result<String, String> {
    println!("save_diagram_to_path 명령어 호출됨: {}", file_path);
    
    let json_data = serde_json::to_string_pretty(&diagram)
        .map_err(|e| format!("Failed to serialize diagram: {}", e))?;
    
    fs::write(&file_path, json_data)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(file_path)
}

#[command]
pub async fn save_diagram_to_file(app: tauri::AppHandle, diagram: ErdDiagram) -> Result<String, String> {
    println!("save_diagram_to_file 명령어 호출됨");
    
    let (tx, rx) = mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    app.dialog()
        .file()
        .set_title("ERD 다이어그램 저장")
        .add_filter("JSON Files", &["json"])
        .set_file_name("erd_diagram.json")
        .save_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(file_path);
                }
            }
        });
    
    let file_path = rx.recv().map_err(|_| "Dialog was cancelled".to_string())?;
    
    match file_path {
        Some(path) => {
            println!("저장 경로 선택됨: {:?}", path);
            let path_buf = path.as_path().unwrap();
            let json_data = serde_json::to_string_pretty(&diagram)
                .map_err(|e| format!("Failed to serialize diagram: {}", e))?;
            
            fs::write(path_buf, json_data)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            
            Ok(path_buf.to_string_lossy().to_string())
        }
        None => {
            println!("저장 취소됨");
            Err("Save cancelled".to_string())
        }
    }
}

const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB

#[command]
pub async fn load_diagram_from_file(app: tauri::AppHandle) -> Result<LoadResult, String> {
    println!("load_diagram_from_file 명령어 호출됨");
    
    let (tx, rx) = mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    // 파일 다이얼로그 열기
    println!("파일 다이얼로그 생성 중...");
    app.dialog()
        .file()
        .set_title("ERD 다이어그램 열기")
        .add_filter("JSON Files", &["json"])
        .pick_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(file_path);
                }
            }
        });
    
    let file_path = rx.recv().map_err(|_| "Dialog was cancelled".to_string())?;
    
    println!("파일 다이얼로그 결과: {:?}", file_path);
    
    match file_path {
        Some(path) => {
            println!("파일 경로 선택됨: {:?}", path);
            let path_buf = path.as_path().unwrap();
            
            // 파일 크기 검사
            let metadata = fs::metadata(path_buf)
                .map_err(|e| format!("파일 정보를 읽을 수 없습니다: {}", e))?;
            
            if metadata.len() > MAX_FILE_SIZE {
                return Err(format!("파일이 너무 큽니다. 최대 {}MB까지 지원합니다.", MAX_FILE_SIZE / (1024 * 1024)));
            }
            
            // 파일 타입 검증
            if let Some(extension) = path_buf.extension() {
                if extension.to_string_lossy().to_lowercase() != "json" {
                    return Err("JSON 파일만 지원합니다.".to_string());
                }
            } else {
                return Err("파일 확장자가 필요합니다. JSON 파일을 선택해주세요.".to_string());
            }
            
            // 파일 읽기
            let file_content = fs::read_to_string(path_buf)
                .map_err(|e| format!("파일을 읽을 수 없습니다 '{}': {}", path_buf.display(), e))?;
            
            // 기본 검증
            if file_content.trim().is_empty() {
                return Err("파일이 비어있습니다.".to_string());
            }
            
            // JSON 파싱
            let mut diagram: ErdDiagram = serde_json::from_str(&file_content)
                .map_err(|e| {
                    if e.to_string().contains("recursion limit") {
                        "JSON 구조가 너무 복잡합니다.".to_string()
                    } else {
                        format!("다이어그램 파일을 파싱할 수 없습니다: {}", e)
                    }
                })?;
            
            // 스키마 변화에 대한 후처리 (기본값/필수 필드 보정)
            diagram.normalize();
            
            // 기본 다이어그램 검증
            validate_basic_diagram(&diagram)?;
            
            println!("다이어그램 로드 성공");
            Ok(LoadResult {
                diagram,
                file_path: path_buf.to_string_lossy().to_string(),
            })
        }
        None => {
            println!("파일 선택 취소됨");
            Err("파일 선택이 취소되었습니다.".to_string())
        }
    }
}

fn validate_basic_diagram(diagram: &ErdDiagram) -> Result<(), String> {
    // 기본적인 검증만 수행 (빠른 처리를 위해)
    if diagram.entities.len() > 1000 {
        return Err("엔티티가 너무 많습니다.".to_string());
    }
    
    if diagram.relations.len() > 5000 {
        return Err("관계가 너무 많습니다.".to_string());
    }
    
    Ok(())
}

#[command]
pub async fn export_markdown(app: tauri::AppHandle, diagram: ErdDiagram) -> Result<String, String> {
    println!("export_markdown 명령어 호출됨");
    
    let (tx, rx) = mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    app.dialog()
        .file()
        .set_title("Markdown 파일로 내보내기")
        .add_filter("Markdown Files", &["md"])
        .set_file_name("erd_diagram.md")
        .save_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(file_path);
                }
            }
        });
    
    let file_path = rx.recv().map_err(|_| "Dialog was cancelled".to_string())?;
    
    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            let markdown_content = diagram.to_markdown();
            
            fs::write(path_buf, markdown_content)
                .map_err(|e| format!("Failed to write markdown file: {}", e))?;
            
            Ok(path_buf.to_string_lossy().to_string())
        }
        None => Err("Export cancelled".to_string())
    }
}

#[command]
pub async fn export_mermaid(app: tauri::AppHandle, diagram: ErdDiagram) -> Result<String, String> {
    println!("export_mermaid 명령어 호출됨");
    
    let (tx, rx) = mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    app.dialog()
        .file()
        .set_title("Mermaid 파일로 내보내기")
        .add_filter("Markdown Files", &["md"])
        .set_file_name("erd_diagram_mermaid.md")
        .save_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(file_path);
                }
            }
        });
    
    let file_path = rx.recv().map_err(|_| "Dialog was cancelled".to_string())?;
    
    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            let mermaid_content = diagram.to_mermaid();
            
            fs::write(path_buf, mermaid_content)
                .map_err(|e| format!("Failed to write mermaid file: {}", e))?;
            
            Ok(path_buf.to_string_lossy().to_string())
        }
        None => Err("Export cancelled".to_string())
    }
}

#[command]
pub async fn export_xlsx(app: tauri::AppHandle, xlsx_data: Vec<u8>) -> Result<String, String> {
    println!("export_xlsx 명령어 호출됨");
    
    let (tx, rx) = mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    app.dialog()
        .file()
        .set_title("XLSX 파일로 내보내기")
        .add_filter("Excel Files", &["xlsx"])
        .set_file_name("erd_diagram.xlsx")
        .save_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(file_path);
                }
            }
        });
    
    let file_path = rx.recv().map_err(|_| "Dialog was cancelled".to_string())?;
    
    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            
            fs::write(path_buf, xlsx_data)
                .map_err(|e| format!("Failed to write XLSX file: {}", e))?;
            
            Ok(path_buf.to_string_lossy().to_string())
        }
        None => Err("Export cancelled".to_string())
    }
}

#[command]
pub async fn import_xlsx(app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    println!("import_xlsx 명령어 호출됨");
    
    let (tx, rx) = mpsc::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    app.dialog()
        .file()
        .set_title("XLSX 파일 가져오기")
        .add_filter("Excel Files", &["xlsx"])
        .pick_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(file_path);
                }
            }
        });
    
    let file_path = rx.recv().map_err(|_| "Dialog was cancelled".to_string())?;
    
    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            
            // 파일 크기 검사
            let metadata = fs::metadata(path_buf)
                .map_err(|e| format!("파일 정보를 읽을 수 없습니다: {}", e))?;
            
            if metadata.len() > MAX_FILE_SIZE {
                return Err(format!("파일이 너무 큽니다. 최대 {}MB까지 지원합니다.", MAX_FILE_SIZE / (1024 * 1024)));
            }
            
            // 파일 타입 검증
            if let Some(extension) = path_buf.extension() {
                if extension.to_string_lossy().to_lowercase() != "xlsx" {
                    return Err("XLSX 파일만 지원합니다.".to_string());
                }
            } else {
                return Err("파일 확장자가 필요합니다. XLSX 파일을 선택해주세요.".to_string());
            }
            
            // 파일 읽기
            let file_content = fs::read(path_buf)
                .map_err(|e| format!("파일을 읽을 수 없습니다 '{}': {}", path_buf.display(), e))?;
            
            // 기본 검증
            if file_content.is_empty() {
                return Err("파일이 비어있습니다.".to_string());
            }
            
            Ok(file_content)
        }
        None => Err("파일 선택이 취소되었습니다.".to_string())
    }
}