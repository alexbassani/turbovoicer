/**
 * RVC Server Manager - TurboVoicer
 * Gerencia o servidor RVC em background (sem janela visível)
 * Inicia automaticamente quando necessário e fecha ao sair
 */

const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class RVCServerManager {
    constructor() {
        this.serverProcess = null;
        this.serverUrl = 'http://127.0.0.1:8765';  // FastAPI port
        this.isRunning = false;
        this.startupAttempts = 0;
        this.maxStartupAttempts = 3;
    }

    /**
     * Obter caminhos do RVC-GUI e FastAPI Server
     */
    getRVCPaths() {
        const installPath = path.join(app.getPath('userData'), 'turbovoicer');
        const rvcGuiPath = path.join(installPath, 'rvc-gui', 'RVC-GUI');
        
        // Caminho do script Python (funciona em dev e produção)
        // Em produção: extraResources copia para process.resourcesPath/turbovoicer/src
        const scriptPath = app.isPackaged
            ? path.join(process.resourcesPath, 'turbovoicer', 'src', 'rvc_server.py')
            : path.join(__dirname, 'rvc_server.py');
        
        return {
            python: path.join(rvcGuiPath, 'runtime', 'python.exe'),
            script: scriptPath,
            rvcGui: rvcGuiPath
        };
    }

    /**
     * Verificar se servidor RVC está rodando
     */
    async checkServerStatus() {
        try {
            const response = await axios.get(`${this.serverUrl}/`, { timeout: 2000 });
            this.isRunning = true;
            return true;
        } catch (error) {
            this.isRunning = false;
            return false;
        }
    }

    /**
     * Iniciar servidor RVC em background (SILENCIOSO)
     */
    async startServer() {
        if (this.isRunning) {
            console.log('[RVC Server] Servidor já está rodando');
            return true;
        }

        if (this.startupAttempts >= this.maxStartupAttempts) {
            console.error('[RVC Server] Máximo de tentativas de inicialização atingido');
            return false;
        }

        this.startupAttempts++;

        try {
            console.log('[RVC Server] Iniciando servidor RVC em background...');

            const paths = this.getRVCPaths();

            // Verificar se arquivos existem
            if (!fs.existsSync(paths.python)) {
                console.error('[RVC Server] Python do RVC-GUI não encontrado:', paths.python);
                return false;
            }

            if (!fs.existsSync(paths.script)) {
                console.error('[RVC Server] Script rvc_server.py não encontrado:', paths.script);
                return false;
            }

            // Iniciar processo FastAPI em background (SILENCIOSO mas com logs)
            this.serverProcess = spawn(paths.python, [
                paths.script
            ], {
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],  // Capturar stdout e stderr para debug
                windowsHide: true,    // Esconder janela no Windows
                cwd: paths.rvcGui,    // Executar na pasta do RVC-GUI (para acessar modelos)
                env: {
                    ...process.env,
                    PYTHONPATH: paths.rvcGui  // Garantir que imports RVC funcionem
                }
            });

            // Capturar output para debug (mas não mostrar janela)
            if (this.serverProcess.stdout) {
                this.serverProcess.stdout.setEncoding('utf8');
                this.serverProcess.stdout.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.log('[RVC Server STDOUT]', output);
                    }
                });
            }

            if (this.serverProcess.stderr) {
                this.serverProcess.stderr.setEncoding('utf8');
                this.serverProcess.stderr.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.error('[RVC Server STDERR]', output);
                    }
                });
            }

            this.serverProcess.on('error', (error) => {
                console.error('[RVC Server] Erro no processo:', error);
            });

            this.serverProcess.on('exit', (code, signal) => {
                console.log('[RVC Server] Processo encerrado. Code:', code, 'Signal:', signal);
                this.isRunning = false;
                this.serverProcess = null;
            });

            console.log('[RVC Server] Processo FastAPI iniciado. PID:', this.serverProcess.pid);
            console.log('[RVC Server] Comando:', paths.python);
            console.log('[RVC Server] Script:', paths.script);
            console.log('[RVC Server] CWD:', paths.rvcGui);
            console.log('[RVC Server] URL:', this.serverUrl);

            // Aguardar servidor ficar pronto (máximo 180 segundos = 3 minutos)
            const maxWaitTime = 180000; // 180 segundos
            const checkInterval = 2000; // 2 segundos
            let elapsed = 0;
            let lastLogTime = 0;

            while (elapsed < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                elapsed += checkInterval;

                // Log de progresso a cada 10 segundos
                if (elapsed - lastLogTime >= 10000) {
                    console.log(`[RVC Server] Aguardando servidor... ${Math.floor(elapsed / 1000)}s / ${Math.floor(maxWaitTime / 1000)}s`);
                    lastLogTime = elapsed;
                }

                const isReady = await this.checkServerStatus();
                if (isReady) {
                    console.log(`[RVC Server] ✅ Servidor RVC iniciado com sucesso em ${Math.floor(elapsed / 1000)}s!`);
                    this.isRunning = true;
                    this.startupAttempts = 0; // Reset tentativas
                    return true;
                }
            }

            console.error('[RVC Server] Timeout ao aguardar servidor ficar pronto após 3 minutos');
            this.stopServer();
            return false;

        } catch (error) {
            console.error('[RVC Server] Erro ao iniciar servidor:', error);
            return false;
        }
    }

    /**
     * Parar servidor RVC
     */
    stopServer() {
        if (this.serverProcess) {
            console.log('[RVC Server] Parando servidor RVC...');
            try {
                this.serverProcess.kill();
                this.serverProcess = null;
                this.isRunning = false;
                console.log('[RVC Server] ✅ Servidor parado com sucesso');
            } catch (error) {
                console.error('[RVC Server] Erro ao parar servidor:', error);
            }
        }
    }

    /**
     * Garantir que servidor está rodando
     * NOTA: Com wrapper minimalista, não precisamos mais de servidor HTTP
     * O wrapper é executado via child_process diretamente
     */
    async ensureServerRunning() {
        // Verificar se Python e wrapper existem
        const paths = this.getRVCPaths();
        const fs = require('fs');
        
        if (!fs.existsSync(paths.python)) {
            console.log('[RVC Server] Python não encontrado - precisa instalar');
            return false;
        }
        
        console.log('[RVC Server] ✅ Wrapper RVC pronto (modo child_process)');
        this.isRunning = true;
        return true;
    }

    /**
     * Cleanup ao fechar aplicação
     */
    cleanup() {
        this.stopServer();
    }
}

// Singleton
let instance = null;

module.exports = {
    getRVCServerManager: () => {
        if (!instance) {
            instance = new RVCServerManager();
        }
        return instance;
    }
};
