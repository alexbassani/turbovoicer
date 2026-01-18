/**
 * TurboVoicer - Debug Console Visível
 * Intercepta todos os console.log/error/warn e exibe em painel visível
 */

(function() {
    'use strict';
    
    let logCount = 0;
    let isMinimized = false;
    
    // Aguardar DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        const logsContainer = document.getElementById('tv-debug-logs');
        const countElement = document.getElementById('tv-debug-count');
        const clearBtn = document.getElementById('tv-debug-clear');
        const toggleBtn = document.getElementById('tv-debug-toggle');
        const consoleElement = document.getElementById('tv-debug-console');
        
        if (!logsContainer) {
            console.error('[DEBUG CONSOLE] Elemento tv-debug-logs não encontrado');
            return;
        }
        
        // Interceptar console.log
        const originalLog = console.log;
        console.log = function(...args) {
            originalLog.apply(console, args);
            addLog('log', args);
        };
        
        // Interceptar console.error
        const originalError = console.error;
        console.error = function(...args) {
            originalError.apply(console, args);
            addLog('error', args);
        };
        
        // Interceptar console.warn
        const originalWarn = console.warn;
        console.warn = function(...args) {
            originalWarn.apply(console, args);
            addLog('warn', args);
        };
        
        // Interceptar console.info
        const originalInfo = console.info;
        console.info = function(...args) {
            originalInfo.apply(console, args);
            addLog('info', args);
        };
        
        function addLog(type, args) {
            logCount++;
            
            // Formatar mensagem
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
            
            // Criar elemento de log
            const logElement = document.createElement('div');
            logElement.style.marginBottom = '4px';
            logElement.style.paddingLeft = '8px';
            logElement.style.borderLeft = '3px solid';
            
            // Cores por tipo
            const colors = {
                log: '#0f0',
                error: '#f00',
                warn: '#ff0',
                info: '#0af'
            };
            
            const prefixes = {
                log: '▸',
                error: '✖',
                warn: '⚠',
                info: 'ℹ'
            };
            
            logElement.style.color = colors[type] || '#0f0';
            logElement.style.borderLeftColor = colors[type] || '#0f0';
            
            // Timestamp
            const timestamp = new Date().toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                fractionalSecondDigits: 3
            });
            
            logElement.innerHTML = `<span style="color: #666;">[${timestamp}]</span> <span style="color: ${colors[type]};">${prefixes[type]}</span> ${escapeHtml(message)}`;
            
            logsContainer.appendChild(logElement);
            
            // Auto-scroll para o final
            logsContainer.scrollTop = logsContainer.scrollHeight;
            
            // Atualizar contador
            if (countElement) {
                countElement.textContent = `${logCount} logs`;
            }
            
            // Limitar a 500 logs para não travar
            const logs = logsContainer.children;
            if (logs.length > 500) {
                logsContainer.removeChild(logs[0]);
            }
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Botão limpar
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                logsContainer.innerHTML = '<div style="color: #666;">Console limpo...</div>';
                logCount = 0;
                if (countElement) {
                    countElement.textContent = '0 logs';
                }
            });
        }
        
        // Botão minimizar/maximizar
        if (toggleBtn && consoleElement) {
            toggleBtn.addEventListener('click', () => {
                isMinimized = !isMinimized;
                if (isMinimized) {
                    consoleElement.style.height = '40px';
                    logsContainer.style.display = 'none';
                    toggleBtn.textContent = 'Maximizar';
                } else {
                    consoleElement.style.height = '200px';
                    logsContainer.style.display = 'block';
                    toggleBtn.textContent = 'Minimizar';
                }
            });
        }
        
        console.log('[DEBUG CONSOLE] ✅ Console de debug inicializado');
    }
})();
