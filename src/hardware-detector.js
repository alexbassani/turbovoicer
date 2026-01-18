const os = require('os');
const { exec, execSync } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const fs = require('fs');

/**
 * Hardware Detector for TurboVoicer
 * Detects GPU (Nvidia), CPU cores, and RAM to determine optimal processing settings
 */
class HardwareDetector {
    constructor() {
        this.cache = null;
        this.cacheTime = 0;
        this.cacheDuration = 60000; // 1 minute cache
    }

    /**
     * Detect all hardware and return profile
     */
    async detect() {
        // Return cached result if recent
        if (this.cache && (Date.now() - this.cacheTime) < this.cacheDuration) {
            return this.cache;
        }

        const hardware = {
            gpu: await this.detectGPU(),
            cpu: this.detectCPU(),
            ram: this.detectRAM(),
            platform: process.platform
        };

        const profile = this.determineProfile(hardware);

        this.cache = { hardware, profile };
        this.cacheTime = Date.now();

        console.log('[HardwareDetector] Hardware detected:', JSON.stringify(profile, null, 2));

        return this.cache;
    }

    /**
     * Detect Nvidia GPU using nvidia-smi
     */
    async detectGPU() {
        try {
            // Try nvidia-smi command
            const gpuInfo = this.detectNvidiaGPU();
            
            if (gpuInfo.disabled) {
                console.log('[HardwareDetector] GPU desabilitada - retornando perfil CPU');
                return {
                    hasNvidia: false,
                    name: 'Integrated/Other',
                    vramMB: 0,
                    vramGB: 0,
                    count: 0,
                    architecture: 'unknown'
                };
            }

            const lines = gpuInfo.stdout.trim().split('\n');
            if (lines.length > 0 && lines[0]) {
                const [name, vramMB] = lines[0].split(',').map(s => s.trim());
                const vramGB = Math.round(parseInt(vramMB) / 1024);
                
                // Detectar arquitetura da GPU
                const architecture = this.detectGPUArchitecture(name);
                
                return {
                    hasNvidia: true,
                    name: name,
                    vramMB: parseInt(vramMB),
                    vramGB: vramGB,
                    count: lines.length,
                    architecture: architecture
                };
            }
        } catch (error) {
            // nvidia-smi not found or failed
            console.log('[HardwareDetector] No Nvidia GPU detected');
        }

        return {
            hasNvidia: false,
            name: 'Integrated/Other',
            vramMB: 0,
            vramGB: 0,
            count: 0,
            architecture: 'unknown'
        };
    }

    /**
     * Check if NVIDIA GPU is disabled in Device Manager
     */
    isGPUDisabled() {
        try {
            // Usar script PowerShell em arquivo temporário para evitar problemas de escape
            const { tmpdir } = require('os');
            const tempScriptPath = path.join(tmpdir(), 'check-gpu-status.ps1');
            
            // Script PowerShell para verificar status da GPU
            const psScript = `
                $gpu = Get-PnpDevice -Class Display | Where-Object { $_.InstanceId -like 'PCI\\VEN_10DE*' } | Select-Object -First 1
                if ($gpu) {
                    Write-Output $gpu.Status
                } else {
                    Write-Output "NotFound"
                }
            `;
            
            fs.writeFileSync(tempScriptPath, psScript, 'utf8');
            
            const stdout = execSync(
                `powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
                {
                    encoding: 'utf8',
                    timeout: 5000,
                    windowsHide: true
                }
            );
            
            // Limpar arquivo temporário
            try {
                fs.unlinkSync(tempScriptPath);
            } catch (e) {
                // Ignorar erro ao deletar
            }
            
            const status = stdout.trim().toLowerCase();
            console.log('[HardwareDetector] Status da GPU NVIDIA:', status);
            
            // Status pode ser: "ok", "error", "degraded", "unknown"
            // Se não for "ok", GPU está desabilitada
            const disabled = status !== 'ok' && status !== 'notfound';
            
            if (disabled) {
                console.log('[HardwareDetector] GPU NVIDIA está desabilitada no Device Manager');
            }
            
            return disabled;
        } catch (error) {
            console.log('[HardwareDetector] Erro ao verificar status da GPU:', error.message);
            return false;
        }
    }

    /**
     * Detect Nvidia GPU
     */
    detectNvidiaGPU() {
        try {
            // Primeiro verificar se GPU está desabilitada
            if (this.isGPUDisabled()) {
                console.log('[HardwareDetector] GPU desabilitada - retornando perfil CPU');
                return {
                    hasNvidia: false,
                    name: 'Integrated/Other',
                    vramMB: 0,
                    vramGB: 0,
                    count: 0,
                    architecture: 'unknown',
                    disabled: true
                };
            }
            
            const stdout = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', {
                encoding: 'utf8',
                timeout: 5000,
                windowsHide: true
            });
            
            const lines = stdout.trim().split('\n');
            if (lines.length > 0 && lines[0]) {
                const [name, vramMB] = lines[0].split(',').map(s => s.trim());
                const vramGB = Math.round(parseInt(vramMB) / 1024);
                
                // Detectar arquitetura da GPU
                const architecture = this.detectGPUArchitecture(name);
                
                return {
                    hasNvidia: true,
                    name: name,
                    vramMB: parseInt(vramMB),
                    vramGB: vramGB,
                    count: lines.length,
                    architecture: architecture,
                    disabled: false,
                    stdout: stdout
                };
            }
        } catch (error) {
            // nvidia-smi not found or failed
            console.log('[HardwareDetector] No Nvidia GPU detected');
        }

        return {
            hasNvidia: false,
            name: 'Integrated/Other',
            vramMB: 0,
            vramGB: 0,
            count: 0,
            architecture: 'unknown',
            disabled: false
        };
    }

    /**
     * Detect GPU architecture based on model name
     */
    detectGPUArchitecture(gpuName) {
        const name = gpuName.toLowerCase();
        
        // RTX 50 Series (Blackwell) - 2025/2026
        // Detecta: RTX 5060, RTX 5070, RTX 5080, RTX 5090 (incluindo Ti)
        if (name.includes('rtx 50') || name.includes('rtx50') ||
            name.includes('geforce 50')) {
            return 'blackwell';
        }
        
        // RTX 40 Series (Ada Lovelace) - 2022/2023
        // Detecta: RTX 4060, RTX 4070, RTX 4080, RTX 4090
        if (name.includes('rtx 4060') || name.includes('rtx 4070') || 
            name.includes('rtx 4080') || name.includes('rtx 4090') ||
            name.includes('rtx4060') || name.includes('rtx4070') || 
            name.includes('rtx4080') || name.includes('rtx4090')) {
            return 'ada';
        }
        
        // RTX 30 Series (Ampere) - 2020/2021
        // Detecta: RTX 3060, RTX 3070, RTX 3080, RTX 3090
        if (name.includes('rtx 3060') || name.includes('rtx 3070') || 
            name.includes('rtx 3080') || name.includes('rtx 3090') ||
            name.includes('rtx3060') || name.includes('rtx3070') || 
            name.includes('rtx3080') || name.includes('rtx3090')) {
            return 'ampere';
        }
        
        // RTX 20 Series (Turing) - 2018/2019
        // Detecta: RTX 2060, RTX 2070, RTX 2080
        if (name.includes('rtx 2060') || name.includes('rtx 2070') || 
            name.includes('rtx 2080') || name.includes('rtx2060') || 
            name.includes('rtx2070') || name.includes('rtx2080')) {
            return 'turing';
        }
        
        // GTX 16 Series (Turing) - 2019
        // Detecta: GTX 1660, GTX 1650
        if (name.includes('gtx 1660') || name.includes('gtx 1650') ||
            name.includes('gtx1660') || name.includes('gtx1650')) {
            return 'turing';
        }
        
        // GTX 10 Series (Pascal) - 2016
        // Detecta: GTX 1060, GTX 1070, GTX 1080
        if (name.includes('gtx 1060') || name.includes('gtx 1070') || 
            name.includes('gtx 1080') || name.includes('gtx1060') || 
            name.includes('gtx1070') || name.includes('gtx1080')) {
            return 'pascal';
        }
        
        // Older or unknown
        return 'legacy';
    }

    /**
     * Verifica se GPU é incompatível com RVC-GUI/PyTorch
     * RTX 50 Series (Blackwell) não é compatível com PyTorch/CUDA atual
     * 
     * @param {string} architecture - Arquitetura da GPU
     * @param {string} gpuName - Nome da GPU
     * @returns {boolean}
     */
    needsGpuDisable(architecture, gpuName = '') {
        // RTX 50 Series (Blackwell) - CUDA 12.8+ necessário, PyTorch não suporta ainda
        // Inclui: RTX 5060, 5070, 5080, 5090
        if (architecture === 'blackwell') {
            console.log('[HardwareDetector] ⚠️ GPU Blackwell (RTX 50+) detectada - forçando CPU');
            return true;
        }
        
        // Outras GPUs são compatíveis
        return false;
    }

    /**
     * Detect CPU information
     */
    detectCPU() {
        const cpus = os.cpus();
        const cores = cpus.length;
        const model = cpus[0]?.model || 'Unknown';
        
        // Estimate performance tier based on cores
        let tier = 'low';
        if (cores >= 16) tier = 'high';
        else if (cores >= 8) tier = 'medium';

        return {
            model: model,
            cores: cores,
            tier: tier,
            speed: cpus[0]?.speed || 0
        };
    }

    /**
     * Detect RAM information
     */
    detectRAM() {
        const totalBytes = os.totalmem();
        const freeBytes = os.freemem();
        const totalGB = Math.round(totalBytes / (1024 ** 3));
        const freeGB = Math.round(freeBytes / (1024 ** 3));

        return {
            totalBytes: totalBytes,
            freeBytes: freeBytes,
            totalGB: totalGB,
            freeGB: freeGB,
            usagePercent: Math.round(((totalBytes - freeBytes) / totalBytes) * 100)
        };
    }

    /**
     * Determine processing profile based on hardware
     */
    determineProfile(hardware) {
        const { gpu, cpu, ram } = hardware;

        // GPU Profile (Nvidia detected)
        if (gpu.hasNvidia) {
            // Verificar se GPU é incompatível (RTX 50+ ou RTX 3060 para testes)
            const isIncompatible = this.needsGpuDisable(gpu.architecture, gpu.name);
            
            if (isIncompatible) {
                // GPU incompatível - FORÇAR uso de CPU ao invés de desabilitar GPU
                console.log('[HardwareDetector] GPU incompatível detectada:', gpu.name);
                console.log('[HardwareDetector] Forçando perfil CPU (GPU permanece habilitada no sistema)');
                
                return {
                    type: 'cpu',
                    name: 'CPU',
                    method: 'pm',
                    sampleRate: 32000,
                    bitrate: 96,
                    quality: 'Boa',
                    icon: '💻',
                    color: '#4facfe',
                    description: `${cpu.cores} cores, ${ram.totalGB}GB RAM`,
                    estimatedSpeed: cpu.tier === 'high' ? 'Moderado' : 'Lento',
                    warning: `⚠️ GPU ${gpu.name} não tem suporte para Motores Modificadores de Vozes. O TurboVoicer usará sua CPU.`,
                    canProcess: true,
                    maxCharsPerPartition: cpu.tier === 'high' ? 2000 : 1000,
                    gpuIncompatible: true, // Flag para bloquear seleção manual de GPU
                    incompatibleGpuName: gpu.name,
                    hardware: {
                        gpu: `${gpu.name} (incompatível)`,
                        cpu: cpu.model,
                        cores: `${cpu.cores} cores`,
                        ram: `${ram.totalGB}GB`,
                        tier: cpu.tier
                    }
                };
            }
            
            // GPU compatível - usar normalmente
            const profile = {
                type: 'gpu',
                name: 'GPU Nvidia',
                method: 'rmvpe',
                sampleRate: 32000,
                bitrate: 128,
                quality: 'Muito Boa',
                icon: '🎮',
                color: '#00ff88',
                description: `${gpu.name} (${gpu.vramGB}GB VRAM)`,
                estimatedSpeed: 'Muito Rápido',
                warning: null,
                canProcess: true,
                maxCharsPerPartition: 2000,
                architecture: gpu.architecture,
                gpuIncompatible: false,
                hardware: {
                    gpu: gpu.name,
                    vram: `${gpu.vramGB}GB`,
                    cpu: `${cpu.cores} cores`,
                    ram: `${ram.totalGB}GB`,
                    architecture: gpu.architecture
                }
            };

            return profile;
        }

        // CPU Profile (No GPU)
        return {
            type: 'cpu',
            name: 'CPU',
            method: 'pm',
            sampleRate: 32000,
            bitrate: 96,
            quality: 'Boa',
            icon: '💻',
            color: '#4facfe',
            description: `${cpu.cores} cores, ${ram.totalGB}GB RAM`,
            estimatedSpeed: cpu.tier === 'high' ? 'Moderado' : 'Lento',
            warning: cpu.tier === 'low' || ram.totalGB < 16 
                ? '⚠️ Hardware limitado. Processamento pode ser lento. Recomendamos textos curtos.'
                : 'ℹ️ Processamento via CPU. Evite outras tarefas pesadas durante a conversão.',
            canProcess: true,
            maxCharsPerPartition: cpu.tier === 'high' ? 2000 : 1000,
            hardware: {
                cpu: cpu.model,
                cores: `${cpu.cores} cores`,
                ram: `${ram.totalGB}GB`,
                tier: cpu.tier
            }
        };
    }

    /**
     * Get RVC processing config based on profile
     */
    getRVCConfig(profile, userOverride = null) {
        // User can override method but keep quality settings
        const method = userOverride?.method || profile.method;
        
        return {
            method: method,
            sampleRate: profile.sampleRate,
            bitrate: profile.bitrate,
            f0method: method, // RVC parameter
            index_rate: 0.75, // Default index influence
            filter_radius: 3, // Median filtering
            resample_sr: 0, // No resampling
            rms_mix_rate: 0.25, // Volume envelope mix
            protect: 0.33 // Protect voiceless consonants
        };
    }

    /**
     * Validate if hardware can process given text length
     */
    validateTextLength(profile, textLength) {
        const maxTotal = profile.maxCharsPerPartition * 50; // Max 50 partitions
        
        if (textLength > maxTotal) {
            return {
                valid: false,
                message: `Texto muito longo (${textLength} caracteres). Máximo recomendado: ${maxTotal} caracteres.`,
                maxChars: maxTotal
            };
        }

        if (profile.type === 'cpu' && profile.hardware.tier === 'low' && textLength > 5000) {
            return {
                valid: true,
                warning: `Texto longo para CPU limitada. Processamento pode demorar mais de ${Math.ceil(textLength / 500)} minutos.`
            };
        }

        return { valid: true };
    }
}

module.exports = HardwareDetector;
