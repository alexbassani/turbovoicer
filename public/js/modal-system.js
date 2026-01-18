/**
 * Sistema de Modais Customizados - TurboVoicer
 * Modais no padrão visual do TurboStudio
 */

class ModalSystem {
    constructor() {
        this.currentModal = null;
        this.init();
    }

    init() {
        // Criar container de modais se não existir
        if (!document.getElementById('tv-modal-container')) {
            const container = document.createElement('div');
            container.id = 'tv-modal-container';
            document.body.appendChild(container);
        }
    }

    /**
     * Mostrar modal de confirmação
     */
    async confirm(title, message, options = {}) {
        return new Promise((resolve) => {
            const confirmText = options.confirmText || 'Confirmar';
            const cancelText = options.cancelText || 'Cancelar';
            const isDanger = options.danger || false;

            const modal = this.createModal(`
                <div class="tv-modal-overlay" id="tv-confirm-modal">
                    <div class="tv-modal-box">
                        <div class="tv-modal-header">
                            <h3>${title}</h3>
                        </div>
                        <div class="tv-modal-body">
                            <p>${message.replace(/\n/g, '<br>')}</p>
                        </div>
                        <div class="tv-modal-footer">
                            <button class="tv-modal-btn tv-modal-btn-secondary" id="tv-modal-cancel">
                                ${cancelText}
                            </button>
                            <button class="tv-modal-btn ${isDanger ? 'tv-modal-btn-danger' : 'tv-modal-btn-primary'}" id="tv-modal-confirm">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            `);

            // Event listeners
            document.getElementById('tv-modal-cancel').addEventListener('click', () => {
                this.close();
                resolve(false);
            });

            document.getElementById('tv-modal-confirm').addEventListener('click', () => {
                this.close();
                resolve(true);
            });

            // Fechar com ESC
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close();
                    resolve(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    /**
     * Mostrar modal de alerta/informação
     */
    async alert(title, message, type = 'info') {
        return new Promise((resolve) => {
            // Proteção contra message undefined
            const safeMessage = message || '';
            
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };

            const colors = {
                success: '#34C759',
                error: '#FF3B30',
                warning: '#FF9500',
                info: '#0A84FF'
            };

            const icon = icons[type] || icons.info;
            const color = colors[type] || colors.info;

            const modal = this.createModal(`
                <div class="tv-modal-overlay" id="tv-alert-modal">
                    <div class="tv-modal-box">
                        <div class="tv-modal-header">
                            <div class="tv-modal-icon" style="color: ${color};">${icon}</div>
                            <h3>${title}</h3>
                        </div>
                        <div class="tv-modal-body">
                            <p>${safeMessage.replace(/\n/g, '<br>')}</p>
                        </div>
                        <div class="tv-modal-footer">
                            <button class="tv-modal-btn tv-modal-btn-primary" id="tv-modal-ok">
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            `);

            // Event listener
            document.getElementById('tv-modal-ok').addEventListener('click', () => {
                this.close();
                resolve(true);
            });

            // Fechar com ESC ou Enter
            const keyHandler = (e) => {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    this.close();
                    resolve(true);
                    document.removeEventListener('keydown', keyHandler);
                }
            };
            document.addEventListener('keydown', keyHandler);
        });
    }

    /**
     * Criar modal
     */
    createModal(html) {
        const container = document.getElementById('tv-modal-container');
        container.innerHTML = html;
        this.currentModal = container.firstElementChild;
        
        // Adicionar estilos se não existirem
        if (!document.getElementById('tv-modal-styles')) {
            this.injectStyles();
        }

        return this.currentModal;
    }

    /**
     * Fechar modal
     */
    close() {
        const container = document.getElementById('tv-modal-container');
        if (container) {
            container.innerHTML = '';
        }
        this.currentModal = null;
    }

    /**
     * Injetar estilos CSS
     */
    injectStyles() {
        const style = document.createElement('style');
        style.id = 'tv-modal-styles';
        style.textContent = `
            #tv-modal-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 99999;
                pointer-events: none;
            }

            .tv-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: all;
                animation: tv-modal-fade-in 0.2s ease-out;
            }

            @keyframes tv-modal-fade-in {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            .tv-modal-box {
                background: #1c1c1e;
                border-radius: 12px;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                animation: tv-modal-slide-in 0.3s ease-out;
            }

            @keyframes tv-modal-slide-in {
                from {
                    transform: translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            .tv-modal-header {
                padding: 24px 24px 16px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .tv-modal-icon {
                font-size: 32px;
                font-weight: bold;
                line-height: 1;
            }

            .tv-modal-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #fff;
            }

            .tv-modal-body {
                padding: 16px 24px;
            }

            .tv-modal-body p {
                margin: 0;
                font-size: 14px;
                line-height: 1.6;
                color: #999;
            }

            .tv-modal-footer {
                padding: 16px 24px 24px 24px;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .tv-modal-btn {
                padding: 10px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }

            .tv-modal-btn-primary {
                background: #FF0033;
                color: #fff;
            }

            .tv-modal-btn-primary:hover {
                background: #cc0029;
                transform: translateY(-1px);
            }

            .tv-modal-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }

            .tv-modal-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.15);
            }

            .tv-modal-btn-danger {
                background: #FF3B30;
                color: #fff;
            }

            .tv-modal-btn-danger:hover {
                background: #cc2f26;
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    }
}

// Instância global
window.tvModal = new ModalSystem();
