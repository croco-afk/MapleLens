import RustWzAdapter, { setBaseUrl } from './RustWzAdapter';
import MapFactory from './MapFactory';
import { Render } from './MapProcessor';

/**
 * 加载地图并返回渲染所需的数据
 * @param {string} mapId 地图ID
 * @param {string} serverUrl Rust 服务器地址 (例如 http://localhost:12258)
 */
export async function getMapRenderData(mapId, serverUrl) {
    if (serverUrl) {
        setBaseUrl(serverUrl);
    }

    const adapter = new RustWzAdapter();
    const factory = new MapFactory(adapter);

    console.log(`Loading map ${mapId}...`);
    
    try {
        // 1. 获取原始结构
        const mapObj = await factory.GetMap(mapId);
        
        // 2. 进行物理计算和图层处理
        const { resultJson, backJson } = await Render(mapObj, adapter);
        
        console.log("Map processed:", resultJson, backJson);
        
        return {
            mapLogic: resultJson, // 包含 foothold, info, portal
            mapRender: backJson   // 包含 image(obj/tile), back, npc
        };
    } catch (e) {
        console.error("Failed to process map:", e);
        throw e;
    }
}