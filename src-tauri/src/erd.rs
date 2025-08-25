use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attribute {
    #[serde(alias = "name")]
    pub logical_name: String,  // 논리적 속성명 (한글 등) - 필수
    #[serde(default)]
    pub physical_name: String, // 물리적 속성명 (영문, DB 컬럼명) - 필수(없으면 후처리)
    pub data_type: String,
    pub length: Option<String>,
    pub default_value: Option<String>, // 기본값 (Mermaid 미지원)
    #[serde(default)]
    pub is_primary_key: bool,
    #[serde(default = "default_true")]
    pub is_nullable: bool,
    #[serde(default)]
    pub is_foreign_key: bool,
    #[serde(default)]
    pub is_unique: bool,
    #[serde(default)]
    pub is_auto_increment: bool, // 자동 증가 (Mermaid 미지원)
    pub foreign_key_reference: Option<String>,
    #[serde(default)]
    pub remark: Option<String>, // 비고/설명
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    #[serde(alias = "name")]
    pub logical_name: String, // 논리적 엔티티명 (한글 등) - 필수
    #[serde(default)]
    pub physical_name: String, // 물리적 엔티티명 (영문, DB 테이블명) - 필수(없으면 후처리)
    #[serde(default = "default_pos_x")]
    pub x: f64,
    #[serde(default = "default_pos_y")]
    pub y: f64,
    #[serde(default = "default_width")]
    pub width: f64,
    #[serde(default = "default_height")]
    pub height: f64,
    #[serde(default)]
    pub attributes: Vec<Attribute>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Cardinality {
    OneToOne,
    OneToMany,
    ManyToMany,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relation {
    pub id: String,
    pub from_entity_id: String,
    pub from_attribute: String,
    pub to_entity_id: String,
    pub to_attribute: Option<String>, // FK 속성 이름 (자동 생성될 수 있음)
    pub cardinality: Cardinality,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErdDiagram {
    #[serde(default)]
    pub entities: HashMap<String, Entity>,
    #[serde(default)]
    pub relations: Vec<Relation>,
    #[serde(default = "default_canvas_width")]
    pub canvas_width: f64,
    #[serde(default = "default_canvas_height")]
    pub canvas_height: f64,
}

impl ErdDiagram {
    // 저장 포맷 변경에 따른 후처리/마이그레이션
    pub fn normalize(&mut self) {
        for (_id, entity) in self.entities.iter_mut() {
            if entity.physical_name.trim().is_empty() {
                entity.physical_name = sanitize_physical(&entity.logical_name);
            }
            if entity.width <= 0.0 { entity.width = default_width(); }
            if entity.height <= 0.0 { entity.height = default_height(); }
            if entity.x.is_nan() { entity.x = default_pos_x(); }
            if entity.y.is_nan() { entity.y = default_pos_y(); }

            for attr in entity.attributes.iter_mut() {
                if attr.physical_name.trim().is_empty() {
                    attr.physical_name = sanitize_physical(&attr.logical_name);
                }
            }
        }
        if self.canvas_width <= 0.0 { self.canvas_width = default_canvas_width(); }
        if self.canvas_height <= 0.0 { self.canvas_height = default_canvas_height(); }
    }

    pub fn to_markdown(&self) -> String {
        let mut markdown = String::new();
        
        markdown.push_str("# ERD Diagram\n\n");
        
        if !self.entities.is_empty() {
            markdown.push_str("## Entities\n\n");
            
            for entity in self.entities.values() {
                markdown.push_str(&format!("### {} ({})\n", entity.logical_name, entity.physical_name));
                markdown.push_str(&format!("**논리명**: {} | **물리명**: {}\n\n", entity.logical_name, entity.physical_name));
                
                if !entity.attributes.is_empty() {
                    markdown.push_str("| Attribute | Logical Name | Physical Name | Type | Default | Constraints |\n");
                    markdown.push_str("|-----------|--------------|---------------|------|---------|-------------|\n");
                    
                    for attr in &entity.attributes {
                        let mut constraints = Vec::new();
                        if attr.is_primary_key {
                            constraints.push("PK");
                        }
                        if attr.is_foreign_key {
                            constraints.push("FK");
                        }
                        if attr.is_unique {
                            constraints.push("UNIQUE");
                        }
                        if attr.is_auto_increment {
                            constraints.push("AUTO_INCREMENT");
                        }
                        if !attr.is_nullable {
                            constraints.push("NOT NULL");
                        }
                        
                        let constraints_str = if constraints.is_empty() {
                            "".to_string()
                        } else {
                            constraints.join(", ")
                        };
                        
                        let type_display = if let Some(ref length) = attr.length {
                            format!("{}({})", attr.data_type, length)
                        } else {
                            attr.data_type.clone()
                        };
                        
                        let default_display = attr.default_value.as_deref().unwrap_or("-");
                        
                        markdown.push_str(&format!(
                            "| {} | {} | {} | {} | {} | {} |\n",
                            attr.logical_name, attr.logical_name, attr.physical_name, type_display, default_display, constraints_str
                        ));
                    }
                    markdown.push('\n');
                }
            }
        }
        
        if !self.relations.is_empty() {
            markdown.push_str("## Relations\n\n");
            
            for relation in &self.relations {
                let from_entity = self.entities.get(&relation.from_entity_id);
                let to_entity = self.entities.get(&relation.to_entity_id);
                
                if let (Some(from), Some(to)) = (from_entity, to_entity) {
                    let cardinality_str = match relation.cardinality {
                        Cardinality::OneToOne => "1:1",
                        Cardinality::OneToMany => "1:N",
                        Cardinality::ManyToMany => "N:M",
                    };
                    
                    markdown.push_str(&format!(
                        "- {} ({}) → {} ({})\n",
                        from.logical_name, cardinality_str, to.logical_name, relation.name
                    ));
                }
            }
        }
        
        markdown
    }
    
    fn sanitize_name(name: &str) -> String {
        // 한글과 영문, 숫자를 모두 허용하되 공백과 특수문자만 언더스코어로 변환
        let result = name.chars()
            .map(|c| match c {
                'a'..='z' | 'A'..='Z' | '0'..='9' | 'ㄱ'..='ㅎ' | 'ㅏ'..='ㅣ' | '가'..='힣' => c,
                _ => '_'
            })
            .collect::<String>();
        
        // 연속된 언더스코어 정리
        let result = result.split('_')
            .filter(|s| !s.is_empty())
            .collect::<Vec<&str>>()
            .join("_");
        
        // 빈 문자열이면 기본값
        if result.is_empty() {
            "entity".to_string()
        } else {
            result
        }
    }
    
    pub fn to_mermaid(&self) -> String {
        let mut mermaid = String::new();
        
        mermaid.push_str("```mermaid\nerDiagram\n");
        
        // 엔티티 정의 먼저 - 결정적 순서(논리명 기준)
        let mut entities_sorted: Vec<&Entity> = self.entities.values().collect();
        entities_sorted.sort_by(|a, b| a.logical_name.to_lowercase().cmp(&b.logical_name.to_lowercase()));

        for entity in entities_sorted {
            let entity_name = Self::sanitize_name(&entity.logical_name);
            mermaid.push_str(&format!("    {} {{\n", entity_name));
            
            // 속성도 결정적 순서: PK -> FK -> 기타, 그 다음 논리명
            let mut attrs_sorted = entity.attributes.clone();
            attrs_sorted.sort_by(|a, b| {
                let rank_a = if a.is_primary_key { 0 } else if a.is_foreign_key { 1 } else { 2 };
                let rank_b = if b.is_primary_key { 0 } else if b.is_foreign_key { 1 } else { 2 };
                rank_a.cmp(&rank_b).then_with(|| a.logical_name.to_lowercase().cmp(&b.logical_name.to_lowercase()))
            });

            for attr in &attrs_sorted {
                // Mermaid에서는 물리명 사용
                let display_name = Self::sanitize_name(&attr.physical_name);
                
                let mut type_display = if let Some(ref length) = attr.length {
                    format!("{}({})", attr.data_type, length)
                } else {
                    attr.data_type.clone()
                };
                
                // Mermaid는 DEFAULT와 AUTO_INCREMENT를 지원하지 않음
                // PK/FK/UNIQUE만 표시 (Mermaid 구문: attribute_name type PK/FK/UK)
                if attr.is_primary_key {
                    type_display.push_str(" PK");
                }
                if attr.is_foreign_key {
                    type_display.push_str(" FK");
                }
                if attr.is_unique && !attr.is_primary_key {
                    type_display.push_str(" UK");
                }
                
                // 올바른 Mermaid 구문: attribute_name type
                mermaid.push_str(&format!("        {} {}\n", display_name, type_display));
            }
            
            mermaid.push_str("    }\n");
        }
        
        // 관계 정의 - 결정적 순서(엔티티명, 관계명)
        let mut relations_sorted = self.relations.clone();
        relations_sorted.sort_by(|a, b| {
            let a_from = self.entities.get(&a.from_entity_id).map(|e| e.logical_name.to_lowercase()).unwrap_or_default();
            let b_from = self.entities.get(&b.from_entity_id).map(|e| e.logical_name.to_lowercase()).unwrap_or_default();
            a_from.cmp(&b_from)
                .then_with(|| {
                    let a_to = self.entities.get(&a.to_entity_id).map(|e| e.logical_name.to_lowercase()).unwrap_or_default();
                    let b_to = self.entities.get(&b.to_entity_id).map(|e| e.logical_name.to_lowercase()).unwrap_or_default();
                    a_to.cmp(&b_to)
                })
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        for relation in &relations_sorted {
            let from_entity = self.entities.get(&relation.from_entity_id);
            let to_entity = self.entities.get(&relation.to_entity_id);
            
            if let (Some(from), Some(to)) = (from_entity, to_entity) {
                let from_name = Self::sanitize_name(&from.logical_name);
                let to_name = Self::sanitize_name(&to.logical_name);
                let relation_name = Self::sanitize_name(&relation.name);
                
                let symbol = match relation.cardinality {
                    Cardinality::OneToOne => "||--||",
                    Cardinality::OneToMany => "||--o{",
                    Cardinality::ManyToMany => "}o--o{",
                };
                
                mermaid.push_str(&format!(
                    "    {} {} {} : {}\n",
                    from_name, 
                    symbol, 
                    to_name, 
                    relation_name
                ));
            }
        }
        
        mermaid.push_str("```\n");
        mermaid
    }
}

fn sanitize_physical(name: &str) -> String {
    // 물리명 기본 생성: 소문자, 공백/특수문자 -> '_'
    let mut s = name.to_lowercase();
    s = s.chars()
        .map(|c| match c {
            'a'..='z' | '0'..='9' => c,
            _ => '_',
        })
        .collect();
    // 연속 '_' 정리
    s.split('_').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("_")
}

fn default_true() -> bool { true }
fn default_width() -> f64 { 150.0 }
fn default_height() -> f64 { 100.0 }
fn default_pos_x() -> f64 { 50.0 }
fn default_pos_y() -> f64 { 50.0 }
fn default_canvas_width() -> f64 { 1200.0 }
fn default_canvas_height() -> f64 { 800.0 }