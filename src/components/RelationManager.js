export default class RelationManager {
    constructor(canvas, entityManager) {
        this.canvas = canvas;
        this.entityManager = entityManager;
        this.relations = [];
        this.eventListeners = {};
        this.currentRelation = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 모달 관련 이벤트
        const relationModal = document.getElementById('relation-modal');
        const relationForm = document.getElementById('relation-form');
        const cancelBtn = document.getElementById('cancel-relation-btn');
        const deleteBtn = document.getElementById('delete-relation-btn');
        const fromEntitySelect = document.getElementById('from-entity');
        const toEntitySelect = document.getElementById('to-entity');
        
        relationForm.addEventListener('submit', (e) => this.handleRelationSubmit(e));
        cancelBtn.addEventListener('click', () => this.hideRelationModal());
        deleteBtn.addEventListener('click', () => this.handleDeleteRelation());
        
        // 엔티티 선택 변경 시 속성 목록 업데이트
        fromEntitySelect.addEventListener('change', (e) => this.updateFromAttributes(e.target.value));
        toEntitySelect.addEventListener('change', (e) => this.updateToAttributes(e.target.value));
        
        // 모달 외부 클릭으로 닫기
        relationModal.addEventListener('click', (e) => {
            if (e.target === relationModal) {
                this.hideRelationModal();
            }
        });
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && relationModal.style.display === 'flex') {
                this.hideRelationModal();
            }
        });
    }
    
    generateId() {
        return 'relation_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    showRelationModal(relation = null) {
        this.currentRelation = relation;
        
        const modal = document.getElementById('relation-modal');
        const form = document.getElementById('relation-form');
        const fromEntitySelect = document.getElementById('from-entity');
        const toEntitySelect = document.getElementById('to-entity');
        const cardinalitySelect = document.getElementById('cardinality');
        const relationNameInput = document.getElementById('relation-name');
        const deleteBtn = document.getElementById('delete-relation-btn');
        
        // 폼 초기화
        form.reset();
        
        // 엔티티 옵션 업데이트
        this.updateEntityOptions();
        
        // 삭제 버튼 표시/숨김
        if (relation) {
            deleteBtn.style.display = 'block';
            // 기존 관계 편집
            console.log('Loading relation for editing:', relation);
            fromEntitySelect.value = relation.from_entity_id;
            toEntitySelect.value = relation.to_entity_id;
            cardinalitySelect.value = relation.cardinality;
            relationNameInput.value = relation.name;
            
            // 속성 목록 업데이트
            this.updateFromAttributes(relation.from_entity_id);
            this.updateToAttributes(relation.to_entity_id);
            
            // 기존 속성 값 설정
            setTimeout(() => {
                const fromAttrSelect = document.getElementById('from-attribute');
                const toAttrSelect = document.getElementById('to-attribute');
                if (relation.from_attribute) {
                    fromAttrSelect.value = relation.from_attribute;
                }
                if (relation.to_attribute) {
                    toAttrSelect.value = relation.to_attribute;
                }
            }, 100);
        } else {
            deleteBtn.style.display = 'none';
        }
        
        modal.style.display = 'flex';
        fromEntitySelect.focus();
    }
    
    hideRelationModal() {
        document.getElementById('relation-modal').style.display = 'none';
        this.currentRelation = null;
    }
    
    handleDeleteRelation() {
        if (this.currentRelation && confirm('정말 이 관계를 삭제하시겠습니까?')) {
            this.deleteRelation(this.currentRelation.id);
            this.hideRelationModal();
        }
    }
    
    updateEntityOptions() {
        const fromSelect = document.getElementById('from-entity');
        const toSelect = document.getElementById('to-entity');
        const entities = this.entityManager.getEntities();
        
        // 기존 옵션 제거 (첫 번째 옵션은 유지)
        while (fromSelect.children.length > 1) {
            fromSelect.removeChild(fromSelect.lastChild);
        }
        while (toSelect.children.length > 1) {
            toSelect.removeChild(toSelect.lastChild);
        }
        
        // 엔티티 옵션 추가
        Object.values(entities).forEach(entity => {
            // 화면 표시용 이름: 논리명 우선, 없으면 기본명
            const displayName = entity.logical_name || entity.name;
            
            const fromOption = document.createElement('option');
            fromOption.value = entity.id;
            fromOption.textContent = displayName;
            fromSelect.appendChild(fromOption);
            
            const toOption = document.createElement('option');
            toOption.value = entity.id;
            toOption.textContent = displayName;
            toSelect.appendChild(toOption);
        });
    }
    
    updateFromAttributes(entityId) {
        const fromAttributeSelect = document.getElementById('from-attribute');
        const entities = this.entityManager.getEntities();
        
        // 기존 옵션 제거
        fromAttributeSelect.innerHTML = '<option value="">속성을 선택하세요</option>';
        
        if (entityId && entities[entityId]) {
            const entity = entities[entityId];
            entity.attributes.forEach(attr => {
                // PK 속성만 표시
                if (attr.is_primary_key) {
                    const option = document.createElement('option');
                    option.value = attr.physical_name;
                    option.textContent = `${attr.logical_name} (${attr.data_type})`;
                    fromAttributeSelect.appendChild(option);
                }
            });
            
            // PK가 없으면 경고
            if (fromAttributeSelect.children.length === 1) {
                fromAttributeSelect.innerHTML = '<option value="">이 엔티티에는 PK가 없습니다</option>';
            }
        }
    }
    
    updateToAttributes(entityId) {
        const toAttributeSelect = document.getElementById('to-attribute');
        const entities = this.entityManager.getEntities();
        
        // 기존 옵션 제거
        toAttributeSelect.innerHTML = '<option value="">자동 생성</option>';
        
        if (entityId && entities[entityId]) {
            const entity = entities[entityId];
            entity.attributes.forEach(attr => {
                // FK나 일반 속성 표시 (PK가 아닌 것들)
                if (!attr.is_primary_key) {
                    const option = document.createElement('option');
                    option.value = attr.physical_name;
                    option.textContent = `${attr.logical_name} (${attr.data_type})`;
                    toAttributeSelect.appendChild(option);
                }
            });
        }
    }
    
    handleRelationSubmit(e) {
        e.preventDefault();
        console.log('🚀 === RELATION FORM SUBMITTED ===');
        
        const formData = new FormData(e.target);
        const fromEntityId = formData.get('from-entity');
        const fromAttribute = formData.get('from-attribute');
        const toEntityId = formData.get('to-entity');
        const toAttributeRaw = formData.get('to-attribute');
        const toAttribute = (!toAttributeRaw || toAttributeRaw.trim() === '') ? null : toAttributeRaw.trim();
        console.log('=== Form Data Debug ===');
        console.log('toAttributeRaw:', `"${toAttributeRaw}"`);
        console.log('toAttribute (processed):', toAttribute);
        const cardinality = formData.get('cardinality');
        const relationName = formData.get('relation-name');
        
        console.log('Relation data:', { fromEntityId, fromAttribute, toEntityId, toAttribute, cardinality, relationName });
        
        if (!fromEntityId || !toEntityId || !fromAttribute) {
            alert('From 엔티티, From 속성, To 엔티티를 모두 선택하세요.');
            return;
        }
        
        if (fromEntityId === toEntityId) {
            alert('같은 엔티티끼리는 관계를 만들 수 없습니다.');
            return;
        }
        
        if (!relationName.trim()) {
            alert('관계 이름을 입력하세요.');
            return;
        }
        
        let relation;
        
        if (this.currentRelation) {
            // 기존 관계 업데이트
            relation = {
                ...this.currentRelation,
                from_entity_id: fromEntityId,
                from_attribute: fromAttribute,
                to_entity_id: toEntityId,
                to_attribute: toAttribute,
                cardinality: cardinality,
                name: relationName.trim()
            };
            
            console.log('Updating existing relation:', relation);
            const index = this.relations.findIndex(r => r.id === relation.id);
            console.log('Relation index in array:', index);
            if (index !== -1) {
                this.relations[index] = relation;
                console.log('Relation updated in RelationManager array');
            } else {
                console.error('Relation not found in RelationManager array!');
            }
            
            console.log('Emitting relationUpdated event:', relation);
            this.emit('relationUpdated', relation);
        } else {
            // 새 관계 생성
            relation = {
                id: this.generateId(),
                from_entity_id: fromEntityId,
                from_attribute: fromAttribute,
                to_entity_id: toEntityId,
                to_attribute: toAttribute,
                cardinality: cardinality,
                name: relationName.trim()
            };
            
            this.relations.push(relation);
            
            // FK 자동 생성 - 무조건 실행 (테스트용)
            console.log('🔍 === FK Auto-generation Check ===');
            console.log('Cardinality:', cardinality);
            console.log('toAttribute:', toAttribute);
            console.log('fromEntityId:', fromEntityId);
            console.log('toEntityId:', toEntityId);
            
            // 테스트: 모든 관계에서 FK 생성 시도
            console.log('✅ FORCE Creating FK for ANY relationship (TEST MODE)');
            this.createForeignKey(relation);
            
            console.log('Emitting relationAdded:', relation);
            this.emit('relationAdded', relation);
        }
        
        this.hideRelationModal();
    }
    
    createForeignKey(relation) {
        console.log('=== FK Creation Debug Start ===');
        console.log('Relation:', relation);
        
        const entities = this.entityManager.getEntities();
        const fromEntity = entities[relation.from_entity_id];
        const toEntity = entities[relation.to_entity_id];
        
        console.log('From Entity:', fromEntity);
        console.log('To Entity:', toEntity);
        
        if (!fromEntity || !toEntity) {
            console.error('Entity not found!');
            return;
        }
        
        // From 엔티티의 PK 속성 찾기 (physical_name으로 찾기)
        const pkAttribute = fromEntity.attributes.find(attr => attr.physical_name === relation.from_attribute);
        console.log('PK Attribute found:', pkAttribute);
        
        if (!pkAttribute) {
            console.error('PK attribute not found!');
            return;
        }
        
        // FK 속성 이름 생성 (물리명 기준)
        const fkPhysicalName = `${fromEntity.physical_name.toLowerCase()}_${pkAttribute.physical_name}`;
        const fkLogicalName = `${fromEntity.logical_name}_${pkAttribute.logical_name}`;
        console.log('FK physical name generated:', fkPhysicalName);
        console.log('FK logical name generated:', fkLogicalName);
        
        // 이미 같은 이름의 속성이 있는지 확인 (physical_name으로 체크)
        const existingAttr = toEntity.attributes.find(attr => attr.physical_name === fkPhysicalName);
        console.log('Existing attribute:', existingAttr);
        
        if (existingAttr) {
            // 이미 존재하면 FK로 마킹
            console.log('Marking existing attribute as FK');
            existingAttr.is_foreign_key = true;
            existingAttr.foreign_key_reference = `${fromEntity.physical_name}.${pkAttribute.physical_name}`;
            relation.to_attribute = fkPhysicalName;
        } else {
            // 새 FK 속성 생성
            console.log('Creating new FK attribute');
            const fkAttribute = {
                logical_name: fkLogicalName,
                physical_name: fkPhysicalName,
                data_type: pkAttribute.data_type,
                length: pkAttribute.length || null,
                default_value: null,
                is_primary_key: false,
                is_foreign_key: true,
                is_nullable: true,
                is_unique: false,
                is_auto_increment: false,
                foreign_key_reference: `${fromEntity.physical_name}.${pkAttribute.physical_name}`
            };
            
            console.log('New FK attribute:', fkAttribute);
            console.log('To entity attributes before:', toEntity.attributes.length);
            
            toEntity.attributes.push(fkAttribute);
            relation.to_attribute = fkPhysicalName;
            
            console.log('To entity attributes after:', toEntity.attributes.length);
            console.log('Updated to entity:', toEntity);
        }
        
        // 엔티티 매니저에 변경사항 알림
        console.log('Emitting entityUpdated event for:', toEntity.name);
        this.entityManager.emit('entityUpdated', toEntity);
        console.log('=== FK Creation Debug End ===');
    }
    
    deleteRelation(relationId) {
        const index = this.relations.findIndex(r => r.id === relationId);
        if (index !== -1) {
            this.relations.splice(index, 1);
            this.emit('relationDeleted', relationId);
        }
    }
    
    setRelations(relations) {
        this.relations = relations || [];
    }
    
    getRelations() {
        return this.relations;
    }
    
    // 관계 편집을 위한 캔버스 이벤트 처리
    setupRelationEditing() {
        this.canvas.on('relationClicked', (relationId) => {
            console.log('Relation clicked in RelationManager:', relationId);
            const relation = this.relations.find(r => r.id === relationId);
            if (relation) {
                console.log('Opening relation modal for editing:', relation);
                this.showRelationModal(relation);
            } else {
                console.error('Relation not found:', relationId);
            }
        });
        
        this.canvas.on('relationContextMenu', (data) => {
            this.showRelationContextMenu(data);
        });
    }
    
    showRelationContextMenu(data) {
        // 관계 컨텍스트 메뉴 구현 (필요시)
        if (confirm('이 관계를 삭제하시겠습니까?')) {
            this.deleteRelation(data.relationId);
        }
    }
    
    // 관계 유효성 검사
    validateRelation(fromEntityId, toEntityId) {
        const entities = this.entityManager.getEntities();
        
        if (!entities[fromEntityId] || !entities[toEntityId]) {
            return { valid: false, message: '존재하지 않는 엔티티입니다.' };
        }
        
        if (fromEntityId === toEntityId) {
            return { valid: false, message: '같은 엔티티끼리는 관계를 만들 수 없습니다.' };
        }
        
        return { valid: true };
    }
    
    // 관계에서 참조하는 엔티티가 삭제될 때 관련 관계도 삭제
    onEntityDeleted(entityId) {
        const relationsToDelete = this.relations.filter(
            relation => relation.from_entity_id === entityId || relation.to_entity_id === entityId
        );
        
        relationsToDelete.forEach(relation => {
            this.deleteRelation(relation.id);
        });
    }
    
    // Foreign Key 자동 설정 기능
    setupForeignKeys() {
        this.relations.forEach(relation => {
            if (relation.cardinality === 'OneToMany') {
                const fromEntity = this.entityManager.getEntities()[relation.from_entity_id];
                const toEntity = this.entityManager.getEntities()[relation.to_entity_id];
                
                if (fromEntity && toEntity) {
                    // From 엔티티의 Primary Key를 찾기
                    const primaryKey = fromEntity.attributes.find(attr => attr.is_primary_key);
                    
                    if (primaryKey) {
                        // To 엔티티에 Foreign Key 속성이 있는지 확인
                        const foreignKeyName = fromEntity.name.toLowerCase() + '_id';
                        const existingFK = toEntity.attributes.find(attr => 
                            attr.name === foreignKeyName && attr.is_foreign_key
                        );
                        
                        if (!existingFK) {
                            // Foreign Key 속성 자동 추가 (옵션)
                            const foreignKeyAttr = {
                                name: foreignKeyName,
                                data_type: primaryKey.data_type,
                                is_primary_key: false,
                                is_foreign_key: true,
                                is_nullable: false,
                                foreign_key_reference: `${fromEntity.name}.${primaryKey.name}`
                            };
                            
                            toEntity.attributes.push(foreignKeyAttr);
                        }
                    }
                }
            }
        });
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