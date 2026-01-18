/**
 * AudioRecorder - Classe para gravação de áudio usando MediaRecorder API
 * TurboVoicer - Sistema de Gravação de Voz
 */

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.startTime = null;
        this.timerInterval = null;
        this.recordedBlob = null;
        this.isRecording = false;
    }

    /**
     * Solicitar permissão de microfone e iniciar gravação
     */
    async startRecording() {
        try {
            console.log('[AudioRecorder] Solicitando permissão de microfone...');
            
            // Solicitar acesso ao microfone
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            console.log('[AudioRecorder] Permissão concedida. Iniciando gravação...');
            
            // Criar MediaRecorder
            const options = { mimeType: 'audio/webm' };
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            // Resetar chunks
            this.audioChunks = [];
            
            // Event: dados disponíveis
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('[AudioRecorder] Chunk recebido:', event.data.size, 'bytes');
                }
            };
            
            // Event: gravação parada
            this.mediaRecorder.onstop = () => {
                console.log('[AudioRecorder] Gravação finalizada. Total de chunks:', this.audioChunks.length);
                
                // Criar blob do áudio gravado
                this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                console.log('[AudioRecorder] Blob criado:', this.recordedBlob.size, 'bytes');
                
                // Parar stream
                this.stopStream();
            };
            
            // Iniciar gravação
            this.mediaRecorder.start(1000); // Capturar chunks a cada 1 segundo
            this.isRecording = true;
            this.startTime = Date.now();
            
            // Iniciar timer
            this.startTimer();
            
            console.log('[AudioRecorder] Gravação iniciada com sucesso');
            return { success: true };
            
        } catch (error) {
            console.error('[AudioRecorder] Erro ao iniciar gravação:', error);
            
            // Mensagem de erro amigável
            let errorMessage = 'Erro ao acessar microfone.';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Permissão de microfone negada. Por favor, permita o acesso ao microfone.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'Nenhum microfone encontrado. Conecte um microfone e tente novamente.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Microfone está sendo usado por outro aplicativo.';
            }
            
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Parar gravação
     */
    stopRecording() {
        if (!this.mediaRecorder || !this.isRecording) {
            console.warn('[AudioRecorder] Nenhuma gravação ativa para parar');
            return { success: false, error: 'Nenhuma gravação ativa' };
        }
        
        console.log('[AudioRecorder] Parando gravação...');
        
        // Parar MediaRecorder
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        // Parar timer
        this.stopTimer();
        
        return { success: true };
    }

    /**
     * Parar stream de áudio
     */
    stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
                console.log('[AudioRecorder] Track parado:', track.kind);
            });
            this.stream = null;
        }
    }

    /**
     * Iniciar timer de gravação
     */
    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            const timeString = `${minutes}:${seconds}`;
            
            // Atualizar UI
            const timerEl = document.getElementById('tv-recording-timer');
            if (timerEl) {
                timerEl.textContent = timeString;
            }
        }, 1000);
    }

    /**
     * Parar timer de gravação
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Obter blob do áudio gravado
     */
    getRecordedBlob() {
        return this.recordedBlob;
    }

    /**
     * Obter URL do áudio gravado para preview
     */
    getRecordedURL() {
        if (!this.recordedBlob) {
            return null;
        }
        return URL.createObjectURL(this.recordedBlob);
    }

    /**
     * Limpar gravação atual
     */
    clear() {
        this.stopStream();
        this.stopTimer();
        this.audioChunks = [];
        this.recordedBlob = null;
        this.isRecording = false;
        
        // Resetar timer na UI
        const timerEl = document.getElementById('tv-recording-timer');
        if (timerEl) {
            timerEl.textContent = '00:00';
        }
        
        console.log('[AudioRecorder] Gravação limpa');
    }

    /**
     * Verificar se está gravando
     */
    isCurrentlyRecording() {
        return this.isRecording;
    }

    /**
     * Obter duração da gravação em segundos
     */
    getDuration() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
}

// Exportar para uso global
window.AudioRecorder = AudioRecorder;
