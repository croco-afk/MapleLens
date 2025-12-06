import isSubarrayKMP from './KMP.js';

// 用于临时缓存从 Rust 获取的资源信息 (Origin, Size)
const assetCache = {};

async function getAssetInfo(adapter, path, layerOrder) {
    // path 格式: "Obj/Login.img/Common/frame/0" (示例)
    // MapFactory 生成的 path: "oS.img/l0/l1/l2"
    // 需要拼接成完整的 WZ 路径
    let fullPath = "";
    if (layerOrder === 0) { // Obj
        fullPath = `Map/Obj/${path}`;
    } else { // Tile
        fullPath = `Map/Tile/${path}`;
    }

    if (assetCache[fullPath]) return assetCache[fullPath];

    // 默认值
    let info = { origin: { x: 0, y: 0 }, width: 0, height: 0, z: 0 };
    
    // 向 Rust 请求该节点的详细信息 (这里需要请求 0 号帧的 JSON)
    // Obj 路径通常指向目录，实际图片是目录下的 '0'
    // Tile 路径通常直接指向 Canvas
    // 注意：这里的路径拼接逻辑可能需要根据实际 WZ 结构微调
    let queryPath = fullPath;
    if (layerOrder === 0) { // Object usually has frames, verify if '0' exists
         queryPath = `${fullPath}/0`; 
    }

    const data = await adapter.resolveAssetNode(queryPath);
    if (data) {
        info = { 
            origin: data.origin, 
            z: data.z, 
            width: data.width, 
            height: data.height 
        };
    }
    
    assetCache[fullPath] = info;
    return info;
}

// 射线检测算法 (保持原样)
function findFirstIntersection(rayOrigin, segments) {
    const rayDirection = [0, 1];
    function raySegmentIntersection(rayOrigin, rayDirection, segmentStart, segmentEnd) {
        const [px, py] = rayOrigin;
        const [rx, ry] = rayDirection;
        const [ax, ay] = segmentStart;
        const [bx, by] = segmentEnd;
        const dx = bx - ax;
        const dy = by - ay;
        const denominator = rx * dy - ry * dx;
        if (denominator === 0) return null;
        const t = ((ax - px) * dy - (ay - py) * dx) / denominator;
        const u = ((ax - px) * ry - (ay - py) * rx) / denominator;
        if (t >= 0 && u >= 0 && u <= 1) return [px + t * rx, py + t * ry];
        return null;
    }
    let closestIntersection = null;
    let minDistance = Infinity;
    for (const segment of segments) {
        const [segmentStart, segmentEnd, id] = segment;
        const intersection = raySegmentIntersection(rayOrigin, rayDirection, segmentStart, segmentEnd);
        if (intersection) {
            const distance = Math.sqrt(Math.pow(intersection[0] - rayOrigin[0], 2) + Math.pow(intersection[1] - rayOrigin[1], 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestIntersection = [...intersection, id];
            }
        }
    }
    return closestIntersection;
}

// 核心渲染/处理函数
async function Render(map, adapter) {
    const resultJson = {
        info: {},
        mob: [],
        portal: [],
        rope: [],
        foothold: [],
        miniMap: {}
    };
    const backJson = {
        npc: [],
        back: [],
        image: [],
        info: {}
    };

    // 1. 处理 Info
    if (!map.info) map.info = {};
    resultJson.info = { ...map.info };

    // 2. 处理 Layers (Obj & Tile)
    // 并行处理以提高速度
    const layerPromises = map.layers.map(async (layer, i) => {
        const items = [...layer.objects, ...layer.tiles];
        for (const tile of items) {
            tile.layer = i;
            
            // 获取资源信息 (Origin, Z, Size)
            const extra = await getAssetInfo(adapter, tile.path, tile.layerOrder);
            
            let x = tile.x - extra.origin.x; // + extra.width / 2 (根据原逻辑调整，这里简化为左上角或中心)
            let y = tile.y - extra.origin.y; 

            // 原 mainVictoria 针对 Obj 做了特殊中心点计算，这里尽量还原
            // 原逻辑：x = tile.x - extra.origin.x + extra.width / 2
            // 但 Canvas 渲染通常只需要 x, y (top-left) 或者 x, y (pivot)
            // 这里我们计算出图片的 "Top-Left" 坐标以便前端 CSS/Canvas 渲染
            // 假设 extra.origin 是锚点
            x = tile.x - extra.origin.x;
            y = tile.y - extra.origin.y;

            if (tile.f) {
                // Flip 处理 (稍微复杂，这里暂时简化)
                 x = tile.x + extra.origin.x - extra.width;
            }

            // 构建完整的图片 URL
            let imgUrlPath = "";
            if (tile.layerOrder === 0) imgUrlPath = `Map/Obj/${tile.path}/0`;
            else imgUrlPath = `Map/Tile/${tile.path}`;
            const url = adapter.getImageUrl(imgUrlPath);

            backJson.image.push({
                x: x,
                y: y,
                z: tile.z || extra.z || 0, // Z-index
                layer: i,
                zIndex: 80 - i * 8 - tile.layerOrder - (tile.z || extra.z || 0) / 1000, // 计算后的 Z
                url: url,
                flip: !!tile.f,
                width: extra.width,
                height: extra.height,
                path: tile.path // debug usage
            });
            
            // 更新地图边界 (bounding box)
            resultJson.info.imageLeftMost = Math.min(x, resultJson.info.imageLeftMost || Infinity);
            resultJson.info.imageRightMost = Math.max(x + extra.width, resultJson.info.imageRightMost || -Infinity);
            resultJson.info.imageTopMost = Math.min(y, resultJson.info.imageTopMost || Infinity);
            resultJson.info.imageBottomMost = Math.max(y + extra.height, resultJson.info.imageBottomMost || -Infinity);
        }
    });

    await Promise.all(layerPromises);

    // 3. 处理 Footholds (物理碰撞)
    const segments = [];
    const visited = {};

    // 辅助 DFS 函数
    const dfsList = (item, back = false, firItem = false) => {
        let tmp = item;
        let list = [];
        if (firItem) list.push(firItem);
        
        const pushNode = (n) => {
            list.push({
                x1: n.x1, x2: n.x2, y1: n.y1, y2: n.y2,
                layer: parseInt(n.layer) + 1,
                id: n.id
            });
        };
        
        pushNode(tmp);
        visited[tmp.id] = true;
        const keyword = back ? "prev" : "next";
        
        while(tmp[keyword] && map.footholds[tmp[keyword]]) {
            tmp = map.footholds[tmp[keyword]];
            pushNode(tmp);
            if(visited[tmp.id]) break;
            visited[tmp.id] = true;
        }

        // 过滤点
        list = list.filter(ele => !(ele.x1 == ele.x2 && ele.y1 == ele.y2));
        
        // 更新边界
        for (const node of list) {
             resultJson.info.leftMost = Math.min(node.x1, node.x2, resultJson.info.leftMost || Infinity);
             resultJson.info.rightMost = Math.max(node.x1, node.x2, resultJson.info.rightMost || -Infinity);
             resultJson.info.bottomMost = Math.max(node.y1, node.y2, resultJson.info.bottomMost || -Infinity);
             resultJson.info.topMost = Math.min(node.y1, node.y2, resultJson.info.topMost || Infinity);
             segments.push([[node.x1, node.y1], [node.x2, node.y2], parseInt(tmp.layer) + 1]);
        }
        
        // 合并线段逻辑 (KMP 部分在原代码的后面，这里简化处理，直接输出点链)
        // 为前端方便，我们直接输出合并好的 points
        let points = [list[0].x1, list[0].y1];
        for(let i=0; i<list.length; i++) {
            points.push(list[i].x2, list[i].y2);
        }
        resultJson.foothold.push({
             layer: list[0].layer,
             points: points
        });
    };

    // 遍历 Foothold 链
    const fhKeys = Object.keys(map.footholds);
    for (const key of fhKeys) {
        const item = map.footholds[key];
        if (!visited[item.id] && item.prev == 0) dfsList(item);
    }
    // 处理剩余的环或断链
    for (const key of fhKeys) {
        const item = map.footholds[key];
        if (!visited[item.id]) dfsList(item);
    }

    // 4. 处理 NPC (射线贴地)
    for (const life of map.lifeTemplates) {
        if(life.type === 'n') { // NPC
            const rayOrigin = [life.x, life.y];
            const intersection = findFirstIntersection(rayOrigin, segments);
            if (intersection) {
                life.x = intersection[0];
                life.y = intersection[1];
                life.layer = intersection[2];
            }
            backJson.npc.push(life);
        } else if (life.type === 'm') { // Mob
            resultJson.mob.push(life);
        }
    }

    // 5. 处理 Backgrounds
    for (const bg of map.backgrounds) {
        // 获取背景图信息 (为了尺寸)
        let bgPath = `Map/Back/${bg.path}`;
        if(bg.ani) bgPath = `Map/${bg.path}/0`; // Ani back has frames
        
        const extra = await getAssetInfo(adapter, bg.path.replace('Map/',''), 0); // Reuse logic
        
        // 构造 URL
        let url = adapter.getImageUrl(bgPath);
        
        backJson.back.push({
            ...bg,
            url: url,
            width: extra.width,
            height: extra.height,
            origin: extra.origin
        });
    }

    // 6. 整合
    backJson.info = resultJson.info;

    return { resultJson, backJson };
}

export { Render };