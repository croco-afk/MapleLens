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

          <div class="minimap-preview-wrapper">
            <button 
              class="btn-render-map" 
              :disabled="!selectedMap.id"
              @click="isMapRendered = true"
            >
              {{ $t('mapViewer.renderMapBtn') }}
            </button>
            
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
    };
  },
  watch: {
    selectedMap() {
      this.imageLoadError = false;
      this.isMapRendered = false;
    }
  },
  methods: {
    handleImageError() {
      console.error('Failed to load minimap image for map:', this.selectedMap?.id);
      this.imageLoadError = true;
    },
    async copyToClipboard(text) {
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(String(text));
          alert('Copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy: ', err);
          alert('Failed to copy to clipboard.');
        }
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = String(text);
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          alert('Copied to clipboard!');
        } catch (err) {
          console.error('Fallback: Failed to copy: ', err);
          alert('Fallback: Failed to copy to clipboard.');
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

/* 【关键修复 2】中间层容器开启 Flex，占据剩余空间 */
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
.btn-render-map {
  padding: 8px 15px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background-color: #007bff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-render-map:hover:not(:disabled) {
  background-color: #0056b3;
}
.btn-render-map:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

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