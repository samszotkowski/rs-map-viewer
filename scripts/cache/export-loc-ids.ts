import fs from "fs";
import path from "path";

import { CacheSystem } from "../../src/rs/cache/CacheSystem";
import { getCacheLoaderFactory } from "../../src/rs/cache/loader/CacheLoaderFactory";
import { ByteBuffer } from "../../src/rs/io/ByteBuffer";
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

    const locTypeLoader = loaderFactory.getLocTypeLoader();
    const mapFileLoader = loaderFactory.getMapFileLoader();

    const lowX = 16;
    const lowY = 19;
    const highX = 65 + 1;
    const highY = 196 + 1;

    let locIds = new Set<number>();
    for (let mx = lowX; mx < highX; mx++) {
        for (let my = lowY; my < highY; my++) {
            const locData = mapFileLoader.getLocData(mx, my, cache.xteas);
            if (!locData) {
                continue;
            }

            const buffer = new ByteBuffer(locData);

            let id = -1;
            let idDelta: number;
            while ((idDelta = buffer.readSmart3()) !== 0) {
                id += idDelta;
                locIds.add(id);

                const transforms = locTypeLoader.load(id).transforms;
                if (transforms && transforms.length > 0) {
                    for (const transId of transforms) {
                        if (transId > 0) {
                            locIds.add(transId);
                        }
                    }
                }

                let pos = 0;
                let posDelta: number;
                while ((posDelta = buffer.readUnsignedSmart()) !== 0) {
                    pos += posDelta - 1;
                    buffer.readUnsignedByte();
                }
            }
        }
    }
    const sorted = Array.from(locIds).sort((a, b) => a - b);
    fs.writeFileSync(outputFile, sorted.join(","));
}
