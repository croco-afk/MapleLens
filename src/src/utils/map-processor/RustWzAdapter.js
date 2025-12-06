import { invoke } from '@tauri-apps/api/core';

// 假设你的 Rust 后端提供了一个获取端口的命令，或者你硬编码它
// 这里的端口 12258 应该与 main.rs 中的端口一致，或者通过 invoke('get_server_url') 动态获取
let BASE_URL = 'http://localhost:12258';

export const setBaseUrl = (url) => {
    BASE_URL = url;
};

/**
 * 适配器：负责从 Rust 后端获取数据，
 * 并将其格式化为旧代码习惯的 "Node/Property" 结构
 */
export default class RustWzAdapter {
    constructor() {}

    // 获取节点的 JSON 数据
    async getJson(path) {
        // 使用 simple=false 以获取完整的属性（如 origin, z, width, height）
        try {
            const res = await fetch(`${BASE_URL}/node/json/${path}?simple=false`);
            if (!res.ok) throw new Error(`Fetch failed: ${path}`);
            return await res.json();
        } catch (error) {
            console.error(`Error resolving path: ${path}`, error);
            return null;
        }
    }

    // 获取节点的图片 URL
    getImageUrl(path) {
        return `${BASE_URL}/node/image/${path}`;
    }

    // 辅助：解析 Origin (Vector2D)
    parseVector(node) {
        if (!node) return { x: 0, y: 0 };
        // Rust 返回的 Vector2D 通常是 { type: "vector", value: { x: 1, y: 1 } }
        // 或者简单的 { x: 1, y: 1 } 取决于你的 json.rs 实现
        // 这里假设是基于 wz_reader 默认的 to_json 输出
        if (node.value && typeof node.value.x === 'number') return node.value;
        if (typeof node.x === 'number') return node;
        return { x: 0, y: 0 };
    }

    // 获取单个 Obj 或 Tile 的详细信息 (Origin, Z, etc.)
    // 这是一个较重的操作，用来替代原项目中的 huge mapData.json
    async resolveAssetNode(fullPath) {
        const json = await this.getJson(fullPath);
        if (!json) return null;

        // 提取关键渲染信息
        // 注意：结构取决于你的 Rust 后端返回的 JSON 格式
        // 这里做一些防御性编程
        let origin = { x: 0, y: 0 };
        let z = 0;
        let width = 0;
        let height = 0;
        
        // 尝试查找 origin 节点
        if (json.children) {
            if (json.children.origin) origin = this.parseVector(json.children.origin);
            if (json.children.z) z = parseInt(json.children.z.value || json.children.z) || 0;
        }
        
        // 如果是 Canvas，通常有 width/height
        if (json.value && json.value.width) {
            width = json.value.width;
            height = json.value.height;
        }

        return {
            origin,
            z,
            width,
            height,
            raw: json // 保留原始数据以备不时之需
        };
    }
}