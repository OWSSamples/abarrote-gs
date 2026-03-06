'use client';

// Comandos ESC/POS para impresoras térmicas
const ESC = '\x1B';
const GS = '\x1D';

export class ThermalPrinter {
  private port: any = null;

  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API no soportada en este navegador');
    }

    try {
      // @ts-ignore
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      return true;
    } catch (error) {
      console.error('Error conectando impresora:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  private async write(data: string) {
    if (!this.port) throw new Error('Impresora no conectada');
    
    const writer = this.port.writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(data));
    writer.releaseLock();
  }

  async printTicket(content: string) {
    await this.write(ESC + '@'); // Inicializar
    await this.write(ESC + 'a' + '\x01'); // Centrar
    await this.write(content);
    await this.write('\n\n\n');
    await this.write(GS + 'V' + '\x00'); // Cortar papel
  }

  async printBarcode(code: string, type: 'CODE128' | 'EAN13' = 'CODE128') {
    const barcodeType = type === 'CODE128' ? '\x49' : '\x43';
    await this.write(GS + 'k' + barcodeType + code + '\x00');
  }

  async openCashDrawer() {
    await this.write(ESC + 'p' + '\x00' + '\x19' + '\xFA');
  }

  isConnected() {
    return this.port !== null;
  }
}

export const printer = new ThermalPrinter();
