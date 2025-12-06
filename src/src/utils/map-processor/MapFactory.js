function padLeft(str, n) {
  let result = str.toString();
  while (result.length < n) { result = '0' + result }
  return result
}

// 【核心修复】通用取值函数
// 适配你的 Rust 后端返回的 { data: ... } 结构
function getVal(node) {
  if (node === undefined || node === null) return undefined;
  
  // 1. 优先匹配 Rust 后端返回的 "data" 字段
  if (node.data !== undefined) return node.data;
  
  // 2. 兼容可能存在的 "value" 字段 (有些 WZ 解析器用这个)
  if (node.value !== undefined) return node.value;
  
  // 3. 如果都不是，假设它就是原始值
  return node;
}

class Map {
  constructor(mapId, adapter) {
    this.id = mapId;
    this.adapter = adapter;
    this.info = {};
    this.portals = [];
    this.lifeTemplates = [];
    this.footholds = {};
    this.ladderRopes = [];
    this.backgrounds = [];
    this.layers = [];
  }

  async load() {
    const mapIdStr = padLeft(this.id, 9);
    // 构造 WZ 路径
    const prefix = mapIdStr.substr(0, 1);
    const basePath = `Map/Map/Map${prefix}/${mapIdStr}.img`;

    // 尝试触发后端解析
    try {
        await fetch(`${this.adapter.getImageUrl('../parse/' + basePath)}`);
    } catch (e) { console.warn("Auto-parse trigger failed", e); }

    const mapData = await this.adapter.getJson(basePath);

    if (!mapData || !mapData.children) {
        throw new Error(`Map data not found or invalid for ID: ${this.id}`);
    }

    const children = mapData.children;

    // 解析各个部分
    if (children.info) this.parseInfo(children.info);
    if (children.portal) this.parsePortals(children.portal);
    if (children.life) this.parseLife(children.life);
    if (children.foothold) this.parseFootholds(children.foothold);
    if (children.ladderRope) this.parseLadderRope(children.ladderRope);
    if (children.back) this.parseBackgrounds(children.back);
    
    // 解析 Layers (0-7)
    for (let i = 0; i <= 7; i++) {
        if (children[i.toString()]) {
            this.layers.push(this.parseLayer(children[i.toString()], i));
        } else {
            this.layers.push({ objects: [], tiles: [] }); 
        }
    }
  }

  parseInfo(node) {
    if (!node.children) return;
    for (const [key, val] of Object.entries(node.children)) {
        this.info[key] = getVal(val);
    }
  }

  parsePortals(node) {
     if (!node.children) return;
     for (const child of Object.values(node.children)) {
         const p = {};
         const c = child.children;
         if(!c) continue;
         
         p.name = getVal(c.pn);
         p.targetMapId = getVal(c.tm);
         p.targetName = getVal(c.tn);
         p.x = getVal(c.x);
         p.y = getVal(c.y);

         this.portals.push({
             name: p.name,
             x: p.x, y: p.y,
             target: { mapId: p.targetMapId, name: p.targetName }
         });
     }
  }

  parseLife(node) {
      if (!node.children) return;
      for (const child of Object.values(node.children)) {
          const l = {};
          const c = child.children;
          if(!c) continue;
          
          l.x = getVal(c.x);
          l.y = getVal(c.y);
          l.id = getVal(c.id);
          l.type = getVal(c.type);
          l.f = getVal(c.f);
          l.hide = getVal(c.hide);
          
          this.lifeTemplates.push(l);
      }
  }

  parseFootholds(node) {
      if(!node.children) return;
      for (const [layerId, layerNode] of Object.entries(node.children)) {
          if(!layerNode.children) continue;
          for(const [groupId, groupNode] of Object.entries(layerNode.children)) {
              if(!groupNode.children) continue;
              for(const [fhId, fhNode] of Object.entries(groupNode.children)) {
                  const c = fhNode.children;
                  if(!c) continue;
                  this.footholds[fhId] = {
                      id: fhId,
                      layer: layerId,
                      group: groupId,
                      x1: getVal(c.x1), y1: getVal(c.y1),
                      x2: getVal(c.x2), y2: getVal(c.y2),
                      prev: getVal(c.prev), next: getVal(c.next),
                      piece: getVal(c.piece)
                  };
              }
          }
      }
  }

  parseLadderRope(node) {
      if(!node.children) return;
      for (const child of Object.values(node.children)) {
          const c = child.children;
          if(!c) continue;
          this.ladderRopes.push({
              x: getVal(c.x),
              y1: getVal(c.y1),
              y2: getVal(c.y2),
              IsLadder: getVal(c.l) === 1
          });
      }
  }

  parseBackgrounds(node) {
      if(!node.children) return;
      const sortedKeys = Object.keys(node.children).sort((a,b) => parseInt(a) - parseInt(b));
      for(const key of sortedKeys) {
          const child = node.children[key];
          const c = child.children;
          if(!c) continue;
          
          const bg = {
              no: getVal(c.no),
              bS: getVal(c.bS),
              x: getVal(c.x), y: getVal(c.y),
              rx: getVal(c.rx), ry: getVal(c.ry),
              cx: getVal(c.cx), cy: getVal(c.cy),
              type: getVal(c.type),
              a: getVal(c.a),
              front: getVal(c.front),
              ani: getVal(c.ani),
              f: getVal(c.f)
          };
          
          if (bg.bS === undefined || bg.no === undefined) continue;

          bg.path = `${bg.bS}.img/back/${bg.no}`;
          if(bg.ani) bg.path = `${bg.bS}.img/ani/${bg.no}`; 
          
          this.backgrounds.push(bg);
      }
  }

  parseLayer(node, layerIdx) {
      const layer = { objects: [], tiles: [] };
      
      // Parse Obj
      if(node.children.obj && node.children.obj.children) {
          const sortedKeys = Object.keys(node.children.obj.children).sort((a,b) => parseInt(a) - parseInt(b));
          for(const key of sortedKeys) {
              const c = node.children.obj.children[key].children;
              if(!c) continue;
              
              const oS = getVal(c.oS);
              const l0 = getVal(c.l0);
              const l1 = getVal(c.l1);
              const l2 = getVal(c.l2);
              
              if (oS === undefined || l0 === undefined || l1 === undefined || l2 === undefined) {
                  continue;
              }

              layer.objects.push({
                  oS, l0, l1, l2,
                  x: getVal(c.x), y: getVal(c.y),
                  z: getVal(c.z),
                  zM: getVal(c.zM), 
                  f: getVal(c.f),
                  path: `${oS}.img/${l0}/${l1}/${l2}`,
                  layerOrder: 0, 
                  visible: true 
              });
          }
      }

      // Parse Tile
      if(node.children.tile && node.children.tile.children) {
          const sortedKeys = Object.keys(node.children.tile.children).sort((a,b) => parseInt(a) - parseInt(b));
           for(const key of sortedKeys) {
              const c = node.children.tile.children[key].children;
              if(!c) continue;
              
              const u = getVal(c.u);
              const no = getVal(c.no);
              const tS = this.info.tS; 

              if (tS === undefined || u === undefined || no === undefined) {
                  continue;
              }

              layer.tiles.push({
                  x: getVal(c.x), y: getVal(c.y),
                  zM: getVal(c.zM),
                  path: `${tS}.img/${u}/${no}`,
                  layerOrder: 1, 
                  visible: true
              });
          }
      }

      return layer;
  }
}

export default class MapFactory {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async GetMap(mapId) {
    const map = new Map(mapId, this.adapter);
    await map.load();
    return map;
  }
}