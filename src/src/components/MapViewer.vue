<template>
  <div class="map-viewer">
    <button class="close-button" @click="$emit('close')">×</button>
    <div class="minimap-preview-section">
      <h3>{{ $t('mapViewer.mapPreviewTitle') }}</h3>
      
      <div v-if="selectedMap" class="main-content-wrapper">
        
        <!-- --------------------------- Real time render --------------------------- -->
        <div v-if="isMapRendered" class="map-render-area">
          <MapRenderer 
            :mapId="selectedMap.id" 
            :serverUrl="serverUrl"
          />
        </div>
        
        <!-- --------------------------- Info preview --------------------------- -->
        <div v-else class="minimap-content">
          <!-- 1. Map info -->
          <div class="map-details">
            <p>
              <strong>{{ $t('mapViewer.mapRegionLabel') }}</strong> {{ selectedMap.region }} 
              <span class="copy-icon" @click="copyToClipboard(selectedMap.region)">📋</span>
            </p>
            <p>
              <strong>{{ $t('mapViewer.mapNameLabel') }}</strong> {{ selectedMap.name }} 
              <span class="copy-icon" @click="copyToClipboard(selectedMap.name)">📋</span>
            </p>
            <p>
              <strong>{{ $t('mapViewer.mapIdLabel') }}</strong> {{ selectedMap.id }} 
              <span class="copy-icon" @click="copyToClipboard(selectedMap.id)">📋</span>
            </p>
          </div>

          <!-- Actions Toolbar -->
          <div class="minimap-preview-wrapper">
            <div class="action-buttons">
              <button 
                class="btn-primary" 
                :disabled="!selectedMap.id"
                @click="isMapRendered = true"
              >
                {{ $t('mapViewer.renderMapBtn') }}
              </button>

              <button 
                class="btn-secondary" 
                :disabled="!selectedMap.id || isExporting"
                @click="handleExportMap"
              >
                {{ isExporting ? 'Exporting...' : 'Export JSON' }}
              </button>
            </div>
            
            <!-- Export Status Message -->
            <div v-if="exportStatus" :class="['status-msg', exportStatusType]">
              {{ exportStatus }}
            </div>

            <!-- Minimap Image -->
            <template v-if="selectedMap.minimapUrl && !imageLoadError">
              <img 
                :src="selectedMap.minimapUrl" 
                :alt="selectedMap.name || 'Minimap Preview'" 
                class="minimap-image"
                @error="handleImageError"
              >
            </template>
            <div v-else class="no-minimap-placeholder">
              {{ $t(imageLoadError ? 'mapViewer.minimapLoadFailed' : 'mapViewer.noMinimapAvailable') }}
            </div>
          </div>
        </div>

      </div>
      <div v-else class="no-map-selected">
        <p>{{ $t('mapViewer.noMapSelected') }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import MapRenderer from './MapRenderer.vue';
import { getMapRenderData } from '@/utils/map-processor';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';

export default {
  name: 'MapViewer',
  components: {
      MapRenderer
  },
  props: {
    selectedMap: {
      type: Object,
      default: null
    },
    serverUrl: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      imageLoadError: false,
      isMapRendered: false,
      
      // --- 新增状态 ---
      isExporting: false,
      exportStatus: '',
      exportStatusType: '' // 'success' | 'error'
    };
  },
  watch: {
    selectedMap() {
      this.imageLoadError = false;
      this.isMapRendered = false;
      this.exportStatus = ''; // 切换地图时清除状态
    }
  },
  methods: {
    handleImageError() {
      console.error('Failed to load minimap image for map:', this.selectedMap?.id);
      this.imageLoadError = true;
    },
    

    async handleExportMap() {
      if (!this.selectedMap || this.isExporting) return;

      this.isExporting = true;
      this.exportStatus = 'Processing...';
      this.exportStatusType = '';

      try {
        // 1. 选择保存目录
        const selectedDirPath = await open({
          directory: true,
          multiple: false,
          title: 'Select Directory to Save Map JSONs'
        });

        if (!selectedDirPath) {
          this.exportStatus = '';
          this.isExporting = false;
          return;
        }

        const mapId = this.selectedMap.id;

        // 2. 获取数据
        // 直接使用 props 里的 serverUrl
        const data = await getMapRenderData(mapId, this.serverUrl);
        
        // 3. 准备路径
        const logicFileName = `MapLogic-${mapId}.json`;
        const renderFileName = `MapRender-${mapId}.json`;
        
        const logicPath = await join(selectedDirPath, logicFileName);
        const renderPath = await join(selectedDirPath, renderFileName);

        // 4. 写入文件
        await writeTextFile(logicPath, JSON.stringify(data.mapLogic, null, 2));
        await writeTextFile(renderPath, JSON.stringify(data.mapRender, null, 2));

        this.exportStatus = 'Export Successful!';
        this.exportStatusType = 'success';
        
        // 3秒后清除成功消息
        setTimeout(() => {
          if (this.exportStatusType === 'success') {
            this.exportStatus = '';
          }
        }, 3000);

      } catch (err) {
        console.error('Export failed:', err);
        this.exportStatus = `Error: ${err.message || err}`;
        this.exportStatusType = 'error';
      } finally {
        this.isExporting = false;
      }
    },

    async copyToClipboard(text) {
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(String(text));
          // alert('Copied to clipboard!'); // 可选：去掉弹窗，体验更好
        } catch (err) {
          console.error('Failed to copy: ', err);
        }
      } else {
        // Fallback implementation
        const textArea = document.createElement("textarea");
        textArea.value = String(text);
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback: Failed to copy: ', err);
        }
        document.body.removeChild(textArea);
      }
    }
  }
};
</script>

<style scoped>
.map-viewer {
  flex-grow: 1; 
  padding: 15px;
  position: relative;
  background-color: #fff;
  display: flex;          
  flex-direction: column; 
  height: 100%;           
  box-sizing: border-box; 
}

.minimap-preview-section {
  display: flex;          
  flex-direction: column; 
  flex: 1;                
  min-height: 0;          
}

.minimap-preview-section h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
  color: #333;
  flex-shrink: 0; 
}

.main-content-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;        
  min-height: 0; 
}

.map-render-area {
  flex: 1;            
  width: 100%;         
  position: relative;  
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
  background: #000;    
}

.minimap-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto; 
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  color: #666;
  padding: 5px;
  line-height: 1;
  z-index: 10;
}

.close-button:hover {
  color: #333;
}

.minimap-preview-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}


.action-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 5px;
}


button {
  padding: 8px 15px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: white;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
}
.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #28a745;
}
.btn-secondary:hover:not(:disabled) {
  background-color: #218838;
}

/* 状态消息样式 */
.status-msg {
  font-size: 12px;
  margin-bottom: 5px;
}
.status-msg.success { color: green; }
.status-msg.error { color: red; }


.no-minimap-placeholder {
  text-align: center;
  padding: 50px 20px;
  background-color: #f0f0f0;
  color: #888;
  border: 1px dashed #ccc;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 0.9em;
  width: 100%;
}

.minimap-image {
  max-width: 100%; 
  max-height: 300px;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: block;
}

.map-details p {
  margin: 5px 0;
  display: flex;
  align-items: center;
  font-size: 0.95em;
  color: #444;
}

.map-details strong {
  margin-right: 8px;
  min-width: 90px; 
  color: #222;
}

.copy-icon {
  cursor: pointer;
  margin-left: 8px;
  font-size: 0.9em; 
  user-select: none; 
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.copy-icon:hover {
  opacity: 1;
  color: #007bff;
}

.no-map-selected {
  text-align: center;
  color: #999;
  padding: 20px;
  border: 1px dashed #ccc;
  border-radius: 4px;
  margin-top: 20px;
}
</style>