import fs from "fs";
import path from "path";

import { getSceneLocs } from "../../src/mapviewer/webgl/loc/SceneLocs";
import { CacheSystem } from "../../src/rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { LocModelLoader } from "../../src/rs/config/loctype/LocModelLoader";
import { SceneBuilder } from "../../src/rs/scene/SceneBuilder";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

const cacheInfos = loadCacheInfos();
const cacheList = loadCacheList(cacheInfos);

for (const cacheInfo of cacheList.caches) {
    const cache = loadCache(cacheInfo);
    console.log(`Loaded cache: ${cacheInfo.name}`);

    const outputFile = `dumps/loc_ids/${cacheInfo.name}.txt`;
    if (!fs.existsSync(path.dirname(outputFile))) {
        fs.mkdirSync(path.dirname(outputFile));
    }

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

    let locIds = new Set<String>();
    for (let mx = lowX; mx < highX; mx++) {
        for (let my = lowY; my < highY; my++) {
            const scene = sceneBuilder.buildMapSquareLocs(mx, my);
            const sceneLocs = getSceneLocs(locTypeLoader, scene, borderSize, maxLevel);
            const locEntities = sceneLocs.locEntities;

            for (const l of locEntities) {
                locIds.add(l.entity.id.toString());
            }
        }
    }
    fs.writeFileSync(outputFile, Array.from(locIds).sort().join(","));
}
