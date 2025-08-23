export default class EntityManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.entities = {};
        this.eventListeners = {};
        this.currentEntity = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 모달 관련 이벤트
        const entityModal = document.getElementById('entity-modal');
        const entityForm = document.getElementById('entity-form');
        const cancelBtn = document.getElementById('cancel-entity-btn');
        const addAttributeBtn = document.getElementById('add-attribute-btn');
        
        entityForm.addEventListener('submit', (e) => this.handleEntitySubmit(e));
        cancelBtn.addEventListener('click', () => this.hideEntityModal());
        addAttributeBtn.addEventListener('click', () => this.addAttributeField());
        
        // 모달 외부 클릭으로 닫기
        entityModal.addEventListener('click', (e) => {
            if (e.target === entityModal) {
                this.hideEntityModal();
            }
        });
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && entityModal.style.display === 'flex') {
                this.hideEntityModal();
            }
        });
        
        // 캔버스 이벤트
        this.canvas.on('entityDoubleClick', (entityId) => {
            const entity = this.entities[entityId];
            if (entity) {
                this.showEntityModal(entity);
            }
        });
        
        this.canvas.on('canvasDoubleClick', (position) => {
            this.showEntityModal(null, position.x, position.y);
        });
        
        this.canvas.on('entityContextMenu', (data) => {
            this.showContextMenu(data);
        });
    }
    
    generateId() {
        return 'entity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    showEntityModal(entity = null, x = 100, y = 100) {
        this.currentEntity = entity;
        
        const modal = document.getElementById('entity-modal');
        const form = document.getElementById('entity-form');
        const logicalNameInput = document.getElementById('entity-logical-name');
        const physicalNameInput = document.getElementById('entity-physical-name');
        const attributesContainer = document.getElementById('attributes-container');
        
        // 폼 초기화
        form.reset();
        attributesContainer.innerHTML = ``;
        
        if (entity) {
            // 기존 엔티티 편집
            logicalNameInput.value = entity.logical_name;
            physicalNameInput.value = entity.physical_name;
            
            entity.attributes.forEach(attr => {
                this.addAttributeField(attr);
            });
        } else {
            // 새 엔티티 생성
            this.addAttributeField(); // 기본 속성 하나 추가
        }
        
        modal.style.display = 'flex';
        logicalNameInput.focus();
    }
    
    hideEntityModal() {
        document.getElementById('entity-modal').style.display = 'none';
        this.currentEntity = null;
    }
    
    addAttributeField(attribute = null) {
        const container = document.getElementById('attributes-container');
        const attributeId = 'attr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        
        const attributeDiv = document.createElement('div');
        attributeDiv.className = 'attribute-field';
        // 스타일은 모두 CSS에서 처리
        
        attributeDiv.innerHTML = `
            <!-- 첫 번째 행: 위아래 버튼 + 입력 필드들 + 삭제 버튼 -->
            <div class="attribute-row-main">
                <!-- 위아래 버튼 -->
                <div class="attribute-move-buttons">
                    <button type="button" class="move-up-btn">▲</button>
                    <button type="button" class="move-down-btn">▼</button>
                </div>
                
                <!-- 논리명 입력 -->
                <input type="text" name="attr_logical_name" value="${attribute ? attribute.logical_name : ''}" 
                       placeholder="회사명" required 
                       class="attribute-input-flex">
                
                <!-- 물리명 입력 -->
                <input type="text" name="attr_physical_name" value="${attribute ? attribute.physical_name : ''}" 
                       placeholder="name" required 
                       class="attribute-input-flex">
                
                <!-- 데이터 타입 드롭다운 -->
                <select name="attr_type" class="attribute-select-type">
                    <option value="VARCHAR" ${attribute && attribute.data_type === 'VARCHAR' ? 'selected' : (!attribute ? 'selected' : '')}>VARCHAR</option>
                    <option value="INT" ${attribute && attribute.data_type === 'INT' ? 'selected' : ''}>INT</option>
                    <option value="TEXT" ${attribute && attribute.data_type === 'TEXT' ? 'selected' : ''}>TEXT</option>
                    <option value="DATE" ${attribute && attribute.data_type === 'DATE' ? 'selected' : ''}>DATE</option>
                    <option value="DATETIME" ${attribute && attribute.data_type === 'DATETIME' ? 'selected' : ''}>DATETIME</option>
                    <option value="DECIMAL" ${attribute && attribute.data_type === 'DECIMAL' ? 'selected' : ''}>DECIMAL</option>
                    <option value="BOOLEAN" ${attribute && attribute.data_type === 'BOOLEAN' ? 'selected' : ''}>BOOLEAN</option>
                </select>
                
                <!-- 길이 입력 -->
                <input type="text" name="attr_length" value="${attribute ? (attribute.length || '') : ''}" 
                       placeholder="200" 
                       class="attribute-input-length">
                
                <!-- 기본값 입력 -->
                <input type="text" name="attr_default_value" value="${attribute ? (attribute.default_value || '') : ''}" 
                       placeholder="기본값" 
                       class="attribute-input-default">
                
                <!-- 삭제 버튼 -->
                <button type="button" class="remove-attr-btn">🗑️</button>
            </div>
            
            <!-- 두 번째 행: 체크박스들을 가로 배열 -->
            <div class="attribute-row-checkboxes">
                <!-- PK 체크박스 -->
                <label class="attribute-checkbox-label">
                    <input type="checkbox" name="attr_pk" ${attribute && attribute.is_primary_key ? 'checked' : ''} 
                           class="attribute-checkbox">
                    <span class="attribute-checkbox-text">PK</span>
                </label>
                
                <!-- FK 체크박스 -->
                <label class="attribute-checkbox-label">
                    <input type="checkbox" name="attr_fk" ${attribute && attribute.is_foreign_key ? 'checked' : ''} 
                           class="attribute-checkbox">
                    <span class="attribute-checkbox-text">FK</span>
                </label>
                
                <!-- NOT NULL 체크박스 -->
                <label class="attribute-checkbox-label">
                    <input type="checkbox" name="attr_not_null" ${attribute && !attribute.is_nullable ? 'checked' : ''} 
                           class="attribute-checkbox">
                    <span class="attribute-checkbox-text">NOT NULL</span>
                </label>
                
                <!-- UNIQUE 체크박스 -->
                <label class="attribute-checkbox-label">
                    <input type="checkbox" name="attr_unique" ${attribute && attribute.is_unique ? 'checked' : ''} 
                           class="attribute-checkbox">
                    <span class="attribute-checkbox-text">UNIQUE</span>
                </label>
                
                <!-- AUTO_INCREMENT 체크박스 -->
                <label class="attribute-checkbox-label">
                    <input type="checkbox" name="attr_auto_increment" ${attribute && attribute.is_auto_increment ? 'checked' : ''} 
                           class="attribute-checkbox">
                    <span class="attribute-checkbox-text">AUTO_INCREMENT</span>
                </label>
            </div>
            
            <!-- 세 번째 행: Remark(비고) 입력 -->
            <div style="display:flex; align-items:center; gap:8px; margin: 6px 0 0 40px;">
                <label style="min-width:60px; font-size:12px; color:#555;">Remark</label>
                <input type="text" name="attr_remark" value="${attribute ? (attribute.remark || '') : ''}" 
                       placeholder="설명/비고" class="attribute-input-flex">
            </div>
        `;
        
        // 삭제 버튼 이벤트
        const removeBtn = attributeDiv.querySelector('.remove-attr-btn');
        removeBtn.addEventListener('click', () => {
            attributeDiv.remove();
            this.updateMoveButtons();
        });
        
        // 위아래 버튼 이벤트
        const moveUpBtn = attributeDiv.querySelector('.move-up-btn');
        const moveDownBtn = attributeDiv.querySelector('.move-down-btn');
        
        moveUpBtn.addEventListener('click', () => {
            this.moveAttributeUp(attributeDiv);
            this.updateMoveButtons();
        });
        
        moveDownBtn.addEventListener('click', () => {
            this.moveAttributeDown(attributeDiv);
            this.updateMoveButtons();
        });
        
        container.appendChild(attributeDiv);
        this.updateMoveButtons();
    }
    
    moveAttributeUp(attributeDiv) {
        const previousSibling = attributeDiv.previousElementSibling;
        if (previousSibling && previousSibling.classList.contains('attribute-field')) {
            attributeDiv.parentNode.insertBefore(attributeDiv, previousSibling);
            console.log('Moved attribute up');
        }
    }
    
    moveAttributeDown(attributeDiv) {
        const nextSibling = attributeDiv.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains('attribute-field')) {
            attributeDiv.parentNode.insertBefore(nextSibling, attributeDiv);
            console.log('Moved attribute down');
        }
    }
    
    updateMoveButtons() {
        const attributeFields = document.querySelectorAll('.attribute-field');
        
        attributeFields.forEach((field, index) => {
            const moveUpBtn = field.querySelector('.move-up-btn');
            const moveDownBtn = field.querySelector('.move-down-btn');
            
            if (moveUpBtn && moveDownBtn) {
                // 첫 번째 속성은 위로 이동 불가
                moveUpBtn.disabled = (index === 0);
                
                // 마지막 속성은 아래로 이동 불가
                moveDownBtn.disabled = (index === attributeFields.length - 1);
            }
        });
    }
    
    handleEntitySubmit(e) {
        e.preventDefault();
        console.log('Form submitted!');
        
        const formData = new FormData(e.target);
        const entityLogicalName = formData.get('entity-logical-name');
        const entityPhysicalName = formData.get('entity-physical-name');
        console.log('Entity Logical:', entityLogicalName, 'Physical:', entityPhysicalName);
        
        // 속성 데이터 수집
        const attributes = [];
        const attributeFields = document.querySelectorAll('.attribute-field');
        console.log('Attribute fields found:', attributeFields.length);
        
        attributeFields.forEach(field => {
            const logicalName = field.querySelector('input[name="attr_logical_name"]').value;
            const physicalName = field.querySelector('input[name="attr_physical_name"]').value;
            const dataType = field.querySelector('select[name="attr_type"]').value;
            const length = field.querySelector('input[name="attr_length"]').value;
            const defaultValue = field.querySelector('input[name="attr_default_value"]').value;
            const isPrimaryKey = field.querySelector('input[name="attr_pk"]').checked;
            const isForeignKey = field.querySelector('input[name="attr_fk"]').checked;
            const isNotNull = field.querySelector('input[name="attr_not_null"]').checked;
            const isUnique = field.querySelector('input[name="attr_unique"]').checked;
            const isAutoIncrement = field.querySelector('input[name="attr_auto_increment"]').checked;
            const remark = field.querySelector('input[name="attr_remark"]').value;
            
            if (logicalName.trim() && physicalName.trim()) {
                attributes.push({
                    logical_name: logicalName.trim(),
                    physical_name: physicalName.trim(),
                    data_type: dataType,
                    length: length.trim() || null,
                    default_value: defaultValue.trim() || null,
                    is_primary_key: isPrimaryKey,
                    is_foreign_key: isForeignKey,
                    is_nullable: !isNotNull,
                    is_unique: isUnique,
                    is_auto_increment: isAutoIncrement,
                    foreign_key_reference: null,
                    remark: remark.trim() || null
                });
            }
        });
        
        if (!entityLogicalName.trim() || !entityPhysicalName.trim()) {
            alert('엔티티 논리명과 물리명을 모두 입력하세요.');
            return;
        }
        
        if (attributes.length === 0) {
            alert('최소 하나의 속성을 추가하세요.');
            return;
        }
        
        let entity;
        
        if (this.currentEntity) {
            // 기존 엔티티 업데이트
            entity = {
                ...this.currentEntity,
                logical_name: entityLogicalName.trim(),
                physical_name: entityPhysicalName.trim(),
                attributes: attributes
            };
            
            this.entities[entity.id] = entity;
            this.emit('entityUpdated', entity);
        } else {
            // 새 엔티티 생성
            entity = {
                id: this.generateId(),
                logical_name: entityLogicalName.trim(),
                physical_name: entityPhysicalName.trim(),
                x: Math.random() * 500 + 50,
                y: Math.random() * 300 + 50,
                width: 150,
                height: 100,
                attributes: attributes
            };
            
            this.entities[entity.id] = entity;
            this.emit('entityAdded', entity);
        }
        
        this.hideEntityModal();
    }
    
    showContextMenu(data) {
        const contextMenu = document.getElementById('context-menu');
        
        // 기존 이벤트 리스너 제거
        const items = contextMenu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // 새 이벤트 리스너 추가
        contextMenu.querySelector('[data-action="edit"]').addEventListener('click', () => {
            this.hideContextMenu();
            const entity = this.entities[data.entityId];
            if (entity) {
                this.showEntityModal(entity);
            }
        });
        
        contextMenu.querySelector('[data-action="delete"]').addEventListener('click', () => {
            this.hideContextMenu();
            if (confirm('정말 이 엔티티를 삭제하시겠습니까?')) {
                this.deleteEntity(data.entityId);
            }
        });
        
        // 컨텍스트 메뉴 표시
        contextMenu.style.display = 'block';
        contextMenu.style.left = data.x + 'px';
        contextMenu.style.top = data.y + 'px';
        
        // 외부 클릭으로 닫기
        const hideMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideMenu);
        }, 10);
    }
    
    hideContextMenu() {
        document.getElementById('context-menu').style.display = 'none';
    }
    
    deleteEntity(entityId) {
        if (this.entities[entityId]) {
            delete this.entities[entityId];
            this.emit('entityDeleted', entityId);
        }
    }
    
    setEntities(entities) {
        this.entities = entities || {};
        this.canvas.setEntities(this.entities);
    }
    
    getEntities() {
        return this.entities;
    }
    
    getEntityIds() {
        return Object.keys(this.entities);
    }
    
    // 이벤트 시스템
    on(eventName, callback) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }
    
    emit(eventName, data) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(callback => callback(data));
        }
    }
}