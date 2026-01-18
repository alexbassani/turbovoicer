/**
 * Preset Manager - TurboVoicer
 * Gerencia presets de configuração de voz
 * Salvar, carregar, exportar e importar configurações
 */

class PresetManager {
    constructor() {
        this.presets = [];
        this.currentPresetId = null;
        
        this.initializeUI();
        this.loadPresets();
    }

    /**
     * Inicializar UI e event listeners
     */
    initializeUI() {
        const btnSave = document.getElementById('tv-btn-save-preset');
        const btnLoad = document.getElementById('tv-btn-load-preset');
        const btnDelete = document.getElementById('tv-btn-delete-preset');
        const btnExport = document.getElementById('tv-btn-export-preset');
        const btnImport = document.getElementById('tv-btn-import-preset');
        const btnExportAll = document.getElementById('tv-btn-export-all-presets');
        const presetSelect = document.getElementById('tv-preset-select');
        
        btnSave?.addEventListener('click', () => this.savePreset());
        btnLoad?.addEventListener('click', () => this.loadPreset());
        btnDelete?.addEventListener('click', () => this.deletePreset());
        btnExport?.addEventListener('click', () => this.exportPreset());
        btnImport?.addEventListener('click', () => this.importPreset());
        btnExportAll?.addEventListener('click', () => this.exportAllPresets());
        
        presetSelect?.addEventListener('change', (e) => this.onPresetSelected(e.target.value));
    }

    /**
     * Obter configuração atual da UI
     */
    getCurrentConfig() {
        const edgeVoice = document.querySelector('input[name="azure-voice"]:checked')?.value || 'ava';
        const pitch = parseInt(document.getElementById('tv-pitch-slider')?.value || 0);
        const rate = parseFloat(document.getElementById('tv-rate-slider')?.value || 1.0);
        const rvcVoice = document.getElementById('tv-rvc-voice')?.value;
        const rvcPitch = parseInt(document.getElementById('tv-rvc-pitch-slider')?.value || 0);
        
        return {
            edgeVoice,
            pitch,
            rate,
            rvcVoice,
            rvcPitch
        };
    }

    /**
     * Aplicar configuração na UI
     */
    applyConfig(config) {
        // Edge Voice
        const edgeVoiceRadio = document.querySelector(`input[name="azure-voice"][value="${config.edgeVoice}"]`);
        if (edgeVoiceRadio) {
            edgeVoiceRadio.checked = true;
        }
        
        // Pitch
        const pitchSlider = document.getElementById('tv-pitch-slider');
        if (pitchSlider) {
            pitchSlider.value = config.pitch;
            document.getElementById('tv-pitch-value').textContent = `${config.pitch} st`;
        }
        
        // Rate
        const rateSlider = document.getElementById('tv-rate-slider');
        if (rateSlider) {
            rateSlider.value = config.rate;
            document.getElementById('tv-rate-value').textContent = `${config.rate}x`;
        }
        
        // RVC Voice
        const rvcVoiceSelect = document.getElementById('tv-rvc-voice');
        if (rvcVoiceSelect && config.rvcVoice) {
            rvcVoiceSelect.value = config.rvcVoice;
        }
        
        // RVC Pitch
        const rvcPitchSlider = document.getElementById('tv-rvc-pitch-slider');
        if (rvcPitchSlider) {
            rvcPitchSlider.value = config.rvcPitch;
            document.getElementById('tv-rvc-pitch-value').textContent = `${config.rvcPitch} st`;
        }
    }

    /**
     * Salvar preset
     */
    async savePreset() {
        const config = this.getCurrentConfig();
        
        // Validar configuração
        if (!config.rvcVoice) {
            window.modal.show('warning', 'Atenção', 'Selecione uma voz RVC antes de salvar o preset.');
            return;
        }
        
        // Solicitar nome do preset usando modal
        const presetName = await window.modal.prompt(
            'Salvar Preset',
            'Digite um nome para o preset:',
            'Meu Preset'
        );
        
        if (!presetName || !presetName.trim()) {
            return;
        }
        
        try {
            const preset = {
                id: Date.now().toString(),
                name: presetName.trim(),
                config: config,
                createdAt: new Date().toISOString()
            };
            
            // Salvar via IPC
            const result = await window.electronAPI.turboVoicerSavePreset(preset);
            
            if (result.success) {
                this.presets.push(preset);
                this.updatePresetSelect();
                this.currentPresetId = preset.id;
                document.getElementById('tv-preset-select').value = preset.id;
                this.showPresetInfo(preset);
                
                window.modal.show('success', 'Preset Salvo', `Preset "${presetName}" salvo com sucesso!`);
                
                // Tocar som de sucesso
                if (window.sounds?.success) {
                    window.sounds.success.volume = 0.5;
                    window.sounds.success.play().catch(() => {});
                }
            } else {
                throw new Error(result.error || 'Erro ao salvar preset');
            }
        } catch (error) {
            console.error('[PresetManager] Erro ao salvar preset:', error);
            window.modal.show('error', 'Erro', `Falha ao salvar preset: ${error.message}`);
        }
    }

    /**
     * Carregar preset
     */
    async loadPreset() {
        if (!this.currentPresetId) return;
        
        const preset = this.presets.find(p => p.id === this.currentPresetId);
        
        if (!preset) {
            window.modal.show('error', 'Erro', 'Preset não encontrado.');
            return;
        }
        
        try {
            this.applyConfig(preset.config);
            this.showPresetInfo(preset);
            
            window.modal.show('success', 'Preset Carregado', `Configurações de "${preset.name}" aplicadas com sucesso!`);
            
            // Tocar som de sucesso
            if (window.sounds?.success) {
                window.sounds.success.volume = 0.5;
                window.sounds.success.play().catch(() => {});
            }
        } catch (error) {
            console.error('[PresetManager] Erro ao carregar preset:', error);
            window.modal.show('error', 'Erro', `Falha ao carregar preset: ${error.message}`);
        }
    }

    /**
     * Deletar preset
     */
    async deletePreset() {
        if (!this.currentPresetId) return;
        
        const preset = this.presets.find(p => p.id === this.currentPresetId);
        
        if (!preset) {
            window.modal.show('error', 'Erro', 'Preset não encontrado.');
            return;
        }
        
        const confirm = await window.modal.confirm(
            'Excluir Preset',
            `Deseja realmente excluir o preset "${preset.name}"?\n\nEsta ação não pode ser desfeita.`,
            {
                confirmText: 'Sim, Excluir',
                cancelText: 'Cancelar'
            }
        );
        
        if (!confirm.confirmed) return;
        
        try {
            const result = await window.electronAPI.turboVoicerDeletePreset(this.currentPresetId);
            
            if (result.success) {
                this.presets = this.presets.filter(p => p.id !== this.currentPresetId);
                this.currentPresetId = null;
                this.updatePresetSelect();
                this.hidePresetInfo();
                
                window.modal.show('success', 'Preset Excluído', `Preset "${preset.name}" excluído com sucesso!`);
            } else {
                throw new Error(result.error || 'Erro ao excluir preset');
            }
        } catch (error) {
            console.error('[PresetManager] Erro ao excluir preset:', error);
            window.modal.show('error', 'Erro', `Falha ao excluir preset: ${error.message}`);
        }
    }

    /**
     * Exportar preset individual
     */
    async exportPreset() {
        if (!this.currentPresetId) return;
        
        const preset = this.presets.find(p => p.id === this.currentPresetId);
        
        if (!preset) {
            window.modal.show('error', 'Erro', 'Preset não encontrado.');
            return;
        }
        
        try {
            const result = await window.electronAPI.turboVoicerExportPreset(preset);
            
            if (result.success) {
                window.modal.show('success', 'Preset Exportado', 
                    `Preset exportado para:\n${result.path}\n\nVocê pode compartilhar este arquivo com outros usuários.`
                );
            } else if (result.cancelled) {
                // Usuário cancelou - não mostrar erro
                return;
            } else {
                throw new Error(result.error || 'Erro ao exportar preset');
            }
        } catch (error) {
            console.error('[PresetManager] Erro ao exportar preset:', error);
            window.modal.show('error', 'Erro', `Falha ao exportar preset: ${error.message}`);
        }
    }

    /**
     * Importar preset
     */
    async importPreset() {
        try {
            const result = await window.electronAPI.turboVoicerImportPreset();
            
            if (result.success && result.preset) {
                this.presets.push(result.preset);
                this.updatePresetSelect();
                
                window.modal.show('success', 'Preset Importado', 
                    `Preset "${result.preset.name}" importado com sucesso!`
                );
                
                // Tocar som de sucesso
                if (window.sounds?.success) {
                    window.sounds.success.volume = 0.5;
                    window.sounds.success.play().catch(() => {});
                }
            } else if (result.cancelled) {
                // Usuário cancelou
                return;
            } else {
                throw new Error(result.error || 'Erro ao importar preset');
            }
        } catch (error) {
            console.error('[PresetManager] Erro ao importar preset:', error);
            window.modal.show('error', 'Erro', `Falha ao importar preset: ${error.message}`);
        }
    }

    /**
     * Exportar todos os presets
     */
    async exportAllPresets() {
        if (this.presets.length === 0) {
            window.modal.show('warning', 'Atenção', 'Não há presets para exportar.');
            return;
        }
        
        try {
            const result = await window.electronAPI.turboVoicerExportAllPresets(this.presets);
            
            if (result.success) {
                window.modal.show('success', 'Presets Exportados', 
                    `${this.presets.length} preset(s) exportado(s) para:\n${result.path}`
                );
            } else if (result.cancelled) {
                // Usuário cancelou - não mostrar erro
                return;
            } else {
                throw new Error(result.error || 'Erro ao exportar presets');
            }
        } catch (error) {
            console.error('[PresetManager] Erro ao exportar presets:', error);
            window.modal.show('error', 'Erro', `Falha ao exportar presets: ${error.message}`);
        }
    }

    /**
     * Carregar presets salvos
     */
    async loadPresets() {
        try {
            const result = await window.electronAPI.turboVoicerLoadPresets();
            
            if (result.success) {
                this.presets = result.presets || [];
                this.updatePresetSelect();
            }
        } catch (error) {
            console.error('[PresetManager] Erro ao carregar presets:', error);
        }
    }

    /**
     * Atualizar select de presets
     */
    updatePresetSelect() {
        const select = document.getElementById('tv-preset-select');
        
        if (!select) return;
        
        // Limpar opções
        select.innerHTML = '<option value="">Nenhum preset selecionado</option>';
        
        // Adicionar presets
        this.presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            select.appendChild(option);
        });
        
        // Atualizar botões
        this.updateButtons();
    }

    /**
     * Quando preset é selecionado
     */
    onPresetSelected(presetId) {
        this.currentPresetId = presetId || null;
        
        if (presetId) {
            const preset = this.presets.find(p => p.id === presetId);
            if (preset) {
                // Auto-aplicar configurações do preset
                this.applyConfig(preset.config);
                this.showPresetInfo(preset);
                
                console.log('[PresetManager] Preset aplicado automaticamente:', preset.name);
            }
        } else {
            this.hidePresetInfo();
        }
        
        this.updateButtons();
    }

    /**
     * Mostrar informações do preset
     */
    showPresetInfo(preset) {
        const infoPanel = document.getElementById('tv-preset-info');
        
        document.getElementById('tv-preset-name').textContent = preset.name;
        document.getElementById('tv-preset-edge-voice').textContent = preset.config.edgeVoice === 'ava' ? 'Ava (Feminina)' : 'Brian (Masculina)';
        document.getElementById('tv-preset-rvc-voice').textContent = preset.config.rvcVoice || 'Nenhuma';
        document.getElementById('tv-preset-pitch').textContent = `${preset.config.pitch} st`;
        document.getElementById('tv-preset-rate').textContent = `${preset.config.rate}x`;
        document.getElementById('tv-preset-rvc-pitch').textContent = `${preset.config.rvcPitch} st`;
        
        infoPanel.style.display = 'block';
    }

    /**
     * Esconder informações do preset
     */
    hidePresetInfo() {
        const infoPanel = document.getElementById('tv-preset-info');
        infoPanel.style.display = 'none';
    }

    /**
     * Atualizar estado dos botões
     */
    updateButtons() {
        const hasSelection = !!this.currentPresetId;
        
        document.getElementById('tv-btn-load-preset').disabled = !hasSelection;
        document.getElementById('tv-btn-delete-preset').disabled = !hasSelection;
        document.getElementById('tv-btn-export-preset').disabled = !hasSelection;
    }
}

// Expor PresetManager globalmente para ser inicializado pelo app.js
window.PresetManager = PresetManager;
