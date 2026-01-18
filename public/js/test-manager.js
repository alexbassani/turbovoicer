/**
 * Test Manager - TurboVoicer
 * Sistema de testes para Edge TTS e RVC
 * Verifica status e funcionamento dos componentes
 */

class TestManager {
    constructor() {
        this.testResults = {
            edgeTTS: null,
            rvc: null
        };
        
        this.initializeUI();
    }

    /**
     * Inicializar UI e event listeners
     */
    initializeUI() {
        const btnTestEdge = document.getElementById('tv-btn-test-edge');
        const btnTestRVC = document.getElementById('tv-btn-test-rvc');
        const btnTestAll = document.getElementById('tv-btn-test-all');
        const btnReinstall = document.getElementById('tv-btn-reinstall-engine');
        
        btnTestEdge?.addEventListener('click', () => this.testEdgeTTS());
        btnTestRVC?.addEventListener('click', () => this.testRVC());
        btnTestAll?.addEventListener('click', () => this.testAll());
        btnReinstall?.addEventListener('click', () => this.reinstallEngine());
    }

    /**
     * Testar Edge TTS
     */
    async testEdgeTTS() {
        const badge = document.getElementById('tv-edge-status-badge');
        const message = document.getElementById('tv-edge-status-message');
        const button = document.getElementById('tv-btn-test-edge');
        
        try {
            // Atualizar UI para estado "testando"
            this.updateBadge(badge, 'testing', 'Testando...');
            message.textContent = 'Gerando áudio de teste com TTS Neural...';
            message.className = 'tv-status-message';
            button.disabled = true;
            
            // Executar teste via IPC
            const result = await window.electronAPI.testAzureTTS('Teste de voz', 'ava');
            
            if (result.success) {
                this.testResults.edgeTTS = true;
                this.updateBadge(badge, 'success', 'Funcionando');
                message.textContent = 'TTS Neural está funcionando corretamente!';
                message.className = 'tv-status-message success';
                
                // Tocar som de sucesso
                if (window.sounds?.success) {
                    window.sounds.success.volume = 0.3;
                    window.sounds.success.play().catch(() => {});
                }
            } else {
                throw new Error(result.error || 'Falha no teste');
            }
        } catch (error) {
            console.error('[TestManager] Erro ao testar Edge TTS:', error);
            this.testResults.edgeTTS = false;
            this.updateBadge(badge, 'error', 'Erro');
            message.textContent = `Erro: ${error.message}`;
            message.className = 'tv-status-message error';
        } finally {
            button.disabled = false;
        }
    }

    /**
     * Testar RVC
     */
    async testRVC() {
        const badge = document.getElementById('tv-rvc-status-badge');
        const message = document.getElementById('tv-rvc-status-message');
        const button = document.getElementById('tv-btn-test-rvc');
        
        try {
            // Verificar se há voz RVC selecionada
            const rvcVoice = document.getElementById('tv-rvc-voice')?.value;
            if (!rvcVoice) {
                await window.tvModal.alert('Atenção', 'Selecione uma voz RVC antes de testar.', 'warning');
                return;
            }
            
            // Atualizar UI para estado "testando"
            this.updateBadge(badge, 'testing', 'Testando...');
            message.textContent = 'Testando conversão RVC...';
            message.className = 'tv-status-message';
            button.disabled = true;
            
            // Executar teste via IPC - precisa de um áudio de teste e o modelo RVC
            const result = await window.electronAPI.testRVCConversion(null, rvcVoice);
            
            if (result.success) {
                this.testResults.rvc = true;
                this.updateBadge(badge, 'success', 'Funcionando');
                message.textContent = 'RVC está funcionando corretamente!';
                message.className = 'tv-status-message success';
                
                // Tocar som de sucesso
                if (window.sounds?.success) {
                    window.sounds.success.volume = 0.3;
                    window.sounds.success.play().catch(() => {});
                }
            } else {
                throw new Error(result.error || 'Falha no teste');
            }
        } catch (error) {
            console.error('[TestManager] Erro ao testar RVC:', error);
            this.testResults.rvc = false;
            this.updateBadge(badge, 'error', 'Erro');
            message.textContent = `Erro: ${error.message}`;
            message.className = 'tv-status-message error';
        } finally {
            button.disabled = false;
        }
    }

    /**
     * Testar todos os componentes
     */
    async testAll() {
        const button = document.getElementById('tv-btn-test-all');
        button.disabled = true;
        
        try {
            // Testar Edge TTS
            await this.testEdgeTTS();
            
            // Aguardar 1 segundo
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Testar RVC
            await this.testRVC();
            
            // Verificar resultados
            if (this.testResults.edgeTTS && this.testResults.rvc) {
                window.modal.show('success', 'Testes Concluídos', 
                    'Todos os componentes estão funcionando corretamente!\n\nVocê pode começar a gerar áudios.'
                );
            } else if (this.testResults.edgeTTS === false || this.testResults.rvc === false) {
                window.modal.show('error', 'Testes com Falhas', 
                    'Um ou mais componentes apresentaram erros.\n\nVerifique os detalhes acima e tente novamente.'
                );
            }
        } catch (error) {
            console.error('[TestManager] Erro ao testar todos:', error);
        } finally {
            button.disabled = false;
        }
    }

    /**
     * Atualizar badge de status
     */
    updateBadge(badge, status, text) {
        if (!badge) return;
        
        // Remover classes antigas
        badge.classList.remove('untested', 'testing', 'success', 'error');
        
        // Adicionar nova classe
        badge.classList.add(status);
        
        // Atualizar ícone
        let iconSVG = '';
        switch (status) {
            case 'testing':
                iconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                </svg>`;
                break;
            case 'success':
                iconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>`;
                break;
            case 'error':
                iconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>`;
                break;
            default:
                iconSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                </svg>`;
        }
        
        badge.innerHTML = iconSVG + text;
    }

    /**
     * Reinstalar motor de conversão (Motor de Processamento)
     */
    async reinstallEngine() {
        const button = document.getElementById('tv-btn-reinstall-engine');
        
        try {
            // Confirmar ação com o usuário
            const confirmed = await window.tvModal.confirm(
                'Reinstalar Motor de Conversão',
                'Isso irá remover a instalação atual e baixar uma nova versão do motor de conversão. O processo pode levar de 8 a 15 minutos.\n\nDeseja continuar?',
                'warning'
            );
            
            if (!confirmed) {
                return;
            }
            
            // Desabilitar botão e mostrar loading
            button.disabled = true;
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Reinstalando...
            `;
            
            // Mostrar overlay de loading
            if (window.turboVoicerApp) {
                window.turboVoicerApp.showLoadingOverlay('Removendo instalação antiga...');
            }
            
            // Chamar IPC para reinstalar
            const result = await window.electronAPI.turboVoicerReinstallRVCEngine();
            
            if (window.turboVoicerApp) {
                window.turboVoicerApp.hideLoadingOverlay();
            }
            
            if (result.success) {
                // Resetar testes
                this.resetTests();
                
                // Mostrar sucesso
                await window.tvModal.alert(
                    'Sucesso!',
                    'Motor de conversão reinstalado com sucesso. Todos os componentes foram atualizados.',
                    'success'
                );
                
                // Sugerir testar novamente
                const shouldTest = await window.tvModal.confirm(
                    'Testar Componentes',
                    'Deseja testar os componentes agora para verificar se tudo está funcionando?',
                    'info'
                );
                
                if (shouldTest) {
                    await this.testAll();
                }
            } else {
                throw new Error(result.error || 'Falha na reinstalação');
            }
        } catch (error) {
            console.error('[TestManager] Erro ao reinstalar motor:', error);
            
            if (window.turboVoicerApp) {
                window.turboVoicerApp.hideLoadingOverlay();
            }
            
            await window.tvModal.alert(
                'Erro na Reinstalação',
                `Não foi possível reinstalar o motor de conversão:\n\n${error.message}\n\nTente novamente ou entre em contato com o suporte.`,
                'error'
            );
        } finally {
            // Restaurar botão
            button.disabled = false;
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Reinstalar Motor
            `;
        }
    }

    /**
     * Resetar todos os testes
     */
    resetTests() {
        this.testResults = {
            edgeTTS: null,
            rvc: null
        };
        
        const edgeBadge = document.getElementById('tv-edge-status-badge');
        const rvcBadge = document.getElementById('tv-rvc-status-badge');
        const edgeMessage = document.getElementById('tv-edge-status-message');
        const rvcMessage = document.getElementById('tv-rvc-status-message');
        
        this.updateBadge(edgeBadge, 'untested', 'Não testado');
        this.updateBadge(rvcBadge, 'untested', 'Não testado');
        
        edgeMessage.textContent = 'Clique em "Testar" para verificar';
        edgeMessage.className = 'tv-status-message';
        
        rvcMessage.textContent = 'Clique em "Testar" para verificar';
        rvcMessage.className = 'tv-status-message';
    }

    /**
     * Verificar se todos os testes passaram
     */
    allTestsPassed() {
        return this.testResults.edgeTTS === true && this.testResults.rvc === true;
    }
}

// Inicializar quando o DOM estiver pronto
let testManager;
document.addEventListener('DOMContentLoaded', () => {
    testManager = new TestManager();
});
