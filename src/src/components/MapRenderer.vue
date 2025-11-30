<template>
  <div class="pixi-container" ref="containerRef" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRaw, nextTick } from 'vue';
import { Application } from 'pixi.js';
import { ZoomContainer } from '../renderer/ZoomContainer';
import { MapleMap } from '../renderer/map/map';
import { CharacterLoader } from '../renderer/character/loader';
import { $apiHost, $isInitialized } from '../store/const';

const props = defineProps<{
  mapId: string;
  serverUrl: string;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

let app: Application | null = null;
let viewport: ZoomContainer | null = null;
let currentMap: MapleMap | null = null;
let resizeObserver: ResizeObserver | null = null;

const BG_COLOR_NORMAL = '#ffffff'; // Normal white background
const BG_COLOR_EMPTY = '#e0e0e0';  // Abnormal gray background when no map

const initPixi = async () => {
  if (!containerRef.value) return;

  $apiHost.set(props.serverUrl);

  if (!$isInitialized.get()) {
     await CharacterLoader.init();
     $isInitialized.set(true);
  }

  const { clientWidth, clientHeight } = containerRef.value;

  app = new Application();
  
  await app.init({
    background: BG_COLOR_NORMAL, 
    width: clientWidth || 800,
    height: clientHeight || 600,
    preference: 'webgl',
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  app.canvas.style.display = 'block';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';

  containerRef.value.appendChild(app.canvas);

  viewport = new ZoomContainer(app, {
    width: app.screen.width,
    height: app.screen.height,
    worldScale: 1,
  });

  app.stage.addChild(viewport);

  resizeObserver = new ResizeObserver((entries) => {
    if (!app || !app.renderer || !viewport) return;
    const entry = entries[0];
    const { width, height } = entry.contentRect;
    if (width <= 0 || height <= 0) return;

    app.renderer.resize(width, height);
    viewport.resizeScreen(width, height);

    if (currentMap) {
        applyMapBoundaries(currentMap);
    }
  });
  
  resizeObserver.observe(containerRef.value);
};

const applyMapBoundaries = (map: MapleMap) => {
    const rawViewport = toRaw(viewport);
    if (!rawViewport) return;

    rawViewport.clamp({
        top: map.edge.y,
        bottom: map.edge.bottom,
        left: map.edge.x,
        right: map.edge.right,
    });
}

const loadMap = async (id: string) => {
  const rawApp = toRaw(app);
  const rawViewport = toRaw(viewport);

  if (!rawApp || !rawViewport || !id) return;

  rawApp.renderer.background.color = BG_COLOR_EMPTY;

  if (currentMap) {
    currentMap.destroy();
    currentMap = null;
    rawViewport.removeChildren();
  }

  try {
    rawViewport.hasMap = true;

    const map = new MapleMap(id, rawApp.renderer, rawViewport);
    await map.load();

    if (!map.wz) {
        throw new Error(`Map data not found for ID: ${id}`);
    }

    rawApp.renderer.background.color = BG_COLOR_NORMAL;
    
    rawViewport.worldWidth = map.edge.width;
    rawViewport.worldHeight = map.edge.height;

    applyMapBoundaries(map);

    const centerX = map.edge.x + map.edge.width / 2;
    const centerY = map.edge.y + map.edge.height / 2;
    rawViewport.moveCenter(centerX, centerY);

    rawViewport.addChild(map);
    currentMap = map;

  } catch (e: any) {
    console.error("Error rendering map:", e);
    
    rawApp.renderer.background.color = BG_COLOR_EMPTY;
  }
};

onMounted(async () => {
  await nextTick();
  await initPixi();
  if (props.mapId) {
    await loadMap(props.mapId);
  } else {
      if (app) app.renderer.background.color = BG_COLOR_EMPTY;
  }
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (currentMap) currentMap.destroy();
  if (app) app.destroy(true, { children: true });
});

watch(() => props.mapId, (newId) => {
  if (newId) {
      loadMap(newId);
  } else {
      if (currentMap) {
          currentMap.destroy();
          currentMap = null;
      }
      if (app) app.renderer.background.color = BG_COLOR_EMPTY;
  }
});
</script>

<style scoped>
.pixi-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #e0e0e0;
  display: block;
  position: relative;
}
</style>