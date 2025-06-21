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

    const outputFile = `dumps/loc_locations/${cacheInfo.name}.csv`;
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
    const mapSquareSize = 64;

    let data = new Array();
    for (let mx = lowX; mx < highX; mx++) {
        for (let my = lowY; my < highY; my++) {
            const locData = mapFileLoader.getLocData(mx, my, cache.xteas);
            if (!locData) {
                continue;
            }

            const baseX = mx * mapSquareSize;
            const baseY = my * mapSquareSize;

            const buffer = new ByteBuffer(locData);

            let id = -1;
            let idDelta: number;
            while ((idDelta = buffer.readSmart3()) !== 0) {
                id += idDelta;

                let pos = 0;
                let posDelta: number;
                while ((posDelta = buffer.readUnsignedSmart()) !== 0) {
                    pos += posDelta - 1;

                    const localX = (pos >> 6) & 0x3f;
                    const localY = pos & 0x3f;
                    const x = localX + baseX;
                    const y = localY + baseY;
                    const level = pos >> 12;

                    const locType = locTypeLoader.load(id);
                    const name = locType.name;

                    data.push([name, id, x, y, level, -1]);

                    const transforms = locType.transforms;
                    let transIds = new Set<number>();
                    if (transforms && transforms.length > 0) {
                        for (const transId of transforms) {
                            if (transId > 0 && !transIds.has(transId)) {
                                const transName = locTypeLoader.load(transId).name;
                                data.push([transName, transId, x, y, level, id]);
                                transIds.add(transId);
                            }
                        }
                    }

                    buffer.readUnsignedByte();
                }
            }
        }
    }

    data = data.sort(function (a, b) {
        const [id_a, x_a, y_a, level_a] = a.slice(1, 5);
        const [id_b, x_b, y_b, level_b] = b.slice(1, 5);
        if (id_a == id_b) {
            if (x_a == x_b) {
                if (y_a == y_b) {
                    return level_a - level_b;
                }
                return y_a - y_b;
            }
            return x_a - x_b;
        }
        return id_a - id_b;
    });
    data.unshift(["name", "id", "x", "y", "level", "parentId"]);

    let outData = new Array();
    for (let row of data) {
        outData.push(row.join(","));
    }
    fs.writeFileSync(outputFile, outData.join("\n"));
    break;
}
