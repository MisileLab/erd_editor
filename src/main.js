import { invoke } from '@tauri-apps/api/core';
import Canvas from './components/Canvas.js';
import EntityManager from './components/EntityManager.js';
import RelationManager from './components/RelationManager.js';
import FileHandler from './utils/file-handler.js';

class ERDEditor {
    constructor() {
        this.canvas = new Canvas('canvas');
        this.entityManager = new EntityManager(this.canvas);
        this.relationManager = new RelationManager(this.canvas, this.entityManager);
        this.fileHandler = new FileHandler();
        
        this.diagram = {
            entities: {},
            relations: [],
            canvas_width: 1200,
            canvas_height: 800
        };
        
        this.isDragging = false; // 드래그 상태 추적
        this.autoSaveEnabled = true;
        this.lastBackupTime = null;
        this.currentFilePath = null; // 현재 열린 파일의 경로
        
        this.initializeEventListeners();
        this.setupFileHandlerEvents();
        this.setupAutoSave();
        this.setupRelationEditing();
        this.setupModalDragFunctionality();
        this.loadAutoBackup();
        this.render();
    }
    
    initializeEventListeners() {
        // 툴바 버튼 이벤트
        const newBtn = document.getElementById('new-btn');
        if (newBtn) newBtn.addEventListener('click', () => this.newDiagram());
        // 메뉴 항목과 기존 버튼 동시 지원
        const openBtn = document.getElementById('open-btn');
        const saveBtn = document.getElementById('save-btn');
        const menuOpen = document.getElementById('menu-open');
        const menuSave = document.getElementById('menu-save');
        const menuSaveAs = document.getElementById('menu-save-as');
        const menuExportMd = document.getElementById('menu-export-md');
        const menuExportMermaid = document.getElementById('menu-export-mermaid');
        const menuImportXlsx = document.getElementById('menu-import-xlsx');
        const menuExportXlsx = document.getElementById('menu-export-xlsx');
        if (openBtn) openBtn.addEventListener('click', () => this.openDiagram());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveDiagram());
        if (menuOpen) menuOpen.addEventListener('click', () => this.openDiagram());
        if (menuSave) menuSave.addEventListener('click', () => this.saveDiagram());
        if (menuSaveAs) menuSaveAs.addEventListener('click', () => this.saveAsDialog());
        if (menuExportMd) menuExportMd.addEventListener('click', () => this.exportMarkdown());
        if (menuExportMermaid) menuExportMermaid.addEventListener('click', () => this.exportMermaid());
        if (menuImportXlsx) menuImportXlsx.addEventListener('click', () => this.importXlsx());
        if (menuExportXlsx) menuExportXlsx.addEventListener('click', () => this.exportXlsx());
        const saveAsBtn = document.getElementById('save-as-btn');
        if (saveAsBtn) saveAsBtn.addEventListener('click', () => this.saveAsDialog());
        const addEntityBtn = document.getElementById('add-entity-btn');
        if (addEntityBtn) addEntityBtn.addEventListener('click', () => this.addEntity());
        const addRelationBtn = document.getElementById('add-relation-btn');
        if (addRelationBtn) addRelationBtn.addEventListener('click', () => this.addRelation());
        const menuAddEntity = document.getElementById('menu-add-entity');
        const menuAddRelation = document.getElementById('menu-add-relation');
        if (menuAddEntity) menuAddEntity.addEventListener('click', () => this.addEntity());
        if (menuAddRelation) menuAddRelation.addEventListener('click', () => this.addRelation());
        const exportMdBtn = document.getElementById('export-md-btn');
        if (exportMdBtn) exportMdBtn.addEventListener('click', () => this.exportMarkdown());
        const exportMermaidBtn = document.getElementById('export-mermaid-btn');
        if (exportMermaidBtn) exportMermaidBtn.addEventListener('click', () => this.exportMermaid());
        const toggleSidebarBtn = document.getElementById('toggle-entity-list-btn');
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');
        if (toggleSidebarBtn) {
            toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        }
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => { this.canvas.zoomIn(); this.render(); });
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => { this.canvas.zoomOut(); this.render(); });
        }
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => { this.canvas.resetZoom(); this.render(); });
        }
        
        // 엔티티 관리자 이벤트
        this.entityManager.on('entityAdded', (entity) => {
            this.diagram.entities[entity.id] = entity;
            this.canvas.setEntities(this.diagram.entities);
            this.canvas.setRelations(this.diagram.relations);
            this.updateEntityList();
            this.render();
            this.fileHandler.markAsModified();
        });
        
        this.entityManager.on('entityUpdated', (entity) => {
            this.diagram.entities[entity.id] = entity;
            this.canvas.setEntities(this.diagram.entities);
            this.canvas.setRelations(this.diagram.relations);
            this.updateEntityList();
            this.render();
            this.fileHandler.markAsModified();
        });
        
        this.entityManager.on('entityDeleted', (entityId) => {
            delete this.diagram.entities[entityId];
            this.diagram.relations = this.diagram.relations.filter(
                relation => relation.from_entity_id !== entityId && relation.to_entity_id !== entityId
            );
            this.canvas.setEntities(this.diagram.entities);
            this.canvas.setRelations(this.diagram.relations);
            this.updateEntityList();
            this.render();
            this.fileHandler.markAsModified();
        });
        
        // 관계 관리자 이벤트
        this.relationManager.on('relationAdded', (relation) => {
            console.log('🔥 MAIN: relationAdded event received:', relation);
            console.log('🔥 MAIN: Current diagram.relations length before:', this.diagram.relations.length);
            this.diagram.relations.push(relation);
            console.log('🔥 MAIN: Current diagram.relations length after:', this.diagram.relations.length);
            this.canvas.setRelations(this.diagram.relations);
            this.render();
            this.fileHandler.markAsModified();
            console.log('🔥 MAIN: Relation added and rendered successfully');
        });
        
        this.relationManager.on('relationUpdated', (updatedRelation) => {
            console.log('Relation updated in main:', updatedRelation);
            const index = this.diagram.relations.findIndex(r => r.id === updatedRelation.id);
            if (index !== -1) {
                this.diagram.relations[index] = updatedRelation;
                this.canvas.setRelations(this.diagram.relations);
                this.render();
                this.fileHandler.markAsModified();
                console.log('Relation updated and rendered');
            } else {
                console.error('Updated relation not found in diagram:', updatedRelation.id);
            }
        });
        
        this.relationManager.on('relationDeleted', (relationId) => {
            this.diagram.relations = this.diagram.relations.filter(r => r.id !== relationId);
            this.canvas.setRelations(this.diagram.relations);
            this.render();
            this.fileHandler.markAsModified();
        });
        
        // 캔버스 이벤트
        this.canvas.on('entityMoved', (entityId, x, y) => {
            if (this.diagram.entities[entityId]) {
                console.log('Entity moved:', entityId, 'to:', { x, y });
                this.diagram.entities[entityId].x = x;
                this.diagram.entities[entityId].y = y;
                
                // 드래그 중이 아닐 때만 렌더링 (드래그 중에는 캔버스에서 직접 처리)
                if (!this.isDragging) {
                    this.canvas.setEntities(this.diagram.entities);
                    this.canvas.setRelations(this.diagram.relations);
                    this.render();
                }
            }
        });
        
        // Window 이벤트 리스너 (FK 자동 생성 시)
        window.addEventListener('entityUpdated', (event) => {
            const updatedEntity = event.detail;
            if (updatedEntity && this.diagram.entities[updatedEntity.id]) {
                console.log('Entity updated via window event:', updatedEntity.name);
                this.diagram.entities[updatedEntity.id] = updatedEntity;
                this.canvas.setEntities(this.diagram.entities);
                this.canvas.setRelations(this.diagram.relations);
                this.updateEntityList();
                this.render();
            }
        });
        
        // 드래그 시작/종료 이벤트 추가
        this.canvas.on('dragStart', (entityId) => {
            console.log('Drag started for:', entityId);
            this.isDragging = true;
        });
        
        this.canvas.on('dragEnd', (entityId) => {
            console.log('Drag ended for:', entityId);
            this.isDragging = false;
            
            // 드래그 완료 후 캔버스 엔티티 정보 동기화
            this.canvas.setEntities(this.diagram.entities);
            this.canvas.setRelations(this.diagram.relations);
            
            // 드래그 완료 후 최종 렌더링
            this.render();
            console.log('Final render completed for entity:', entityId);
        });
    }
    
    setupModalDragFunctionality() {
        // Make modals draggable by their headers
        const modals = ['entity-modal', 'relation-modal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const modalContent = modal?.querySelector('.modal-content');
            const modalHeader = modal?.querySelector('.modal-header');
            
            if (!modal || !modalContent || !modalHeader) return;
            
            let isDragging = false;
            let startX, startY, initialX, initialY;
            
            modalHeader.addEventListener('mousedown', (e) => {
                isDragging = true;
                const rect = modalContent.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;
                
                // Store initial position
                initialX = rect.left;
                initialY = rect.top;
                
                // Prevent text selection
                e.preventDefault();
                
                // Change cursor for better UX
                document.body.style.cursor = 'grabbing';
                modalHeader.style.cursor = 'grabbing';
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                e.preventDefault();
                
                const newX = e.clientX - startX;
                const newY = e.clientY - startY;
                
                // Constrain to viewport bounds
                const rect = modalContent.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                const constrainedX = Math.max(0, Math.min(newX, viewportWidth - rect.width));
                const constrainedY = Math.max(0, Math.min(newY, viewportHeight - rect.height));
                
                // Update position
                modalContent.style.left = constrainedX + 'px';
                modalContent.style.top = constrainedY + 'px';
                modalContent.style.transform = 'none';
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = '';
                    modalHeader.style.cursor = 'move';
                }
            });
        });
    }
    
    setupRelationEditing() {
        console.log('Setting up relation editing');
        this.relationManager.setupRelationEditing();
    }
    
    newDiagram() {
        // 수정된 내용이 있으면 경고
        if (this.fileHandler.getModifiedStatus()) {
            if (!confirm('현재 다이어그램을 새로 만들까요? 저장하지 않은 변경사항은 사라집니다.')) {
                return;
            }
        }
        
        this.diagram = {
            entities: {},
            relations: [],
            canvas_width: 1200,
            canvas_height: 800
        };
        this.currentFilePath = null; // 파일 경로 초기화
        this.fileHandler.markAsSaved();
        this.updateEntityList();
        this.render();
        this.createAutoBackup();
    }
    
    async openDiagram() {
        console.log('파일 열기 시작');
        
        try {
            console.log('invoke 호출 시작');
            const result = await invoke('load_diagram_from_file');
            console.log('다이어그램 로드 성공:', result);
            
            // 결과에서 다이어그램과 파일 경로 분리
            this.diagram = result.diagram;
            this.currentFilePath = result.file_path; // 파일 경로 저장
            
            // 캔버스에 데이터 설정 (렌더링 전 필수)
            this.canvas.setEntities(this.diagram.entities);
            this.canvas.setRelations(this.diagram.relations);
            
            // 매니저들에게 데이터 전달
            this.entityManager.setEntities(this.diagram.entities);
            this.relationManager.setRelations(this.diagram.relations);
            
            // UI 업데이트
            this.updateEntityList();
            
            // 렌더링 (캔버스 데이터 설정 후)
            this.render();
            
            console.log('다이어그램 적용 완료');
            console.log('로드된 엔티티 수:', Object.keys(this.diagram.entities).length);
            console.log('로드된 관계 수:', this.diagram.relations.length);
            
            alert('파일을 성공적으로 불러왔습니다!');
        } catch (error) {
            console.error('파일 열기 에러:', error);
            if (error !== 'Open cancelled' && !String(error).includes('cancelled')) {
                alert('파일을 열 수 없습니다: ' + error);
            }
        }
    }
    
    async saveDiagram() {
        try {
            let filePath;
            
            if (this.currentFilePath) {
                // 기존 파일 경로가 있으면 바로 저장
                console.log('기존 파일에 저장:', this.currentFilePath);
                filePath = await invoke('save_diagram_to_path', {
                    diagram: this.diagram,
                    file_path: this.currentFilePath
                });
                this.showSuccessMessage('저장 완료', `파일이 저장되었습니다: ${filePath}`);
            } else {
                // 파일 경로가 없으면 Save As 실행
                filePath = await this.saveAsDialog();
            }
            
            this.fileHandler.markAsSaved();
        } catch (error) {
            if (error !== 'Save cancelled' && !String(error).includes('cancelled')) {
                alert('저장할 수 없습니다: ' + error);
            }
        }
    }
    
    async saveAsDialog() {
        const filePath = await invoke('save_diagram_to_file', { diagram: this.diagram });
        this.currentFilePath = filePath; // 새로 선택한 경로 저장
        this.showSuccessMessage('저장 완료', `파일이 저장되었습니다: ${filePath}`);
        return filePath;
    }
    
    addEntity() {
        const x = Math.random() * 500 + 50;
        const y = Math.random() * 300 + 50;
        this.entityManager.showEntityModal(null, x, y);
    }
    
    addRelation() {
        const entityIds = Object.keys(this.diagram.entities);
        if (entityIds.length < 2) {
            alert('관계를 만들기 위해서는 최소 2개의 엔티티가 필요합니다.');
            return;
        }
        this.relationManager.showRelationModal();
    }
    
    async exportMarkdown() {
        this.showLoadingIndicator('Markdown 내보내기 중...');
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Markdown 내보내기 시간이 초과되었습니다.')), 30000);
            });
            
            const exportPromise = invoke('export_markdown', { diagram: this.diagram });
            
            const filePath = await Promise.race([exportPromise, timeoutPromise]);
            
            this.hideLoadingIndicator();
            this.showSuccessMessage('Markdown 내보내기 완료', filePath);
        } catch (error) {
            this.hideLoadingIndicator();
            const errorMsg = error.message || error;
            if (!errorMsg.includes('취소') && !errorMsg.includes('cancelled')) {
                this.showErrorMessage('Markdown 내보내기 실패', errorMsg);
            }
        }
    }
    
    async exportMermaid() {
        this.showLoadingIndicator('Mermaid 내보내기 중...');
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Mermaid 내보내기 시간이 초과되었습니다.')), 30000);
            });
            
            const exportPromise = invoke('export_mermaid', { diagram: this.diagram });
            
            const filePath = await Promise.race([exportPromise, timeoutPromise]);
            
            this.hideLoadingIndicator();
            this.showSuccessMessage('Mermaid 내보내기 완료', filePath);
        } catch (error) {
            this.hideLoadingIndicator();
            const errorMsg = error.message || error;
            if (!errorMsg.includes('취소') && !errorMsg.includes('cancelled')) {
                this.showErrorMessage('Mermaid 내보내기 실패', errorMsg);
            }
        }
    }
    
    async exportXlsx() {
        this.showLoadingIndicator('XLSX 내보내기 중...');
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('XLSX 내보내기 시간이 초과되었습니다.')), 30000);
            });
            
            const exportPromise = this.fileHandler.exportXlsx(this.diagram);
            
            const filePath = await Promise.race([exportPromise, timeoutPromise]);
            
            this.hideLoadingIndicator();
            this.showSuccessMessage('XLSX 내보내기 완료', filePath);
        } catch (error) {
            this.hideLoadingIndicator();
            const errorMsg = error.message || error;
            if (!errorMsg.includes('취소') && !errorMsg.includes('cancelled')) {
                this.showErrorMessage('XLSX 내보내기 실패', errorMsg);
            }
        }
    }
    
    async importXlsx() {
        // 수정된 내용이 있으면 경고
        if (this.fileHandler.getModifiedStatus()) {
            if (!confirm('XLSX 파일을 가져오면 현재 다이어그램이 교체됩니다. 저장하지 않은 변경사항은 사라집니다. 계속하시겠습니까?')) {
                return;
            }
        }
        
        this.showLoadingIndicator('XLSX 가져오기 중...');
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('XLSX 가져오기 시간이 초과되었습니다.')), 30000);
            });
            
            const importPromise = this.fileHandler.importXlsx();
            
            const diagram = await Promise.race([importPromise, timeoutPromise]);
            
            // 다이어그램 적용
            this.diagram = diagram;
            this.currentFilePath = null; // 새로 가져온 파일이므로 경로 초기화
            
            // 캔버스에 데이터 설정
            this.canvas.setEntities(this.diagram.entities);
            this.canvas.setRelations(this.diagram.relations);
            
            // 매니저들에게 데이터 전달
            this.entityManager.setEntities(this.diagram.entities);
            this.relationManager.setRelations(this.diagram.relations);
            
            // UI 업데이트
            this.updateEntityList();
            this.render();
            
            this.fileHandler.markAsModified(); // 가져온 후 수정 상태로 표시
            
            this.hideLoadingIndicator();
            this.showSuccessMessage('XLSX 가져오기 완료', `${Object.keys(this.diagram.entities).length}개 엔티티와 ${this.diagram.relations.length}개 관계를 가져왔습니다.`);
        } catch (error) {
            this.hideLoadingIndicator();
            const errorMsg = error.message || error;
            if (!errorMsg.includes('취소') && !errorMsg.includes('cancelled')) {
                this.showErrorMessage('XLSX 가져오기 실패', errorMsg);
            }
        }
    }
    
    updateEntityList() {
        const entityList = document.getElementById('entity-list');
        entityList.innerHTML = '';
        
        Object.values(this.diagram.entities).forEach(entity => {
            const entityItem = document.createElement('div');
            entityItem.className = 'entity-item';
            
            // 화면 표시용 이름: 논리명 우선, 없으면 기본명
            const displayName = entity.logical_name || entity.name;
            
            entityItem.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 4px;">${displayName}</div>
                <div style="font-size: 12px; color: #666;">
                    ${entity.attributes.length}개 속성
                </div>
            `;
            
            entityItem.addEventListener('click', () => {
                this.selectEntity(entity.id);
            });
            
            entityItem.addEventListener('dblclick', () => {
                this.entityManager.showEntityModal(entity);
            });
            
            entityList.appendChild(entityItem);
        });
    }
    
    selectEntity(entityId) {
        // 기존 선택 해제
        document.querySelectorAll('.entity-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 새로운 엔티티 선택
        const entityItems = document.querySelectorAll('.entity-item');
        entityItems.forEach((item, index) => {
            if (Object.keys(this.diagram.entities)[index] === entityId) {
                item.classList.add('selected');
            }
        });
        
        // 캔버스에서도 해당 엔티티 하이라이트
        this.canvas.selectEntity(entityId);
        this.render();
    }
    
    render() {
        console.log('렌더링 시작 - 엔티티 수:', Object.keys(this.diagram.entities).length);
        console.log('렌더링 시작 - 관계 수:', this.diagram.relations.length);
        
        this.canvas.updateCanvasSizeToFitContent();
        this.canvas.clear();
        
        // 관계선 먼저 그리기 (엔티티 뒤에 나타나도록)
        this.diagram.relations.forEach(relation => {
            const fromEntity = this.diagram.entities[relation.from_entity_id];
            const toEntity = this.diagram.entities[relation.to_entity_id];
            
            if (fromEntity && toEntity) {
                this.canvas.drawRelation(fromEntity, toEntity, relation);
            }
        });
        
        // 엔티티 그리기
        Object.values(this.diagram.entities).forEach(entity => {
            console.log('엔티티 렌더링:', entity.name, '위치:', { x: entity.x, y: entity.y });
            this.canvas.drawEntity(entity);
        });
        
        console.log('렌더링 완료');
    }
    
    renderEntity(entity) {
        // 전체 다시 그리기 (관계선도 함께 업데이트되어야 함)
        this.render();
    }
    
    // FileHandler 이벤트 설정
    setupFileHandlerEvents() {
        this.fileHandler.on('loadingStateChanged', (state) => {
            if (state.isLoading) {
                this.showLoadingIndicator(state.operation, state.progress);
            } else {
                this.hideLoadingIndicator();
            }
        });
        
        this.fileHandler.on('diagramLoaded', (data) => {
            console.log('다이어그램 로드 완료:', data.filePath);
        });
        
        this.fileHandler.on('diagramSaved', (data) => {
            console.log('다이어그램 저장 완료:', data.filePath);
        });
        
        this.fileHandler.on('loadError', (data) => {
            console.error('로드 에러:', data.error);
        });
        
        this.fileHandler.on('saveError', (data) => {
            console.error('저장 에러:', data.error);
        });
    }
    
    // 자동 저장 설정
    setupAutoSave() {
        if (this.autoSaveEnabled) {
            setInterval(() => {
                this.createAutoBackup();
            }, 60000); // 1분마다 자동 백업
        }
    }
    
    // 자동 백업 생성
    createAutoBackup() {
        try {
            const backupData = {
                diagram: this.diagram,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            
            localStorage.setItem('erd-editor-auto-backup', JSON.stringify(backupData));
            this.lastBackupTime = new Date();
            console.log('자동 백업 완료:', this.lastBackupTime.toLocaleString());
        } catch (error) {
            console.error('자동 백업 실패:', error);
        }
    }
    
    // 자동 백업 복구
    loadAutoBackup() {
        try {
            const backupData = localStorage.getItem('erd-editor-auto-backup');
            if (backupData) {
                const parsed = JSON.parse(backupData);
                const backupTime = new Date(parsed.timestamp);
                
                // 백업이 24시간 이내인지 확인
                const now = new Date();
                const hoursDiff = (now - backupTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 24 && parsed.diagram) {
                    if (confirm(`자동 저장된 데이터가 있습니다 (${backupTime.toLocaleString()}). 복구하시겠습니까?`)) {
                        this.diagram = parsed.diagram;
                        this.entityManager.setEntities(this.diagram.entities);
                        this.relationManager.setRelations(this.diagram.relations);
                        this.updateEntityList();
                        this.render();
                        this.showSuccessMessage('복구 완료', '자동 백업에서 다이어그램을 복구했습니다.');
                    }
                }
            }
        } catch (error) {
            console.error('자동 백업 로드 실패:', error);
        }
    }
    
    // UI 메시지 표시 함수들
    showLoadingIndicator(message, progress = 0) {
        let indicator = document.getElementById('loading-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'loading-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 1000;
                text-align: center;
                min-width: 200px;
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.innerHTML = `
            <div>${message}</div>
            <div style="margin-top: 10px; background: #333; border-radius: 4px; overflow: hidden;">
                <div style="height: 4px; background: #007acc; width: ${progress}%; transition: width 0.3s;"></div>
            </div>
        `;
        indicator.style.display = 'block';
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const btn = document.getElementById('toggle-entity-list-btn');
        if (!sidebar || !btn) return;
        const collapsed = sidebar.classList.toggle('collapsed');
        btn.textContent = collapsed ? '목록 펼치기' : '목록 접기';
        // 사이드바가 변경되면 캔버스 영역이 바뀌므로 캔버스 크기 재계산 후 렌더
        setTimeout(() => {
            this.canvas.updateCanvasSizeToFitContent();
            this.render();
        }, 0);
    }
    
    hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    showSuccessMessage(title, message) {
        this.showNotification(title, message, 'success');
    }
    
    showErrorMessage(title, message) {
        this.showNotification(title, message, 'error');
    }
    
    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 2000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
            <div style="font-size: 14px; opacity: 0.9;">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // 애니메이션 CSS 추가
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 3초 후 자동 제거
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// 애플리케이션 시작 - 더 안전한 초기화
function initializeApp() {
    // 필수 DOM 요소들이 존재하는지 확인
    const requiredElements = ['canvas', 'entity-list', 'add-entity-btn', 'entity-modal'];
    const missing = requiredElements.filter(id => !document.getElementById(id));
    
    if (missing.length > 0) {
        console.error('필수 DOM 요소 누락:', missing);
        console.log('DOM 준비 대기 중...');
        // 100ms 후 재시도
        setTimeout(initializeApp, 100);
        return;
    }
    
    console.log('모든 필수 DOM 요소 확인 완료, ERDEditor 초기화 시작');
    try {
        new ERDEditor();
        console.log('ERDEditor 초기화 완료');
    } catch (error) {
        console.error('ERDEditor 초기화 실패:', error);
    }
}

// DOM이 준비되면 초기화 시작
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // 이미 DOM이 준비된 경우 즉시 실행
    initializeApp();
}