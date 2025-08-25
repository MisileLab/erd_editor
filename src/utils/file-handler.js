import { invoke } from '@tauri-apps/api/core';
import * as XLSX from 'xlsx';

// 상수 정의
const INVOKE_TIMEOUT = 30000; // 30초
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 1000; // 1초

export default class FileHandler {
    constructor() {
        this.currentFilePath = null;
        this.isModified = false;
        this.loadingState = {
            isLoading: false,
            operation: '',
            progress: 0
        };
        this.eventListeners = new Map();
    }
    
    async saveDiagram(diagram, filePath = null) {
        this.setLoadingState(true, '파일 저장 중...');
        
        try {
            // 저장 전 다이어그램 검증
            this.validateDiagram(diagram);
            
            let savedPath;
            
            if (filePath) {
                // 특정 경로에 저장
                savedPath = await this.writeFile(filePath, JSON.stringify(diagram, null, 2));
            } else {
                // 다이얼로그로 저장 위치 선택
                savedPath = await this.invokeWithTimeout('save_diagram_to_file', { diagram }, INVOKE_TIMEOUT);
            }
            
            this.currentFilePath = savedPath;
            this.isModified = false;
            
            this.setLoadingState(false);
            this.emit('diagramSaved', { diagram, filePath: savedPath });
            
            return savedPath;
        } catch (error) {
            this.setLoadingState(false);
            const errorMessage = this.getErrorMessage(error);
            this.emit('saveError', { error: errorMessage });
            throw new Error(`저장 실패: ${errorMessage}`);
        }
    }
    
    async loadDiagram(filePath = null) {
        this.setLoadingState(true, '파일 로딩 중...');
        
        try {
            let diagram;
            
            if (filePath) {
                // 특정 경로에서 로드
                const fileContent = await this.readFile(filePath);
                diagram = JSON.parse(fileContent);
            } else {
                // 다이얼로그로 파일 선택 (재시도 지원)
                diagram = await this.invokeWithTimeout('load_diagram_from_file', {}, INVOKE_TIMEOUT);
            }
            
            // 로드된 다이어그램 검증
            this.validateDiagram(diagram);
            
            this.currentFilePath = filePath;
            this.isModified = false;
            
            this.setLoadingState(false);
            this.emit('diagramLoaded', { diagram, filePath });
            
            return diagram;
        } catch (error) {
            this.setLoadingState(false);
            const errorMessage = this.getErrorMessage(error);
            this.emit('loadError', { error: errorMessage });
            throw new Error(`로드 실패: ${errorMessage}`);
        }
    }
    
    async exportMarkdown(diagram) {
        this.setLoadingState(true, 'Markdown 내보내기 중...');
        
        try {
            this.validateDiagram(diagram);
            const filePath = await this.invokeWithTimeout('export_markdown', { diagram }, INVOKE_TIMEOUT);
            
            this.setLoadingState(false);
            this.emit('exportCompleted', { format: 'markdown', filePath });
            
            return filePath;
        } catch (error) {
            this.setLoadingState(false);
            const errorMessage = this.getErrorMessage(error);
            this.emit('exportError', { format: 'markdown', error: errorMessage });
            throw new Error(`Markdown 내보내기 실패: ${errorMessage}`);
        }
    }
    
    async exportMermaid(diagram) {
        this.setLoadingState(true, 'Mermaid 내보내기 중...');
        
        try {
            this.validateDiagram(diagram);
            const filePath = await this.invokeWithTimeout('export_mermaid', { diagram }, INVOKE_TIMEOUT);
            
            this.setLoadingState(false);
            this.emit('exportCompleted', { format: 'mermaid', filePath });
            
            return filePath;
        } catch (error) {
            this.setLoadingState(false);
            const errorMessage = this.getErrorMessage(error);
            this.emit('exportError', { format: 'mermaid', error: errorMessage });
            throw new Error(`Mermaid 내보내기 실패: ${errorMessage}`);
        }
    }
    
    async exportXlsx(diagram) {
        this.setLoadingState(true, 'XLSX 내보내기 중...');
        
        try {
            this.validateDiagram(diagram);
            
            // XLSX 형식으로 변환
            const xlsxData = this.diagramToXlsx(diagram);
            
            // Tauri를 통해 파일 저장
            const filePath = await this.invokeWithTimeout('export_xlsx', { 
                xlsxData: Array.from(xlsxData) 
            }, INVOKE_TIMEOUT);
            
            this.setLoadingState(false);
            this.emit('exportCompleted', { format: 'xlsx', filePath });
            
            return filePath;
        } catch (error) {
            this.setLoadingState(false);
            const errorMessage = this.getErrorMessage(error);
            this.emit('exportError', { format: 'xlsx', error: errorMessage });
            throw new Error(`XLSX 내보내기 실패: ${errorMessage}`);
        }
    }
    
    async importXlsx() {
        this.setLoadingState(true, 'XLSX 가져오기 중...');
        
        try {
            // Tauri를 통해 파일 선택 및 읽기
            const xlsxData = await this.invokeWithTimeout('import_xlsx', {}, INVOKE_TIMEOUT);
            
            // XLSX 데이터를 다이어그램으로 변환
            const diagram = this.xlsxToDiagram(new Uint8Array(xlsxData));
            
            this.setLoadingState(false);
            this.emit('importCompleted', { format: 'xlsx', diagram });
            
            return diagram;
        } catch (error) {
            this.setLoadingState(false);
            const errorMessage = this.getErrorMessage(error);
            this.emit('importError', { format: 'xlsx', error: errorMessage });
            throw new Error(`XLSX 가져오기 실패: ${errorMessage}`);
        }
    }
    
    // 로컬 변환 함수들 (Tauri 명령어 없이도 사용 가능)
    diagramToMarkdown(diagram) {
        let markdown = '# ERD Diagram\n\n';
        
        if (Object.keys(diagram.entities).length > 0) {
            markdown += '## Entities\n\n';
            
            Object.values(diagram.entities).forEach(entity => {
                markdown += `### ${entity.name}\n\n`;
                
                if (entity.attributes.length > 0) {
                    markdown += '| Attribute | Type | Constraints |\n';
                    markdown += '|-----------|------|-------------|\n';
                    
                    entity.attributes.forEach(attr => {
                        const constraints = [];
                        if (attr.is_primary_key) constraints.push('PK');
                        if (attr.is_foreign_key) constraints.push('FK');
                        if (!attr.is_nullable) constraints.push('NOT NULL');
                        
                        const constraintsStr = constraints.length > 0 ? constraints.join(', ') : '';
                        
                        markdown += `| ${attr.name} | ${attr.data_type} | ${constraintsStr} |\n`;
                    });
                    markdown += '\n';
                }
            });
        }
        
        if (diagram.relations.length > 0) {
            markdown += '## Relations\n\n';
            
            diagram.relations.forEach(relation => {
                const fromEntity = diagram.entities[relation.from_entity_id];
                const toEntity = diagram.entities[relation.to_entity_id];
                
                if (fromEntity && toEntity) {
                    let cardinalityStr;
                    switch (relation.cardinality) {
                        case 'OneToOne':
                            cardinalityStr = '1:1';
                            break;
                        case 'OneToMany':
                            cardinalityStr = '1:N';
                            break;
                        case 'ManyToMany':
                            cardinalityStr = 'N:M';
                            break;
                        default:
                            cardinalityStr = relation.cardinality;
                    }
                    
                    markdown += `- ${fromEntity.name} (${cardinalityStr}) → ${toEntity.name} : ${relation.name}\n`;
                }
            });
        }
        
        return markdown;
    }
    
    diagramToMermaid(diagram) {
        let mermaid = '```mermaid\nerDiagram\n';
        
        // 엔티티 정의 먼저 (순서 중요)
        Object.values(diagram.entities).forEach(entity => {
            const cleanName = this.cleanEntityName(entity.name);
            mermaid += `    ${cleanName} {\n`;
            
            entity.attributes.forEach(attr => {
                const cleanAttrName = this.cleanEntityName(attr.name);
                let typeInfo = attr.data_type;
                
                if (attr.length) {
                    typeInfo += `(${attr.length})`;
                }
                
                if (attr.is_primary_key) {
                    typeInfo += ' PK';
                }
                if (attr.is_foreign_key) {
                    typeInfo += ' FK';
                }
                
                // 올바른 Mermaid 구문: attribute_name type
                mermaid += `        ${cleanAttrName} ${typeInfo}\n`;
            });
            
            mermaid += '    }\n';
        });
        
        // 관계 정의
        diagram.relations.forEach(relation => {
            const fromEntity = diagram.entities[relation.from_entity_id];
            const toEntity = diagram.entities[relation.to_entity_id];
            
            if (fromEntity && toEntity) {
                let symbol;
                switch (relation.cardinality) {
                    case 'OneToOne':
                        symbol = '||--||';
                        break;
                    case 'OneToMany':
                        symbol = '||--o{';
                        break;
                    case 'ManyToMany':
                        symbol = '}o--o{';
                        break;
                    default:
                        symbol = '||--||';
                }
                
                const cleanFromName = this.cleanEntityName(fromEntity.name);
                const cleanToName = this.cleanEntityName(toEntity.name);
                const cleanRelationName = this.cleanEntityName(relation.name);
                
                mermaid += `    ${cleanFromName} ${symbol} ${cleanToName} : ${cleanRelationName}\n`;
            }
        });
        
        mermaid += '```\n';
        return mermaid;
    }
    
    // Mermaid에서 사용할 수 있도록 엔티티 이름 정리
    cleanEntityName(name) {
        // 한글, 영문, 숫자를 허용하고 공백과 특수문자만 언더스코어로 변환
        let result = name.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/g, '_');
        
        // 연속 언더스코어 정리
        result = result.split('_').filter(s => s.length > 0).join('_');
        
        // 빈 문자열이면 기본값
        return result || 'entity';
    }
    
    // JSON으로 다이어그램 내보내기
    diagramToJSON(diagram) {
        return JSON.stringify(diagram, null, 2);
    }
    
    // JSON에서 다이어그램 가져오기
    diagramFromJSON(jsonString) {
        try {
            const diagram = JSON.parse(jsonString);
            
            // 데이터 유효성 검사
            this.validateDiagram(diagram);
            
            // 기본값 설정
            diagram.canvas_width = diagram.canvas_width || 1200;
            diagram.canvas_height = diagram.canvas_height || 800;
            
            return diagram;
        } catch (error) {
            throw new Error(`JSON 파싱 실패: ${error.message}`);
        }
    }
    
    // XLSX로 다이어그램 내보내기
    diagramToXlsx(diagram) {
        // 새 워크북 생성
        const workbook = XLSX.utils.book_new();
        
        // 엔티티 시트 생성
        const entitiesData = [];
        entitiesData.push(['Entity ID', 'Logical Name', 'Physical Name', 'X Position', 'Y Position', 'Width', 'Height']);
        
        Object.values(diagram.entities).forEach(entity => {
            entitiesData.push([
                entity.id,
                entity.logical_name || '',
                entity.physical_name || entity.name || '',
                entity.x || 0,
                entity.y || 0,
                entity.width || 150,
                entity.height || 100
            ]);
        });
        
        const entitiesSheet = XLSX.utils.aoa_to_sheet(entitiesData);
        XLSX.utils.book_append_sheet(workbook, entitiesSheet, 'Entities');
        
        // 속성 시트 생성
        const attributesData = [];
        attributesData.push([
            'Entity ID', 'Logical Name', 'Physical Name', 'Data Type', 'Length', 'Default Value',
            'Is Primary Key', 'Is Foreign Key', 'Is Nullable', 'Is Unique', 'Is Auto Increment', 'Remark'
        ]);
        
        Object.values(diagram.entities).forEach(entity => {
            entity.attributes.forEach(attr => {
                attributesData.push([
                    entity.id,
                    attr.logical_name || '',
                    attr.physical_name || attr.name || '',
                    attr.data_type || '',
                    attr.length || '',
                    attr.default_value || '',
                    attr.is_primary_key ? 'YES' : 'NO',
                    attr.is_foreign_key ? 'YES' : 'NO',
                    attr.is_nullable ? 'YES' : 'NO',
                    attr.is_unique ? 'YES' : 'NO',
                    attr.is_auto_increment ? 'YES' : 'NO',
                    attr.remark || ''
                ]);
            });
        });
        
        const attributesSheet = XLSX.utils.aoa_to_sheet(attributesData);
        XLSX.utils.book_append_sheet(workbook, attributesSheet, 'Attributes');
        
        // 관계 시트 생성
        const relationsData = [];
        relationsData.push(['Relation ID', 'Name', 'From Entity ID', 'To Entity ID', 'Cardinality', 'From Attribute', 'To Attribute']);
        
        diagram.relations.forEach(relation => {
            relationsData.push([
                relation.id || '',
                relation.name || '',
                relation.from_entity_id || '',
                relation.to_entity_id || '',
                relation.cardinality || '',
                relation.from_attribute || '',
                relation.to_attribute || ''
            ]);
        });
        
        const relationsSheet = XLSX.utils.aoa_to_sheet(relationsData);
        XLSX.utils.book_append_sheet(workbook, relationsSheet, 'Relations');
        
        // 바이너리 데이터로 변환
        const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Uint8Array(xlsxBuffer);
    }
    
    // XLSX에서 다이어그램 가져오기
    xlsxToDiagram(xlsxData) {
        try {
            // XLSX 파일 읽기
            const workbook = XLSX.read(xlsxData, { type: 'array' });
            
            const diagram = {
                entities: {},
                relations: [],
                canvas_width: 1200,
                canvas_height: 800
            };
            
            // 엔티티 시트 읽기
            if (workbook.SheetNames.includes('Entities')) {
                const entitiesSheet = workbook.Sheets['Entities'];
                const entitiesData = XLSX.utils.sheet_to_json(entitiesSheet, { header: 1 });
                
                // 헤더 행 제외하고 엔티티 데이터 처리
                for (let i = 1; i < entitiesData.length; i++) {
                    const row = entitiesData[i];
                    if (row[0]) { // Entity ID가 있는 경우만
                        diagram.entities[row[0]] = {
                            id: row[0],
                            logical_name: row[1] || '',
                            physical_name: row[2] || '',
                            name: row[2] || row[1] || '', // backward compatibility
                            x: parseFloat(row[3]) || 100,
                            y: parseFloat(row[4]) || 100,
                            width: parseFloat(row[5]) || 150,
                            height: parseFloat(row[6]) || 100,
                            attributes: []
                        };
                    }
                }
            }
            
            // 속성 시트 읽기
            if (workbook.SheetNames.includes('Attributes')) {
                const attributesSheet = workbook.Sheets['Attributes'];
                const attributesData = XLSX.utils.sheet_to_json(attributesSheet, { header: 1 });
                
                // 헤더 행 제외하고 속성 데이터 처리
                for (let i = 1; i < attributesData.length; i++) {
                    const row = attributesData[i];
                    const entityId = row[0];
                    
                    if (entityId && diagram.entities[entityId] && row[1]) { // Entity ID와 속성명이 있는 경우
                        const attribute = {
                            logical_name: row[1] || '',
                            physical_name: row[2] || '',
                            name: row[2] || row[1] || '', // backward compatibility
                            data_type: row[3] || 'VARCHAR',
                            length: row[4] || null,
                            default_value: row[5] || null,
                            is_primary_key: (row[6] || '').toUpperCase() === 'YES',
                            is_foreign_key: (row[7] || '').toUpperCase() === 'YES',
                            is_nullable: (row[8] || '').toUpperCase() !== 'NO',
                            is_unique: (row[9] || '').toUpperCase() === 'YES',
                            is_auto_increment: (row[10] || '').toUpperCase() === 'YES',
                            remark: row[11] || null,
                            foreign_key_reference: null
                        };
                        
                        diagram.entities[entityId].attributes.push(attribute);
                    }
                }
            }
            
            // 관계 시트 읽기
            if (workbook.SheetNames.includes('Relations')) {
                const relationsSheet = workbook.Sheets['Relations'];
                const relationsData = XLSX.utils.sheet_to_json(relationsSheet, { header: 1 });
                
                // 헤더 행 제외하고 관계 데이터 처리
                for (let i = 1; i < relationsData.length; i++) {
                    const row = relationsData[i];
                    
                    if (row[2] && row[3]) { // From과 To Entity ID가 있는 경우
                        const relation = {
                            id: row[0] || `relation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            name: row[1] || '',
                            from_entity_id: row[2],
                            to_entity_id: row[3],
                            cardinality: row[4] || 'OneToMany',
                            from_attribute: row[5] || '',
                            to_attribute: row[6] || ''
                        };
                        
                        diagram.relations.push(relation);
                    }
                }
            }
            
            // 다이어그램 검증
            this.validateDiagram(diagram);
            
            return diagram;
        } catch (error) {
            throw new Error(`XLSX 파싱 실패: ${error.message}`);
        }
    }
    
    // 다이어그램 구조 검증
    validateDiagram(diagram) {
        if (!diagram || typeof diagram !== 'object') {
            throw new Error('올바르지 않은 다이어그램 형식입니다.');
        }
        
        if (!diagram.entities || typeof diagram.entities !== 'object') {
            throw new Error('엔티티 데이터가 올바르지 않습니다.');
        }
        
        if (!Array.isArray(diagram.relations)) {
            throw new Error('관계 데이터가 올바르지 않습니다.');
        }
        
        // 엔티티 수 제한
        const entityCount = Object.keys(diagram.entities).length;
        if (entityCount > 1000) {
            throw new Error('엔티티가 너무 많습니다. 최대 1000개까지 지원합니다.');
        }
        
        // 관계 수 제한
        if (diagram.relations.length > 5000) {
            throw new Error('관계가 너무 많습니다. 최대 5000개까지 지원합니다.');
        }
        
        // 각 엔티티 검증
        for (const [id, entity] of Object.entries(diagram.entities)) {
            if (!id || (!entity.logical_name && !entity.physical_name && !entity.name)) {
                throw new Error('엔티티 ID와 이름은 필수입니다.');
            }
            
            const entityDisplayName = entity.logical_name || entity.physical_name || entity.name || id;
            
            if (!Array.isArray(entity.attributes)) {
                throw new Error(`엔티티 '${entityDisplayName}'의 속성이 올바르지 않습니다.`);
            }
            
            if (entity.attributes.length > 100) {
                throw new Error(`엔티티 '${entityDisplayName}'의 속성이 너무 많습니다. 최대 100개까지 지원합니다.`);
            }
            
            // 좌표 및 크기 검증
            if (typeof entity.x !== 'number' || !isFinite(entity.x) ||
                typeof entity.y !== 'number' || !isFinite(entity.y) ||
                typeof entity.width !== 'number' || !isFinite(entity.width) ||
                typeof entity.height !== 'number' || !isFinite(entity.height)) {
                throw new Error(`엔티티 '${entityDisplayName}'의 위치나 크기 값이 올바르지 않습니다.`);
            }
        }
        
        // 관계 무결성 검증
        for (const relation of diagram.relations) {
            if (!relation.from_entity_id || !relation.to_entity_id) {
                throw new Error('관계에 엔티티 ID가 누락되었습니다.');
            }
            
            if (!diagram.entities[relation.from_entity_id]) {
                throw new Error(`관계 '${relation.name || relation.id}'의 시작 엔티티를 찾을 수 없습니다.`);
            }
            
            if (!diagram.entities[relation.to_entity_id]) {
                throw new Error(`관계 '${relation.name || relation.id}'의 끝 엔티티를 찾을 수 없습니다.`);
            }
        }
        
        return true;
    }
    
    // 타임아웃과 함께 invoke 호출
    async invokeWithTimeout(command, args = {}, timeoutMs = INVOKE_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`명령 '${command}' 실행 시간이 초과되었습니다. (${timeoutMs / 1000}초)`));
            }, timeoutMs);
            
            invoke(command, args)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }
    
    // 에러 메시지 정리
    getErrorMessage(error) {
        if (typeof error === 'string') {
            return error;
        }
        
        if (error && error.message) {
            return error.message;
        }
        
        return '알 수 없는 오류가 발생했습니다.';
    }
    
    // 로딩 상태 관리
    setLoadingState(isLoading, operation = '', progress = 0) {
        this.loadingState = {
            isLoading,
            operation,
            progress: Math.max(0, Math.min(100, progress))
        };
        
        this.emit('loadingStateChanged', this.loadingState);
    }
    
    getLoadingState() {
        return { ...this.loadingState };
    }
    
    // 이벤트 시스템
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
    
    // 자동 저장 기능
    enableAutoSave(diagram, intervalMs = 30000) {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(async () => {
            if (this.isModified && this.currentFilePath) {
                try {
                    await this.saveDiagram(diagram, this.currentFilePath);
                    console.log('자동 저장 완료');
                } catch (error) {
                    console.error('자동 저장 실패:', error);
                }
            }
        }, intervalMs);
    }
    
    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    // 변경 사항 추적
    markAsModified() {
        this.isModified = true;
    }
    
    markAsSaved() {
        this.isModified = false;
    }
    
    getModifiedStatus() {
        return this.isModified;
    }
    
    getCurrentFilePath() {
        return this.currentFilePath;
    }
    
    // 최근 파일 목록 관리 (로컬 스토리지 사용)
    addToRecentFiles(filePath) {
        const recentFiles = this.getRecentFiles();
        
        // 중복 제거
        const filtered = recentFiles.filter(path => path !== filePath);
        
        // 맨 앞에 추가하고 최대 10개까지만 유지
        filtered.unshift(filePath);
        const limited = filtered.slice(0, 10);
        
        localStorage.setItem('erd-editor-recent-files', JSON.stringify(limited));
    }
    
    getRecentFiles() {
        try {
            const stored = localStorage.getItem('erd-editor-recent-files');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('최근 파일 목록 로드 실패:', error);
            return [];
        }
    }
    
    clearRecentFiles() {
        localStorage.removeItem('erd-editor-recent-files');
    }
    
    // 파일 시스템 헬퍼 (실제 구현은 Tauri를 통해)
    async readFile(filePath) {
        // Tauri를 통한 파일 읽기 구현 필요
        throw new Error('File reading not implemented');
    }
    
    async writeFile(filePath, content) {
        // Tauri를 통한 파일 쓰기 구현 필요
        throw new Error('File writing not implemented');
    }
}