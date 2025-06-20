import fs from "fs";
import path from "path";

import { getSceneLocs } from "../../src/mapviewer/webgl/loc/SceneLocs";
import { CacheSystem } from "../../src/rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { LocModelLoader } from "../../src/rs/config/loctype/LocModelLoader";
import { Scene } from "../../src/rs/scene/Scene";
import { SceneBuilder } from "../../src/rs/scene/SceneBuilder";
import { loadCache, loadCacheInfos, loadCacheList } from "./load-util";

const cacheInfos = loadCacheInfos();
const cacheList = loadCacheList(cacheInfos);

for (const cacheInfo of cacheList.caches) {
    const cache = loadCache(cacheInfo);
    console.log(`Loaded cache: ${cacheInfo.name}`);

    const outputFile = `dumps/loc_locations/${cacheInfo.name}.csv`;
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

    let rows = ["name,id,x,y,level,parent"];
    for (let mx = lowX; mx < highX; mx++) {
        for (let my = lowY; my < highY; my++) {
            const baseX = mx * Scene.MAP_SQUARE_SIZE;
            const baseY = my * Scene.MAP_SQUARE_SIZE;

            const scene = sceneBuilder.buildMapSquareLocs(mx, my);
            const sceneLocs = getSceneLocs(locTypeLoader, scene, borderSize, maxLevel);
            const locEntities = sceneLocs.locEntities;

            for (const l of locEntities) {
                const ent = l.entity;
                const locType = locTypeLoader.load(ent.id);

                const name = locType.name;
                const id = ent.id;
                const x = ent.tileX + baseX;
                const y = ent.tileY + baseY;
                const level = ent.level;

                rows.push(`${name},${id},${x},${y},${level},-1`);

                const transforms = locType.transforms;
                if (transforms && transforms.length > 0) {
                    let transIds = new Set<number>();

                    for (const transId of transforms) {
                        if (transId > 0) {
                            transIds.add(transId);
                        }
                    }

                    for (const transId of transIds) {
                        const transName = locTypeLoader.load(transId).name;
                        rows.push(`${transName},${transId},${x},${y},${level},${id}`);
                    }
                }
            }
        }
    }
    fs.writeFileSync(outputFile, rows.join("\n"));
}
