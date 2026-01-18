/**
 * TurboVoicer - Sistema de Cache Inteligente de Áudio
 * Baseado no resource-cache.js do TurboTTS
 * 
 * Cacheia áudios gerados (Edge TTS + RVC) para evitar reprocessamento
 * 
 * Regras de Ouro:
 * - Cache por hash de configuração (voz, pitch, rate, texto)
 * - Limpeza automática de cache antigo (> 7 dias)
 * - Validação de arquivos antes de retornar
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

// Diretório de cache
const CACHE_DIR = path.join(app.getPath('userData'), 'turbovoicer', 'audio_cache');
const CACHE_METADATA = path.join(CACHE_DIR, 'metadata.json');

// Versão do cache (atualizar a cada release para invalidar cache antigo)
const CACHE_VERSION = '2.0.4';

// ⚠️ IMPORTANTE: Previews NÃO têm validade por tempo!
// São cache inteligente de economia de tokens/tempo, não lixo.
// Limpeza apenas manual (usuário) ou por tamanho (500 MB).
// const CACHE_VALIDITY = 7 * 24 * 60 * 60 * 1000; // ❌ REMOVIDO

// Tamanho máximo do cache (500 MB)
const MAX_CACHE_SIZE = 500 * 1024 * 1024;

/**
 * Inicializar diretório de cache
 */
async function initializeCache() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        console.log('[AudioCache] Diretório de cache inicializado:', CACHE_DIR);
        
        // ✅ REMOVIDO: Limpeza automática por idade
        // Previews são cache inteligente de economia, não lixo
        // await cleanOldCache();
        
        return true;
    } catch (error) {
        console.error('[AudioCache] Erro ao criar diretório de cache:', error);
        return false;
    }
}

/**
 * Gerar hash único para configuração de áudio
 * Hash baseado em: texto + voz Edge + pitch + rate + voz RVC
 */
function generateCacheKey(config) {
    const {
        text,
        edgeVoice,
        edgePitch = 0,
        rate = 1.0,
        rvcVoice = null,
        rvcPitch = 0
    } = config;
    
    // Normalizar texto (remover espaços extras, quebras de linha)
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    
    // Criar string única
    const keyString = `${normalizedText}|${edgeVoice}|${edgePitch}|${rate}|${rvcVoice || 'none'}|${rvcPitch}`;
    
    // Gerar hash MD5
    const hash = crypto.createHash('md5').update(keyString).digest('hex');
    
    return hash;
}

/**
 * Obter caminho do arquivo de cache
 */
function getCacheFilePath(cacheKey, type = 'processed') {
    const filename = `${type}_${cacheKey}.mp3`;
    return path.join(CACHE_DIR, filename);
}

/**
 * Verificar se áudio existe no cache
 */
async function getCachedAudio(config) {
    try {
        const cacheKey = generateCacheKey(config);
        const type = config.rvcVoice ? 'processed' : 'natural';
        const filePath = getCacheFilePath(cacheKey, type);
        
        // Verificar se arquivo existe
        try {
            await fs.access(filePath);
        } catch {
            console.log('[AudioCache] Cache miss:', cacheKey);
            return null;
        }
        
        // ✅ Previews NÃO expiram por tempo!
        // São cache inteligente de economia de tokens/tempo
        const stats = await fs.stat(filePath);
        
        // Removido: Validação por idade (CACHE_VALIDITY)
        // Previews permanecem até limpeza manual ou limite de tamanho
        
        console.log('[AudioCache] Cache hit:', cacheKey, `(${(stats.size / 1024).toFixed(2)} KB)`);
        
        // Atualizar metadata de acesso
        await updateAccessMetadata(cacheKey, filePath, stats.size);
        
        return {
            exists: true,
            path: filePath,
            size: stats.size,
            cacheKey: cacheKey
        };
        
    } catch (error) {
        console.error('[AudioCache] Erro ao verificar cache:', error);
        return null;
    }
}

/**
 * Salvar áudio no cache
 */
async function saveAudioToCache(config, sourcePath) {
    try {
        const cacheKey = generateCacheKey(config);
        const type = config.rvcVoice ? 'processed' : 'natural';
        const destPath = getCacheFilePath(cacheKey, type);
        
        // Copiar arquivo para cache
        await fs.copyFile(sourcePath, destPath);
        
        const stats = await fs.stat(destPath);
        
        console.log('[AudioCache] Áudio salvo no cache:', cacheKey, `(${(stats.size / 1024).toFixed(2)} KB)`);
        
        // Atualizar metadata
        await updateCacheMetadata(cacheKey, {
            type,
            size: stats.size,
            config: {
                edgeVoice: config.edgeVoice,
                rvcVoice: config.rvcVoice,
                textLength: config.text.length
            }
        });
        
        // Verificar tamanho total do cache
        await checkCacheSize();
        
        return {
            success: true,
            path: destPath,
            cacheKey: cacheKey
        };
        
    } catch (error) {
        console.error('[AudioCache] Erro ao salvar no cache:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Atualizar metadata do cache
 */
async function updateCacheMetadata(cacheKey, data) {
    try {
        let metadata = await getCacheMetadata();
        
        // Adicionar versão do cache
        metadata.version = CACHE_VERSION;
        metadata.appVersion = app.getVersion();
        metadata.lastUpdate = Date.now();
        
        // Adicionar/atualizar entrada
        if (!metadata.entries) {
            metadata.entries = {};
        }
        
        metadata.entries[cacheKey] = {
            ...data,
            created: Date.now(),
            lastAccess: Date.now(),
            accessCount: 1
        };
        
        await fs.writeFile(CACHE_METADATA, JSON.stringify(metadata, null, 2));
        
    } catch (error) {
        console.error('[AudioCache] Erro ao atualizar metadata:', error);
    }
}

/**
 * Atualizar metadata de acesso
 */
async function updateAccessMetadata(cacheKey, filePath, size) {
    try {
        let metadata = await getCacheMetadata();
        
        if (!metadata.entries) {
            metadata.entries = {};
        }
        
        if (metadata.entries[cacheKey]) {
            metadata.entries[cacheKey].lastAccess = Date.now();
            metadata.entries[cacheKey].accessCount = (metadata.entries[cacheKey].accessCount || 0) + 1;
        } else {
            // Criar entrada se não existir
            metadata.entries[cacheKey] = {
                size,
                created: Date.now(),
                lastAccess: Date.now(),
                accessCount: 1
            };
        }
        
        await fs.writeFile(CACHE_METADATA, JSON.stringify(metadata, null, 2));
        
    } catch (error) {
        console.error('[AudioCache] Erro ao atualizar acesso:', error);
    }
}

/**
 * Obter metadata do cache
 */
async function getCacheMetadata() {
    try {
        const data = await fs.readFile(CACHE_METADATA, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Retornar objeto vazio se não existir
        return {
            version: CACHE_VERSION,
            entries: {}
        };
    }
}

/**
 * ❌ FUNÇÃO DESABILITADA - Previews NÃO expiram por tempo
 * 
 * Previews são cache inteligente de economia de tokens/tempo, não lixo.
 * Limpeza apenas:
 * 1. Manual (botão do usuário)
 * 2. Por tamanho (se ultrapassar MAX_CACHE_SIZE)
 */
async function cleanOldCache() {
    // ✅ DESABILITADO: Não limpar por idade
    console.log('[AudioCache] Limpeza automática por idade DESABILITADA (previews são cache inteligente)');
    return;
    
    // Código original comentado para referência:
    /*
    const files = await fs.readdir(CACHE_DIR);
    let cleaned = 0;
    let freedSpace = 0;
    
    for (const file of files) {
        if (file === 'metadata.json') continue;
        
        const filePath = path.join(CACHE_DIR, file);
        const stats = await fs.stat(filePath);
        const age = Date.now() - stats.mtimeMs;
        
        if (age > CACHE_VALIDITY) {
            await fs.unlink(filePath);
            cleaned++;
            freedSpace += stats.size;
        }
    }
    */
}

/**
 * Verificar tamanho total do cache e limpar se necessário
 */
async function checkCacheSize() {
    try {
        const files = await fs.readdir(CACHE_DIR);
        let totalSize = 0;
        const fileStats = [];
        
        for (const file of files) {
            if (file === 'metadata.json') {
                continue;
            }
            
            const filePath = path.join(CACHE_DIR, file);
            
            try {
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
                fileStats.push({
                    path: filePath,
                    size: stats.size,
                    mtime: stats.mtimeMs
                });
            } catch (error) {
                // Ignorar erros
            }
        }
        
        console.log(`[AudioCache] Tamanho total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Se exceder limite, remover arquivos mais antigos
        if (totalSize > MAX_CACHE_SIZE) {
            console.log('[AudioCache] Limite de cache excedido, removendo arquivos antigos...');
            
            // Ordenar por data de modificação (mais antigos primeiro)
            fileStats.sort((a, b) => a.mtime - b.mtime);
            
            let removed = 0;
            let freedSpace = 0;
            
            // Remover até ficar abaixo de 80% do limite
            const targetSize = MAX_CACHE_SIZE * 0.8;
            
            for (const file of fileStats) {
                if (totalSize <= targetSize) {
                    break;
                }
                
                try {
                    await fs.unlink(file.path);
                    totalSize -= file.size;
                    freedSpace += file.size;
                    removed++;
                } catch (error) {
                    console.error('[AudioCache] Erro ao remover arquivo:', error);
                }
            }
            
            console.log(`[AudioCache] ${removed} arquivo(s) removidos, ${(freedSpace / 1024 / 1024).toFixed(2)} MB liberados`);
        }
        
    } catch (error) {
        console.error('[AudioCache] Erro ao verificar tamanho do cache:', error);
    }
}

/**
 * Limpar todo o cache
 */
async function clearAllCache() {
    console.log('[AudioCache] Limpando todo o cache...');
    
    try {
        const files = await fs.readdir(CACHE_DIR);
        let removed = 0;
        let freedSpace = 0;
        
        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            
            try {
                const stats = await fs.stat(filePath);
                await fs.unlink(filePath);
                removed++;
                freedSpace += stats.size;
            } catch (error) {
                console.log(`[AudioCache] Não foi possível remover ${file}:`, error.message);
            }
        }
        
        console.log(`[AudioCache] ${removed} arquivo(s) removidos, ${(freedSpace / 1024 / 1024).toFixed(2)} MB liberados`);
        
        return {
            success: true,
            removed,
            freedSpace
        };
        
    } catch (error) {
        console.error('[AudioCache] Erro ao limpar cache:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Obter estatísticas do cache
 */
async function getCacheStats() {
    try {
        const files = await fs.readdir(CACHE_DIR);
        let totalSize = 0;
        let count = 0;
        
        for (const file of files) {
            if (file === 'metadata.json') {
                continue;
            }
            
            const filePath = path.join(CACHE_DIR, file);
            
            try {
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
                count++;
            } catch (error) {
                // Ignorar erros
            }
        }
        
        const metadata = await getCacheMetadata();
        
        return {
            count,
            totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            maxSizeMB: (MAX_CACHE_SIZE / 1024 / 1024).toFixed(2),
            usagePercent: ((totalSize / MAX_CACHE_SIZE) * 100).toFixed(1),
            version: metadata.version || 'unknown',
            entries: Object.keys(metadata.entries || {}).length
        };
        
    } catch (error) {
        console.error('[AudioCache] Erro ao obter estatísticas:', error);
        return null;
    }
}

module.exports = {
    initializeCache,
    generateCacheKey,
    getCachedAudio,
    saveAudioToCache,
    cleanOldCache,
    clearAllCache,
    getCacheStats
};
