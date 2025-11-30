<template>
  <div class="map-selection-page">
    <MapListSelector 
      :maps="availableMaps" 
      :selectedMap="currentSelectedMap" 
      :loading="isLoadingMaps" 
      :error="mapLoadingError"
      @map-selected="handleMapSelected" 
    />
    <MapViewer 
      :selectedMap="currentSelectedMap"
      :serverUrl="serverUrl" 
      @close="handleCloseViewer" 
    />
  </div>
</template>

<script>
import MapListSelector from './MapListSelector.vue';
import MapViewer from './MapViewer.vue';

export default {
  name: 'MapSelectionPage',
  components: {
    MapListSelector,
    MapViewer
  },
  props: { 
    serverUrl: {
      type: String,
      required: true 
    }
  },
  data() {
    return {
      availableMaps: [], 
      currentSelectedMap: null, 
      isLoadingMaps: false,
      mapLoadingError: ''
    };
  },
  methods: {
    getMapFolder(mapId) {
      const firstDigit = mapId.charAt(0);
      return `Map${firstDigit}`;
    },
    getMinimapUrl(mapId) {
      const mapFolder = this.getMapFolder(mapId);
      return `${this.serverUrl}/node/image_unparsed/Map/Map/${mapFolder}/${mapId}.img/miniMap/canvas`;
    },
    handleMapSelected(map) {
      this.currentSelectedMap = map;
    },
    handleCloseViewer() {
      // Send 'close' event to parent to switch views
      this.$emit('close'); 
      this.currentSelectedMap = null; 
    },
    async fetchMaps() {
      this.isLoadingMaps = true;
      this.mapLoadingError = '';
      try {
        const apiUrl = new URL('/string/map', this.serverUrl).href; 
        console.log('Fetching maps from:', apiUrl); 

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.availableMaps = data.map(mapData => {
          const mapId = String(mapData[0]);
          const mapName = mapData[1] || null;
          const streetName = mapData[2] || 'N/A'; // streetName 在前端显示为 region
          
          return {
            id: mapId,
            name: mapName,
            region: streetName,
            minimapUrl: this.getMinimapUrl(mapId)
          };
        });

        const defaultMapId = '103010000';
        const defaultMap = this.availableMaps.find(map => map.id === defaultMapId);
        
        if (defaultMap) {
            this.currentSelectedMap = defaultMap;
        } else if (this.availableMaps.length > 0) {
          this.currentSelectedMap = this.availableMaps[0];
        }

      } catch (e) {
        this.mapLoadingError = `Failed to load maps: ${e.message}`;
        console.error('Error fetching maps:', e);
      } finally {
        this.isLoadingMaps = false;
      }
    }
  },
  created() {
    if (this.serverUrl) {
      this.fetchMaps();
    } else {
      this.mapLoadingError = 'Server URL is not provided to MapSelectionPage.';
      console.warn('MapSelectionPage: serverUrl prop is missing.');
    }
  }
};
</script>

<style scoped>
.map-selection-page {
  display: flex;
  height: 100%;
  width: 100%; 
  border: none; 
  box-shadow: none;
  background-color: #fff;
  border-radius: 0;
  overflow: hidden; 
}
</style>