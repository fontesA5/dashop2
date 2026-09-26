/**
 * DaShop Barcode & QR Code Camera Scanner Module
 * High-performance mobile camera scanning for UPC, EAN, Code-128, and QR codes
 * Supports torch/flashlight, camera switching, haptics & audio feedback
 */

class BarcodeScannerManager {
    constructor() {
        this.html5QrCode = null;
        this.isScanning = false;
        this.onScanCallback = null;
        this.torchOn = false;
        this.modalEl = null;
        this.audioCtx = null;
    }

    // Web Audio synthesizer for instant beep without external mp3 asset
    playBeep() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            if (!this.audioCtx) this.audioCtx = new AudioContext();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5 tone
            gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.12);
        } catch (e) {
            // Audio error non-blocking
        }

        // Haptic feedback for mobile phones
        if (navigator.vibrate) {
            navigator.vibrate([60, 40, 60]);
        }
    }

    // Build scanner modal DOM if not present
    ensureModal(title = "Scan Product Barcode") {
        let modal = document.getElementById('dashop-scanner-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dashop-scanner-modal';
            modal.className = 'fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md hidden transition-all p-4';
            modal.innerHTML = `
                <div class="relative w-full max-w-sm bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-surface-container">
                    <!-- Scanner Header -->
                    <div class="flex items-center justify-between px-5 py-4 border-b border-surface-container/60 bg-surface-container-lowest">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-[24px]">barcode_scanner</span>
                            <span id="scanner-modal-title" class="font-title-md font-bold text-on-surface text-base">${title}</span>
                        </div>
                        <button type="button" onclick="window.barcodeScanner.close()" class="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-95 transition">
                            <span class="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    <!-- Viewfinder Body -->
                    <div class="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
                        <div id="scanner-reader" class="w-full h-full"></div>

                        <!-- Reticle / Target Overlay -->
                        <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                            <div class="relative w-full h-44 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                                <!-- Laser Scanning Line Animation -->
                                <div class="absolute w-full h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse shadow-[0_0_10px_#005c55]"></div>
                                <!-- Corner Accents -->
                                <div class="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                                <div class="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                                <div class="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                                <div class="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                            </div>
                        </div>

                        <!-- Status Label -->
                        <div id="scanner-status" class="absolute bottom-3 left-4 right-4 text-center text-xs font-semibold text-white/90 bg-black/60 py-1.5 px-3 rounded-full backdrop-blur-sm pointer-events-none">
                            Point camera at barcode or QR code
                        </div>
                    </div>

                    <!-- Scanner Controls -->
                    <div class="flex items-center justify-between px-5 py-3.5 bg-surface-container-lowest border-t border-surface-container/60 gap-3">
                        <button type="button" id="scanner-torch-btn" onclick="window.barcodeScanner.toggleTorch()" class="flex-1 py-2 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-bold flex items-center justify-center gap-1.5 text-on-surface active:scale-95 transition">
                            <span class="material-symbols-outlined text-[18px]">flash_on</span>
                            <span id="scanner-torch-label">Flashlight</span>
                        </button>
                        <button type="button" onclick="window.barcodeScanner.close()" class="flex-1 py-2 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition shadow-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        document.getElementById('scanner-modal-title').textContent = title;
        this.modalEl = modal;
        return modal;
    }

    async start(callback, title = "Scan Product Barcode") {
        if (!window.Html5Qrcode) {
            alert('Scanner library is loading. Please check your internet connection and try again.');
            return;
        }

        this.onScanCallback = callback;
        const modal = this.ensureModal(title);
        modal.classList.remove('hidden');

        const statusEl = document.getElementById('scanner-status');
        if (statusEl) statusEl.textContent = 'Starting camera...';

        try {
            if (this.html5QrCode) {
                try { await this.html5QrCode.stop(); } catch(e) {}
            }

            this.html5QrCode = new Html5Qrcode("scanner-reader", {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.QR_CODE
                ],
                verbose: false
            });

            const config = {
                fps: 15,
                qrbox: { width: 260, height: 160 },
                aspectRatio: 1.0
            };

            await this.html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText, decodedResult) => {
                    this.onBarcodeDetected(decodedText);
                },
                (errorMessage) => {
                    // Ongoing scan parse errors are normal while searching
                }
            );

            this.isScanning = true;
            if (statusEl) statusEl.textContent = 'Align barcode inside frame';
        } catch (err) {
            console.error('Failed to start camera:', err);
            let userMsg = 'Camera access was denied or not available. Please allow camera permissions in your browser.';
            if (statusEl) statusEl.textContent = 'Camera permission required';
            alert(userMsg);
            this.close();
        }
    }

    async toggleTorch() {
        if (!this.html5QrCode || !this.isScanning) return;
        try {
            this.torchOn = !this.torchOn;
            await this.html5QrCode.applyVideoConstraints({
                advanced: [{ torch: this.torchOn }]
            });
            const torchLabel = document.getElementById('scanner-torch-label');
            if (torchLabel) torchLabel.textContent = this.torchOn ? 'Flash Off' : 'Flashlight';
        } catch (e) {
            console.warn('Torch not supported on this camera:', e);
        }
    }

    onBarcodeDetected(code) {
        if (!code) return;
        const cleanCode = code.trim();
        this.playBeep();
        
        // Stop scanning before executing callback
        this.close();

        if (typeof this.onScanCallback === 'function') {
            this.onScanCallback(cleanCode);
        }
    }

    async close() {
        this.isScanning = false;
        this.torchOn = false;
        if (this.html5QrCode) {
            try {
                await this.html5QrCode.stop();
                this.html5QrCode.clear();
            } catch(e) {}
        }
        if (this.modalEl) {
            this.modalEl.classList.add('hidden');
        }
    }
}

// Global instance
window.barcodeScanner = new BarcodeScannerManager();

// Global convenient helper
window.openBarcodeScanner = function(callback, title) {
    window.barcodeScanner.start(callback, title);
};
