/**
 * Preview Manager - TurboVoicer
 * Gerencia preview de voz com Edge TTS + RVC
 * Sistema de cache inteligente baseado em hash
 */

class PreviewManager {
    constructor() {
        this.previewText = "Olá, essa é minha voz. Eu espero que você goste do resultado.";
        this.currentPreview = null;
        this.cacheEnabled = true;
        
        // Limpar cache inválido na inicialização
        this.cleanInvalidCache();
        
        this.initializeUI();
    }

    /**
     * Inicializar UI e event listeners
     */
    initializeUI() {
        const btnPreviewNatural = document.getElementById('tv-btn-preview-natural');
        const btnPreviewProcessed = document.getElementById('tv-btn-preview-processed');
        const btnClearCache = document.getElementById('tv-btn-clear-cache');
        
        btnPreviewNatural?.addEventListener('click', () => this.generatePreviewNatural());
        btnPreviewProcessed?.addEventListener('click', () => this.generatePreviewProcessed());
        btnClearCache?.addEventListener('click', () => this.clearCache());
        
        // Atualizar valores dos sliders em tempo real
        this.setupSliderListeners();
        
        // Verificar cache ao carregar
        this.checkCacheStatus();
    }

    /**
     * Configurar listeners para os sliders
     */
    setupSliderListeners() {
        const pitchSlider = document.getElementById('tv-pitch-slider');
        const rateSlider = document.getElementById('tv-rate-slider');
        const voiceRadios = document.querySelectorAll('input[name="azure-voice"]');
        const rvcSelect = document.getElementById('tv-rvc-voice');
        
        // Atualizar valor do pitch e reabilitar botões
        pitchSlider?.addEventListener('input', (e) => {
            document.getElementById('tv-pitch-value').textContent = `${e.target.value} st`;
            this.enablePreviewButtons(); // Reabilitar botões quando pitch mudar
        });
        
        // Atualizar valor da velocidade e reabilitar botões
        rateSlider?.addEventListener('input', (e) => {
            document.getElementById('tv-rate-value').textContent = `${e.target.value}x`;
            this.enablePreviewButtons(); // Reabilitar botões quando rate mudar
        });
        
        // Reabilitar botões quando voz Edge mudar
        voiceRadios?.forEach(radio => {
            radio.addEventListener('change', () => {
                this.enablePreviewButtons();
            });
        });
        
        // Reabilitar botões quando voz RVC mudar
        rvcSelect?.addEventListener('change', () => {
            this.enablePreviewButtons();
        });
    }

    /**
     * Obter configurações atuais
     */
    getCurrentConfig() {
        const edgeVoice = document.querySelector('input[name="azure-voice"]:checked')?.value || 'ava';
        const pitch = parseInt(document.getElementById('tv-pitch-slider')?.value || 0);
        const rate = parseFloat(document.getElementById('tv-rate-slider')?.value || 1.0);
        const rvcVoice = document.getElementById('tv-rvc-voice')?.value;
        
        return {
            text: this.previewText,
            edgeVoice,
            edgePitch: 0,        // ✅ Edge TTS sempre com pitch = 0
            rate,                // ✅ Velocidade afeta Edge TTS
            rvcVoice,
            rvcPitch: pitch      // ✅ TOM afeta APENAS RVC
        };
    }

    /**
     * Gerar chave de cache (igual ao TurboTTS)
     * Formato: edgeVoice|rate:X|rvcVoice|rvcPitch:Y
     */
    generateCacheKey(config) {
        // Para preview natural (só Edge TTS - sem pitch)
        if (!config.rvcVoice) {
            return `natural|${config.edgeVoice}|rate:${config.rate}`;
        }
        
        // Para preview processado (Edge TTS + RVC - pitch afeta apenas RVC)
        return `processed|${config.edgeVoice}|rate:${config.rate}|${config.rvcVoice}|pitch:${config.rvcPitch}`;
    }

    /**
     * Verificar se preview existe no cache (localStorage)
     * Valida se o arquivo realmente existe antes de retornar
     */
    async checkCache(cacheKey) {
        const CACHE_KEY = 'tv_preview_cache_map';
        let map = {};
        try {
            map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch {}
        
        if (map[cacheKey]) {
            const filePath = map[cacheKey];
            
            // Validar se arquivo realmente existe via IPC
            try {
                const exists = await window.electronAPI.fileExists(filePath);
                if (exists) {
                    return { exists: true, path: filePath };
                } else {
                    // Arquivo não existe mais, remover do cache
                    console.warn('[PreviewManager] Arquivo de cache não encontrado, removendo:', filePath);
                    delete map[cacheKey];
                    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
                    return { exists: false };
                }
            } catch (error) {
                // Se não conseguir validar, assumir que não existe (seguro)
                console.warn('[PreviewManager] Erro ao validar arquivo de cache:', error);
                delete map[cacheKey];
                localStorage.setItem(CACHE_KEY, JSON.stringify(map));
                return { exists: false };
            }
        }
        
        return { exists: false };
    }
    
    /**
     * Salvar preview no cache
     */
    saveToCache(cacheKey, filePath) {
        const CACHE_KEY = 'tv_preview_cache_map';
        let map = {};
        try {
            map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch {}
        
        map[cacheKey] = filePath;
        localStorage.setItem(CACHE_KEY, JSON.stringify(map));
        console.log('[PreviewManager] Preview salvo no cache:', cacheKey);
    }
    
    /**
     * Limpar entradas de cache inválidas (arquivos que não existem mais)
     * Executado automaticamente na inicialização
     */
    async cleanInvalidCache() {
        const CACHE_KEY = 'tv_preview_cache_map';
        let map = {};
        try {
            map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch {
            return;
        }
        
        let cleanedCount = 0;
        const entries = Object.entries(map);
        
        for (const [key, filePath] of entries) {
            try {
                // Validar se arquivo existe via IPC
                const exists = await window.electronAPI.fileExists(filePath);
                if (!exists) {
                    console.warn('[PreviewManager] Removendo cache inválido:', filePath);
                    delete map[key];
                    cleanedCount++;
                }
            } catch (error) {
                // Se der erro ao validar, manter no cache
                console.warn('[PreviewManager] Erro ao validar cache:', error);
            }
        }
        
        if (cleanedCount > 0) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(map));
            console.log(`[PreviewManager] Cache limpo: ${cleanedCount} entrada(s) inválida(s) removida(s)`);
        }
    }
    
    /**
     * Limpar todo o cache (localStorage)
     */
    clearLocalCache() {
        const CACHE_KEY = 'tv_preview_cache_map';
        try {
            localStorage.removeItem(CACHE_KEY);
            console.log('[PreviewManager] Cache local limpo');
        } catch (error) {
            console.error('[PreviewManager] Erro ao verificar cache:', error);
            return { exists: false };
        }
    }

    /**
     * Gerar preview natural (Edge TTS puro - rápido)
     */
    async generatePreviewNatural() {
        const config = this.getCurrentConfig();
        
        // Validações
        if (!config.edgeVoice) {
            await window.tvModal.alert('Atenção', 'Selecione uma voz base antes de gerar o preview.', 'warning');
            return;
        }
        
        try {
            // Desabilitar botões durante geração
            this.disablePreviewButtons();
            
            // Gerar chave de cache SEM RVC (preview natural)
            const naturalConfig = {
                ...config,
                rvcVoice: null, // Forçar null para gerar chave natural
                rvcPitch: 0
            };
            const cacheKey = this.generateCacheKey(naturalConfig);
            console.log('[PreviewManager] Cache key (natural):', cacheKey);
            
            // Verificar cache
            const cacheResult = await this.checkCache(cacheKey);
            
            if (cacheResult.exists && this.cacheEnabled) {
                // Usar preview do cache
                console.log('[PreviewManager] Preview natural encontrado no cache');
                this.showPreview(cacheResult.path, true, 'natural');
                this.enablePreviewButtons();
                return;
            }
            
            // Mostrar loading
            this.showLoading('Gerando preview natural com TTS Neural...');
            
            // Gerar preview natural (Edge TTS puro)
            const result = await window.electronAPI.turboVoicerGenerateEdgeTTS({
                text: config.text,
                voice: config.edgeVoice,
                rate: config.rate,
                pitch: config.edgePitch
            });
            
            if (result.success) {
                // Salvar no cache
                this.saveToCache(cacheKey, result.path);
                
                // Mostrar botão de limpar cache
                document.getElementById('tv-btn-clear-cache').style.display = 'inline-flex';
                
                this.showPreview(result.path, false, 'natural');
            } else {
                throw new Error(result.error || 'Erro ao gerar preview natural');
            }
            
        } catch (error) {
            console.error('[PreviewManager] Erro ao gerar preview natural:', error);
            this.hideLoading();
            await window.tvModal.alert('Erro', `Falha ao gerar preview natural:\n\n${error.message}`, 'error');
        } finally {
            this.enablePreviewButtons();
        }
    }

    /**
     * Gerar preview processado (Edge TTS + RVC - completo)
     */
    async generatePreviewProcessed() {
        const config = this.getCurrentConfig();
        
        // Validações
        if (!config.rvcVoice) {
            await window.tvModal.alert('Atenção', 'Selecione uma voz de destino antes de gerar o preview processado.', 'warning');
            return;
        }
        
        try {
            // Desabilitar botões durante geração
            this.disablePreviewButtons();
            
            // Gerar chave de cache
            const cacheKey = this.generateCacheKey(config);
            console.log('[PreviewManager] Cache key:', cacheKey);
            
            // Verificar cache
            const cacheResult = await this.checkCache(cacheKey);
            
            if (cacheResult.exists && this.cacheEnabled) {
                // Usar preview do cache
                console.log('[PreviewManager] Preview processado encontrado no cache');
                this.showPreview(cacheResult.path, true, 'processed');
                this.enablePreviewButtons();
                return;
            }
            
            // Mostrar loading
            this.showLoading('Gerando preview processado...');
            this.updateLoadingText('⏳ Carregando motor RVC... Isso pode levar até 30 segundos na primeira vez.');
            
            const result = await window.electronAPI.turboVoicerGeneratePreview(config);
            
            if (result.success) {
                // Salvar no cache
                this.saveToCache(cacheKey, result.path);
                
                // Mostrar botão de limpar cache
                document.getElementById('tv-btn-clear-cache').style.display = 'inline-flex';
                
                this.showPreview(result.path, false, 'processed');
            } else {
                throw new Error(result.error || 'Erro ao gerar preview processado');
            }
            
        } catch (error) {
            console.error('[PreviewManager] Erro ao gerar preview processado:', error);
            this.hideLoading();
            this.enablePreviewButtons();
            
            // Se erro de módulo Python faltando, sugerir reparação
            if (error.message.includes('No module named') || error.message.includes('ModuleNotFoundError')) {
                window.tvModal.alert(
                    'Erro: Dependência Python faltando\n\n' +
                    'Parece que falta instalar uma dependência do motor RVC.\n\n' +
                    'Solução: Recarregue o TurboStudio e clique em "Reparar Instalação" se aparecer.'
                );
            } else {
                window.tvModal.alert('Erro ao gerar preview processado:\n\n' + error.message);
            }
        }
    }

    /**
     * Gerar preview de voz (método legado - mantido para compatibilidade)
     * @deprecated Use generatePreviewNatural() ou generatePreviewProcessed()
     */
    async generatePreview() {
        const config = this.getCurrentConfig();
        
        // Validações
        if (!config.rvcVoice) {
            await window.tvModal.alert('Atenção', 'Selecione uma voz RVC antes de gerar o preview.', 'warning');
            return;
        }
        
        try {
            // Mostrar loading
            this.showLoading('Gerando hash da configuração...');
            
            // Gerar hash da configuração
            const configHash = await this.generateConfigHash(config);
            
            // Verificar cache
            this.updateLoadingText('Verificando cache...');
            const cacheResult = await this.checkCache(configHash);
            
            if (cacheResult.exists && this.cacheEnabled) {
                // Usar preview do cache
                console.log('[PreviewManager] Preview encontrado no cache:', configHash);
                this.showPreview(cacheResult.path, true);
                return;
            }
            
            // Gerar novo preview
            console.log('[PreviewManager] Gerando novo preview...');
            this.updateLoadingText('Gerando áudio com TTS Neural...');
            
            const result = await window.electronAPI.turboVoicerGeneratePreview({
                ...config,
                configHash
            });
            
            if (result.success) {
                this.showPreview(result.path, false);
                
                // Mostrar botão de limpar cache
                document.getElementById('tv-btn-clear-cache').style.display = 'inline-flex';
            } else {
                throw new Error(result.error || 'Erro ao gerar preview');
            }
            
        } catch (error) {
            console.error('[PreviewManager] Erro ao gerar preview:', error);
            this.hideLoading();
            await window.tvModal.alert('Erro', `Falha ao gerar preview:\n\n${error.message}`, 'error');
        }
    }

    /**
     * Mostrar preview gerado
     */
    showPreview(audioPath, fromCache, type = 'processed') {
        this.hideLoading();
        
        const player = document.getElementById('tv-preview-player');
        const audio = document.getElementById('tv-preview-audio');
        const cacheInfo = document.getElementById('tv-preview-cache-info');
        
        // Configurar player
        audio.src = `file://${audioPath}`;
        
        // Mostrar informação baseada no tipo
        if (type === 'natural') {
            cacheInfo.textContent = '⚡ Preview natural gerado (TTS Neural)';
            cacheInfo.style.color = '#0A84FF';
        } else if (fromCache) {
            cacheInfo.textContent = '💾 Preview processado carregado do cache';
            cacheInfo.style.color = '#00ff88';
        } else {
            cacheInfo.textContent = '✨ Preview processado gerado e salvo no cache';
            cacheInfo.style.color = '#FF0033';
        }
        
        // Mostrar player
        player.style.display = 'block';
        
        // Tocar som de sucesso
        if (window.sounds?.success) {
            window.sounds.success.volume = 0.5;
            window.sounds.success.play().catch(() => {});
        }
        
        this.currentPreview = audioPath;
    }

    /**
     * Desabilitar botões de preview durante geração
     */
    disablePreviewButtons() {
        const btnNatural = document.getElementById('tv-btn-preview-natural');
        const btnProcessed = document.getElementById('tv-btn-preview-processed');
        
        if (btnNatural) btnNatural.disabled = true;
        if (btnProcessed) btnProcessed.disabled = true;
    }

    /**
     * Habilitar botões de preview após geração
     */
    enablePreviewButtons() {
        const btnNatural = document.getElementById('tv-btn-preview-natural');
        const btnProcessed = document.getElementById('tv-btn-preview-processed');
        
        if (btnNatural) btnNatural.disabled = false;
        if (btnProcessed) btnProcessed.disabled = false;
    }

    /**
     * Mostrar loading
     */
    showLoading(text = 'Gerando preview...') {
        const loading = document.getElementById('tv-preview-loading');
        const player = document.getElementById('tv-preview-player');
        
        player.style.display = 'none';
        loading.style.display = 'flex';
        
        this.updateLoadingText(text);
    }

    /**
     * Atualizar texto do loading
     */
    updateLoadingText(text) {
        const loadingText = document.getElementById('tv-preview-loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    /**
     * Esconder loading
     */
    hideLoading() {
        const loading = document.getElementById('tv-preview-loading');
        loading.style.display = 'none';
    }

    /**
     * Limpar cache de previews
     */
    async clearCache() {
        const confirmed = await window.tvModal.confirm(
            'Limpar Cache',
            'Deseja realmente limpar todos os previews salvos em cache?\n\nIsso não afetará os áudios finais gerados.',
            { confirmText: 'Sim, Limpar', cancelText: 'Cancelar', danger: true }
        );
        
        if (!confirmed) return;
        
        try {
            // 1. Fechar player para liberar arquivo de áudio
            this.closePlayer();
            
            // 2. Limpar cache inteligente do backend
            const result = await window.electronAPI.turboVoicerClearCache();
            
            // 3. Limpar localStorage
            this.clearLocalCache();
            
            if (result.success) {
                await window.tvModal.alert('Cache Limpo', `${result.removed} preview(s) removido(s) do cache.\n\nEspaço liberado: ${result.freedSpaceMB} MB`, 'success');
                
                // Esconder botão de limpar cache
                document.getElementById('tv-btn-clear-cache').style.display = 'none';
            } else {
                throw new Error(result.error || 'Erro ao limpar cache');
            }
        } catch (error) {
            console.error('[PreviewManager] Erro ao limpar cache:', error);
            await window.tvModal.alert('Erro', `Falha ao limpar cache:\n\n${error.message}`, 'error');
        }
    }
    
    /**
     * Fechar player e liberar arquivo de áudio
     */
    closePlayer() {
        const player = document.getElementById('tv-preview-player');
        const audio = document.getElementById('tv-preview-audio');
        
        // Parar áudio e limpar source para liberar arquivo
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
            audio.load(); // Força o navegador a liberar o arquivo
        }
        
        // Esconder player
        if (player) {
            player.style.display = 'none';
        }
        
        this.currentPreview = null;
        console.log('[PreviewManager] Player fechado e arquivo liberado');
    }

    /**
     * Verificar status do cache
     */
    async checkCacheStatus() {
        try {
            const result = await window.electronAPI.turboVoicerGetCacheStatus();
            
            if (result.count > 0) {
                document.getElementById('tv-btn-clear-cache').style.display = 'inline-flex';
            }
        } catch (error) {
            console.error('[PreviewManager] Erro ao verificar status do cache:', error);
        }
    }
}

// Inicializar quando o DOM estiver pronto
let previewManager;
document.addEventListener('DOMContentLoaded', () => {
    previewManager = new PreviewManager();
});
