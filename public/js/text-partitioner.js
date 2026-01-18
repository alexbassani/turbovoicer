/**
 * Text Partitioner for TurboVoicer
 * Copied from TurboTTS partitioning system (following Golden Rule #3: Copy, Don't Share)
 * Splits long text into manageable chunks for RVC processing
 */

class TextPartitioner {
    constructor(maxCharsPerPartition = 2000) {
        this.maxCharsPerPartition = maxCharsPerPartition;
        this.partitions = [];
        this.partitionStates = [];
    }

    /**
     * Alias for partitionText (for compatibility)
     */
    partition(text, maxLen = null) {
        return this.partitionText(text, maxLen);
    }

    /**
     * Partition text into chunks respecting sentence boundaries
     * Copied from TurboTTS app_module.js partitionText()
     */
    partitionText(text, maxLen = null) {
        const limit = maxLen || this.maxCharsPerPartition;
        
        // Normalize text: remove carriage returns, multiple newlines, and extra spaces
        const normalized = text
            .replace(/\r/g, ' ')
            .replace(/\n+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        if (!normalized) return [];

        // Split by sentence endings (., !, ?)
        const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
        const parts = [];
        let current = '';

        for (const s of sentences) {
            const seg = s.trim();
            if (!seg) continue;

            const candidate = (current ? current + ' ' : '') + seg;

            if (candidate.length > limit && current) {
                // Current chunk would exceed limit, save it and start new one
                parts.push(current.trim());
                current = seg;
            } else {
                current = candidate;
            }
        }

        if (current.trim()) {
            parts.push(current.trim());
        }

        // Handle very long sentences that exceed maxLen
        const fixed = [];
        for (const p of parts) {
            if (p.length <= limit) {
                fixed.push(p);
                continue;
            }

            // Split by spaces if sentence is too long
            let start = 0;
            while (start < p.length) {
                let end = Math.min(start + limit, p.length);
                const chunk = p.slice(start, end);

                if (end < p.length) {
                    // Try to break at last space
                    const back = chunk.lastIndexOf(' ');
                    if (back > 0) {
                        end = start + back;
                    }
                }

                fixed.push(p.slice(start, end).trim());
                start = end + 1;
            }
        }

        this.partitions = fixed;
        this.initializeStates();
        
        return fixed;
    }

    /**
     * Initialize partition states for tracking progress
     */
    initializeStates() {
        this.partitionStates = this.partitions.map((text, index) => ({
            index: index,
            text: text,
            status: 'pending', // pending, processing, completed, error
            progress: 0,
            audioPath: null,
            error: null
        }));
    }

    /**
     * Update partition state
     */
    updatePartitionState(index, updates) {
        if (index >= 0 && index < this.partitionStates.length) {
            this.partitionStates[index] = {
                ...this.partitionStates[index],
                ...updates
            };
        }
    }

    /**
     * Get partition state
     */
    getPartitionState(index) {
        return this.partitionStates[index] || null;
    }

    /**
     * Get all partition states
     */
    getAllStates() {
        return this.partitionStates;
    }

    /**
     * Get total character count
     */
    getTotalChars() {
        return this.partitions.reduce((sum, p) => sum + p.length, 0);
    }

    /**
     * Get partition count
     */
    getPartitionCount() {
        return this.partitions.length;
    }

    /**
     * Get completion percentage
     */
    getCompletionPercentage() {
        if (this.partitionStates.length === 0) return 0;
        
        const completed = this.partitionStates.filter(s => s.status === 'completed').length;
        return Math.round((completed / this.partitionStates.length) * 100);
    }

    /**
     * Check if all partitions are completed
     */
    isComplete() {
        return this.partitionStates.every(s => s.status === 'completed');
    }

    /**
     * Check if any partition has error
     */
    hasErrors() {
        return this.partitionStates.some(s => s.status === 'error');
    }

    /**
     * Get error partitions
     */
    getErrorPartitions() {
        return this.partitionStates.filter(s => s.status === 'error');
    }

    /**
     * Reset all partitions to pending
     */
    reset() {
        this.partitionStates.forEach(state => {
            state.status = 'pending';
            state.progress = 0;
            state.audioPath = null;
            state.error = null;
        });
    }

    /**
     * Update partition text (for editing)
     */
    updatePartitionText(index, newText) {
        if (index >= 0 && index < this.partitions.length) {
            this.partitions[index] = newText;
            this.partitionStates[index].text = newText;
        }
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const states = this.partitionStates;
        return {
            total: states.length,
            pending: states.filter(s => s.status === 'pending').length,
            processing: states.filter(s => s.status === 'processing').length,
            completed: states.filter(s => s.status === 'completed').length,
            errors: states.filter(s => s.status === 'error').length,
            totalChars: this.getTotalChars(),
            completionPercentage: this.getCompletionPercentage()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextPartitioner;
}

// Expose to window for browser use
if (typeof window !== 'undefined') {
    window.TextPartitioner = TextPartitioner;
}
