export default class Canvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.selectedEntityId = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.eventListeners = {};
        this.draggedEntity = null; // 드래그 중인 엔티티 임시 저장
        this.scale = 1; // 확대/축소 비율
        this.minScale = 0.25;
        this.maxScale = 3;
        this.scaleStep = 0.1;
        
        this.setupEventListeners();
        this.setupCanvasSize();
    }
    
    setupCanvasSize() {
        const container = this.canvas.parentElement;
        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            this.canvas.width = Math.max(1200, rect.width);
            this.canvas.height = Math.max(800, rect.height);
            this.emit('canvasResized');
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        // 확대/축소 휠 이벤트 (Cmd/Ctrl + 스크롤)
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        
        const entityId = this.getEntityAtPosition(x, y);
        const relationId = this.getRelationAtPosition(x, y);
        
        console.log('Mouse down at:', { x, y }, 'Entity found:', entityId, 'Relation found:', relationId);
        
        if (entityId) {
            this.selectedEntityId = entityId;
            this.isDragging = true;
            
            const entity = this.entities[entityId];
            if (entity) {
                this.dragOffset = {
                    x: x - entity.x,
                    y: y - entity.y
                };
                console.log('Starting drag for entity:', entityId, 'offset:', this.dragOffset);
            }
            
            // 캔버스 커서 변경
            this.canvas.style.cursor = 'grabbing';
            
            this.emit('entitySelected', entityId);
            this.emit('dragStart', entityId);
        } else if (relationId) {
            console.log('Relation clicked:', relationId);
            this.emit('relationClicked', relationId);
        } else {
            this.selectedEntityId = null;
            this.emit('canvasClicked', { x, y });
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / this.scale;
        const mouseY = (e.clientY - rect.top) / this.scale;
        
        // 엔티티 위에서 커서 변경
        const entityId = this.getEntityAtPosition(mouseX, mouseY);
        if (entityId && !this.isDragging) {
            this.canvas.style.cursor = 'grab';
        } else if (!this.isDragging) {
            this.canvas.style.cursor = 'default';
        }
        
        // 드래그 중일 때
        if (this.isDragging && this.selectedEntityId && this.entities) {
            const x = mouseX - this.dragOffset.x;
            const y = mouseY - this.dragOffset.y;
            
            // 경계 체크 (캔버스 내부에만 이동 가능)
            const worldWidth = this.canvas.width / this.scale;
            const worldHeight = this.canvas.height / this.scale;
            const boundedX = Math.max(0, Math.min(x, worldWidth - 150));
            const boundedY = Math.max(0, Math.min(y, worldHeight - 100));
            
            // 드래그 중인 엔티티의 임시 위치 설정
            this.draggedEntity = {
                ...this.entities[this.selectedEntityId],
                x: boundedX,
                y: boundedY
            };
            
            // 드래그 중 실시간 렌더링
            this.redrawWithDraggedEntity();
            
            // entityMoved 이벤트 발생 (데이터 동기화용)
            this.emit('entityMoved', this.selectedEntityId, boundedX, boundedY);
            // 내용에 맞춰 캔버스 크기 갱신 (스크롤 확보)
            this.updateCanvasSizeToFitContent();
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging && this.selectedEntityId) {
            console.log('Drag ended for entity:', this.selectedEntityId);
            
            // 드래그된 최종 위치를 실제 엔티티에 적용
            if (this.draggedEntity && this.entities[this.selectedEntityId]) {
                this.entities[this.selectedEntityId].x = this.draggedEntity.x;
                this.entities[this.selectedEntityId].y = this.draggedEntity.y;
            }
            
            // 드래그 완료 이벤트 발생
            this.emit('dragEnd', this.selectedEntityId);
        }
        
        // 드래그 상태 리셋
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.draggedEntity = null;
        this.canvas.style.cursor = 'default';
        
        // 마우스 업 후에도 엔티티 위에 있으면 커서 변경
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / this.scale;
        const mouseY = (e.clientY - rect.top) / this.scale;
        const entityId = this.getEntityAtPosition(mouseX, mouseY);
        if (entityId) {
            this.canvas.style.cursor = 'grab';
        }
    }
    
    handleContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        
        const entityId = this.getEntityAtPosition(x, y);
        
        if (entityId) {
            this.emit('entityContextMenu', {
                entityId,
                x: e.clientX,
                y: e.clientY
            });
        }
    }
    
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        
        const entityId = this.getEntityAtPosition(x, y);
        
        if (entityId) {
            this.emit('entityDoubleClick', entityId);
        } else {
            this.emit('canvasDoubleClick', { x, y });
        }
    }

    handleWheel(e) {
        // Cmd(맥) 또는 Ctrl(윈도우) 키와 함께 사용할 때만 확대/축소
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else if (e.deltaY > 0) {
                this.zoomOut();
            }
        }
    }
    
    getEntityAtPosition(x, y) {
        if (!this.entities) return null;
        
        // 역순으로 검사 (마지막에 그려진 것이 위에 있음)
        const entityIds = Object.keys(this.entities).reverse();
        
        for (const entityId of entityIds) {
            const entity = this.entities[entityId];
            
            if (x >= entity.x && 
                x <= entity.x + entity.width &&
                y >= entity.y && 
                y <= entity.y + entity.height) {
                return entityId;
            }
        }
        
        return null;
    }
    
    getRelationAtPosition(x, y) {
        if (!this.relations || !this.entities) return null;
        
        const clickTolerance = 10; // 클릭 허용 오차 (픽셀)
        
        for (const relation of this.relations) {
            const fromEntity = this.entities[relation.from_entity_id];
            const toEntity = this.entities[relation.to_entity_id];
            
            if (!fromEntity || !toEntity) continue;
            
            // 연결점 계산
            const fromCenter = {
                x: fromEntity.x + fromEntity.width / 2,
                y: fromEntity.y + fromEntity.height / 2
            };
            
            const toCenter = {
                x: toEntity.x + toEntity.width / 2,
                y: toEntity.y + toEntity.height / 2
            };
            
            const fromPoint = this.getConnectionPoint(fromEntity, toCenter);
            const toPoint = this.getConnectionPoint(toEntity, fromCenter);
            
            // 선분과 점 사이의 거리 계산
            const distance = this.getDistanceToLine(x, y, fromPoint, toPoint);
            
            if (distance <= clickTolerance) {
                return relation.id;
            }
        }
        
        return null;
    }
    
    getDistanceToLine(px, py, lineStart, lineEnd) {
        const A = px - lineStart.x;
        const B = py - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    clear() {
        // 전체 초기화 후 현재 스케일로 변환 적용
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
        // 격자 그리기
        this.drawGrid();
    }
    
    redrawWithDraggedEntity() {
        if (!this.entities) return;
        
        // 캔버스 클리어
        this.clear();
        
        // 관계선 먼저 그리기
        if (this.relations) {
            this.relations.forEach(relation => {
                const fromEntity = relation.from_entity_id === this.selectedEntityId && this.draggedEntity 
                    ? this.draggedEntity 
                    : this.entities[relation.from_entity_id];
                    
                const toEntity = relation.to_entity_id === this.selectedEntityId && this.draggedEntity 
                    ? this.draggedEntity 
                    : this.entities[relation.to_entity_id];
                
                if (fromEntity && toEntity) {
                    this.drawRelation(fromEntity, toEntity, relation);
                }
            });
        }
        
        // 모든 엔티티 그리기 (드래그 중인 것은 새 위치와 선택 상태로)
        Object.values(this.entities).forEach(entity => {
            if (entity.id === this.selectedEntityId && this.draggedEntity) {
                // 드래그 중인 엔티티는 임시 위치로 그리기 (선택 상태 유지)
                this.drawEntity(this.draggedEntity);
            } else {
                // 다른 엔티티들은 원래 위치로 그리기
                this.drawEntity(entity);
            }
        });
    }
    
    drawGrid() {
        const gridSize = 20; // world units
        const worldWidth = this.canvas.width / this.scale;
        const worldHeight = this.canvas.height / this.scale;
        this.ctx.strokeStyle = '#f0f0f0';
        this.ctx.lineWidth = 1 / this.scale; // keep line 1px at any zoom
        
        for (let x = 0; x <= worldWidth; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, worldHeight);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= worldHeight; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(worldWidth, y);
            this.ctx.stroke();
        }
    }
    
    drawEntity(entity) {
        if (!entity || typeof entity !== 'object') {
            console.error('Invalid entity provided to drawEntity:', entity);
            return;
        }
        
        const { x, y, logical_name, attributes } = entity;
        
        console.log('Drawing entity:', logical_name, 'at position:', { x, y });
        console.log('Entity attributes count:', attributes ? attributes.length : 0);
        
        // 필수 속성 검증
        if (typeof x !== 'number' || typeof y !== 'number' || !logical_name || !Array.isArray(attributes)) {
            console.error('Entity missing required properties:', { x, y, logical_name, attributesType: typeof attributes });
            return;
        }
        
        // 엔티티 크기 계산
        this.ctx.font = '14px Arial';
        const headerHeight = 30;
        const attributeHeight = 20;
        const padding = 10;
        
        const nameWidth = this.ctx.measureText(logical_name).width + padding * 2;
        let maxAttributeWidth = nameWidth;
        
        attributes.forEach(attr => {
            // 폰트 설정 (렌더링과 동일하게)
            if (attr.is_primary_key) {
                this.ctx.font = 'bold 12px Arial';
            } else {
                this.ctx.font = '12px Arial';
            }
            
            // 아이콘과 접두사 계산 (빌드 호환성을 위해 텍스트 기호 사용)
            let prefix = '';
            if (attr.is_primary_key) {
                prefix += 'PK ';
            } else if (attr.is_foreign_key) {
                prefix += 'FK ';
            }
            if (attr.is_unique && !attr.is_primary_key) {
                prefix += 'UNIQUE ';
            }
            if (attr.is_auto_increment) {
                prefix += 'AI ';
            }
            
            // 접미사 계산 (NOT NULL 표시)
            let suffix = '';
            if (!attr.is_nullable) {
                suffix += ' *';
            }
            
            // 속성명 전체 텍스트
            const attrNameText = prefix + attr.logical_name + suffix;
            
            // 데이터 타입 텍스트 (11px 폰트로 측정)
            this.ctx.font = '11px Arial';
            let dataTypeWithLength = attr.length ? `${attr.data_type}(${attr.length})` : attr.data_type;
            
            // 기본값 포함
            if (attr.default_value) {
                dataTypeWithLength += ` = ${attr.default_value}`;
            }
            
            if (!attr.is_nullable && !attr.is_primary_key) {
                dataTypeWithLength += ' NOT NULL';
            }
            
            // 속성명과 데이터 타입의 폭 계산
            this.ctx.font = attr.is_primary_key ? 'bold 12px Arial' : '12px Arial';
            const attrNameWidth = this.ctx.measureText(attrNameText).width;
            
            this.ctx.font = '11px Arial';
            const dataTypeWidth = this.ctx.measureText(dataTypeWithLength).width;
            
            // 두 텍스트가 양쪽에 배치되므로 최소 간격 30px 추가
            const totalWidth = attrNameWidth + dataTypeWidth + padding * 2 + 30;
            maxAttributeWidth = Math.max(maxAttributeWidth, totalWidth);
        });
        
        const width = Math.max(180, maxAttributeWidth);
        const height = headerHeight + (attributes.length * attributeHeight) + padding * 1.5;
        
        // 엔티티 크기 업데이트
        entity.width = width;
        entity.height = height;
        
        // 선택된 엔티티 하이라이트
        const isSelected = this.selectedEntityId === entity.id;
        
        // 엔티티 배경
        this.ctx.fillStyle = isSelected ? '#e3f2fd' : 'white';
        this.ctx.fillRect(x, y, width, height);
        
        // 엔티티 테두리
        this.ctx.strokeStyle = isSelected ? '#2196f3' : '#333';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // 헤더 배경
        this.ctx.fillStyle = isSelected ? '#2196f3' : '#333';
        this.ctx.fillRect(x, y, width, headerHeight);
        
        // 엔티티 이름 (논리명)
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(logical_name, x + width / 2, y + headerHeight / 2 + 5);
        
        // 속성들
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        
        attributes.forEach((attr, index) => {
            const attrY = y + headerHeight + (index * attributeHeight) + 15;
            
            // 속성 표시명: 논리명 사용
            let attrText = attr.logical_name;
            let prefix = '';
            let suffix = '';
            
            if (attr.is_primary_key) {
                prefix += 'PK ';
                this.ctx.font = 'bold 12px Arial';
            } else if (attr.is_foreign_key) {
                prefix += 'FK ';
                this.ctx.font = '12px Arial';
            } else {
                this.ctx.font = '12px Arial';
            }
            
            // UNIQUE 제약 조건 표시 추가
            if (attr.is_unique && !attr.is_primary_key) {
                prefix += 'UNIQUE ';
            }
            
            // AUTO_INCREMENT 표시 추가
            if (attr.is_auto_increment) {
                prefix += 'AI '; // Auto Increment의 줄임말
            }
            
            // NOT NULL 표시 추가
            if (!attr.is_nullable) {
                suffix += ' *';
            }
            
            this.ctx.fillStyle = attr.is_primary_key ? '#d32f2f' : 
                               attr.is_foreign_key ? '#1976d2' : 
                               attr.is_auto_increment ? '#4caf50' : 
                               attr.is_unique ? '#ff9800' : '#333';
            
            this.ctx.fillText(prefix + attrText + suffix, x + 5, attrY);
            
            // 데이터 타입 (길이 포함)
            this.ctx.fillStyle = '#666';
            this.ctx.font = '11px Arial';
            let dataTypeWithLength = attr.length ? `${attr.data_type}(${attr.length})` : attr.data_type;
            
            // 기본값 추가
            if (attr.default_value) {
                dataTypeWithLength += ` = ${attr.default_value}`;
            }
            
            // NOT NULL 표시를 데이터 타입에도 추가
            if (!attr.is_nullable && !attr.is_primary_key) {
                dataTypeWithLength += ' NOT NULL';
            }
            
            const typeX = x + width - 5 - this.ctx.measureText(dataTypeWithLength).width;
            this.ctx.fillText(dataTypeWithLength, typeX, attrY);
        });
    }
    
    drawRelation(fromEntity, toEntity, relation) {
        // 연결점 계산
        const fromCenter = {
            x: fromEntity.x + fromEntity.width / 2,
            y: fromEntity.y + fromEntity.height / 2
        };
        
        const toCenter = {
            x: toEntity.x + toEntity.width / 2,
            y: toEntity.y + toEntity.height / 2
        };
        
        // 엔티티 경계에서의 연결점 계산
        const fromPoint = this.getConnectionPoint(fromEntity, toCenter);
        const toPoint = this.getConnectionPoint(toEntity, fromCenter);
        
        // 관계선 그리기
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(fromPoint.x, fromPoint.y);
        this.ctx.lineTo(toPoint.x, toPoint.y);
        this.ctx.stroke();
        
        // 카디널리티 표시
        const midPoint = {
            x: (fromPoint.x + toPoint.x) / 2,
            y: (fromPoint.y + toPoint.y) / 2
        };
        
        let cardinalityText = '';
        switch (relation.cardinality) {
            case 'OneToOne':
                cardinalityText = '1:1';
                break;
            case 'OneToMany':
                cardinalityText = '1:N';
                break;
            case 'ManyToMany':
                cardinalityText = 'N:M';
                break;
        }
        
        // 카디널리티 배경
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        const textWidth = this.ctx.measureText(cardinalityText).width + 10;
        this.ctx.fillRect(midPoint.x - textWidth/2, midPoint.y - 10, textWidth, 20);
        
        // 카디널리티 텍스트
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(cardinalityText, midPoint.x, midPoint.y + 5);
        
        // 관계 이름과 속성 정보
        let yOffset = 15;
        if (relation.name) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            const nameWidth = this.ctx.measureText(relation.name).width + 8;
            this.ctx.fillRect(midPoint.x - nameWidth/2, midPoint.y + yOffset, nameWidth, 16);
            
            this.ctx.fillStyle = '#666';
            this.ctx.font = '11px Arial';
            this.ctx.fillText(relation.name, midPoint.x, midPoint.y + yOffset + 11);
            yOffset += 20;
        }
        
        // 속성 연결 정보 표시
        if (relation.from_attribute && relation.to_attribute) {
            const attrText = `${relation.from_attribute} → ${relation.to_attribute}`;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            const attrWidth = this.ctx.measureText(attrText).width + 8;
            this.ctx.fillRect(midPoint.x - attrWidth/2, midPoint.y + yOffset, attrWidth, 16);
            
            this.ctx.fillStyle = '#0066cc';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(attrText, midPoint.x, midPoint.y + yOffset + 11);
        }
    }
    
    getConnectionPoint(entity, targetPoint) {
        const centerX = entity.x + entity.width / 2;
        const centerY = entity.y + entity.height / 2;
        
        const dx = targetPoint.x - centerX;
        const dy = targetPoint.y - centerY;
        
        const entityHalfWidth = entity.width / 2;
        const entityHalfHeight = entity.height / 2;
        
        // 어느 면에서 연결될지 결정
        const slope = dy / dx;
        const entitySlope = entityHalfHeight / entityHalfWidth;
        
        let connectionX, connectionY;
        
        if (Math.abs(slope) < entitySlope) {
            // 좌우 면에서 연결
            connectionX = dx > 0 ? entity.x + entity.width : entity.x;
            connectionY = centerY + (slope * entityHalfWidth * (dx > 0 ? 1 : -1));
        } else {
            // 상하 면에서 연결
            connectionY = dy > 0 ? entity.y + entity.height : entity.y;
            connectionX = centerX + (entityHalfHeight / slope * (dy > 0 ? 1 : -1));
        }
        
        return { x: connectionX, y: connectionY };
    }
    
    selectEntity(entityId) {
        this.selectedEntityId = entityId;
    }
    
    setEntities(entities) {
        this.entities = entities;
        this.updateCanvasSizeToFitContent();
    }
    
    setRelations(relations) {
        this.relations = relations;
        this.updateCanvasSizeToFitContent();
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

    // 확대/축소 컨트롤
    zoomIn() {
        this.setScale(this.scale + this.scaleStep);
    }
    
    zoomOut() {
        this.setScale(this.scale - this.scaleStep);
    }
    
    resetZoom() {
        this.setScale(1);
    }
    
    setScale(newScale) {
        const clamped = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        if (clamped === this.scale) return;
        this.scale = clamped;
        this.updateCanvasSizeToFitContent();
        // 확대/축소 후 재렌더링 요청
        this.emit('canvasResized');
    }
    
    updateCanvasSizeToFitContent() {
        const container = this.canvas.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const margin = 200; // 가장자리 여백 (월드 단위)
        let contentWidth = 1200;
        let contentHeight = 800;
        
        if (this.entities && Object.keys(this.entities).length > 0) {
            let maxRight = 0;
            let maxBottom = 0;
            Object.values(this.entities).forEach(entity => {
                const right = (entity.x || 0) + (entity.width || 150);
                const bottom = (entity.y || 0) + (entity.height || 100);
                if (right > maxRight) maxRight = right;
                if (bottom > maxBottom) maxBottom = bottom;
            });
            contentWidth = Math.max(contentWidth, maxRight + margin);
            contentHeight = Math.max(contentHeight, maxBottom + margin);
        }
        
        // 픽셀 크기 = 월드 크기 * 스케일 (컨테이너보다 작지 않게)
        const targetWidth = Math.max(Math.ceil(contentWidth * this.scale), Math.ceil(rect.width));
        const targetHeight = Math.max(Math.ceil(contentHeight * this.scale), Math.ceil(rect.height));
        
        if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
            this.emit('canvasResized');
        }
    }
}