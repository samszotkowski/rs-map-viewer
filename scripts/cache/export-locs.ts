import fs from "fs";

import { getSceneLocs } from "../../src/mapviewer/webgl/loc/SceneLocs";
import { CacheSystem } from "../../src/rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { LocModelLoader } from "../../src/rs/config/loctype/LocModelLoader";
import { Scene } from "../../src/rs/scene/Scene";
import { LocLoadType, SceneBuilder } from "../../src/rs/scene/SceneBuilder";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

const cacheInfos = loadCacheInfos();
const cacheList = loadCacheList(cacheInfos);
const cacheInfo = cacheList.latest;
const cache = loadCache(cacheInfo);
console.log(`Loaded cache: ${cacheInfo.name}`);

const outputFile = `dumps/${cacheInfo.name}_locs.csv`;

const cacheSystem = CacheSystem.fromFiles(cache.type, cache.files);
const loaderFactory = getCacheLoaderFactory(cacheInfo, cacheSystem);

const underlayTypeLoader = loaderFactory.getUnderlayTypeLoader();
const overlayTypeLoader = loaderFactory.getOverlayTypeLoader();
const locTypeLoader = loaderFactory.getLocTypeLoader();
const modelLoader = loaderFactory.getModelLoader();
const textureLoader = loaderFactory.getTextureLoader();
const seqTypeLoader = loaderFactory.getSeqTypeLoader();
const seqFrameLoader = loaderFactory.getSeqFrameLoader();
const skeletalSeqLoader = loaderFactory.getSkeletalSeqLoader();
const mapFileLoader = loaderFactory.getMapFileLoader();

const locModelLoader = new LocModelLoader(
    locTypeLoader,
    modelLoader,
    textureLoader,
    seqTypeLoader,
    seqFrameLoader,
    skeletalSeqLoader,
);

const sceneBuilder = new SceneBuilder(
    cache.info,
    mapFileLoader,
    underlayTypeLoader,
    overlayTypeLoader,
    locTypeLoader,
    locModelLoader,
    cache.xteas,
);

const lowX = 16;
const lowY = 19;
const highX = 65 + 1;
const highY = 196 + 1;
const maxLevel = 3;
const borderSize = 0;
const sizeX = Scene.MAP_SQUARE_SIZE;
const sizeY = Scene.MAP_SQUARE_SIZE;

let rows = ["name,id,x,y,level"];
for (let mx = lowX; mx < highX; mx++) {
    for (let my = lowY; my < highY; my++) {
        console.log(mx, my);
        const baseX = mx * Scene.MAP_SQUARE_SIZE;
        const baseY = my * Scene.MAP_SQUARE_SIZE;
        const scene = sceneBuilder.buildScene(
            baseX,
            baseY,
            sizeX,
            sizeY,
            false,
            LocLoadType.NO_MODELS,
        );
        const sceneLocs = getSceneLocs(locTypeLoader, scene, borderSize, maxLevel);

        for (let l of sceneLocs.locEntities) {
            const ent = l.entity;
            const locType = locTypeLoader.load(ent.id);

            const name = locType.name;
            const id = ent.id;
            const x = ent.tileX + baseX;
            const y = ent.tileY + baseY;
            const level = ent.level;

            rows.push(`${name},${id},${x},${y},${level}`);
        }
    }
}

fs.writeFile(outputFile, rows.join("\n"), (err) => {
    if (err) throw err;
});
