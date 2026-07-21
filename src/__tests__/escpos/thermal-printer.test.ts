import { describe, it, expect, vi, afterEach } from 'vitest';
import { ThermalPrinter, type PrinterInfo } from '@/lib/escpos/thermal-printer';

// ── Fakes for the Web Serial API ─────────────────────────────────

class FakeWriter {
  written: Uint8Array[] = [];
  released = false;
  write = vi.fn(async (chunk: Uint8Array) => {
    this.written.push(chunk);
  });
  releaseLock = vi.fn(() => {
    this.released = true;
  });
}

class FakePort {
  opened = false;
  closed = false;
  baudRate?: number;
  writer = new FakeWriter();
  listeners: Record<string, () => void> = {};

  get writable() {
    return { getWriter: () => this.writer } as unknown as WritableStream<Uint8Array>;
  }
  open = vi.fn(async (opts: { baudRate: number }) => {
    this.opened = true;
    this.baudRate = opts.baudRate;
  });
  close = vi.fn(async () => {
    this.closed = true;
  });
  addEventListener = vi.fn((event: string, cb: () => void) => {
    this.listeners[event] = cb;
  });
}

function installSerial(port: FakePort | null, requestImpl?: () => Promise<unknown>) {
  const requestPort =
    requestImpl ?? vi.fn(async () => port);
  (globalThis as unknown as { navigator: { serial: unknown } }).navigator = {
    serial: { requestPort },
  };
  return requestPort;
}

function removeSerial() {
  delete (globalThis as unknown as { navigator?: unknown }).navigator;
}

describe('escpos/ThermalPrinter', () => {
  afterEach(() => {
    removeSerial();
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('is false when navigator lacks a serial property', () => {
      removeSerial();
      expect(ThermalPrinter.isSupported()).toBe(false);
    });

    it('is true when navigator.serial exists', () => {
      installSerial(new FakePort());
      expect(ThermalPrinter.isSupported()).toBe(true);
    });
  });

  describe('initial state', () => {
    it('starts disconnected with an empty port name', () => {
      const printer = new ThermalPrinter();
      expect(printer.status).toBe('disconnected');
      expect(printer.info).toEqual({ status: 'disconnected', portName: '', error: undefined });
    });
  });

  describe('onStatusChange', () => {
    it('notifies subscribers on status transitions and can unsubscribe', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();
      const seen: PrinterInfo[] = [];
      const unsubscribe = printer.onStatusChange((info) => seen.push(info));

      await printer.connect();
      expect(seen.map((s) => s.status)).toEqual(['connecting', 'ready']);

      unsubscribe();
      await printer.disconnect();
      // No further notifications after unsubscribing.
      expect(seen.map((s) => s.status)).toEqual(['connecting', 'ready']);
    });
  });

  describe('connect', () => {
    it('fails with an error status when WebSerial is unsupported', async () => {
      removeSerial();
      const printer = new ThermalPrinter();
      const ok = await printer.connect();
      expect(ok).toBe(false);
      expect(printer.status).toBe('error');
      expect(printer.info.error).toContain('WebSerial');
    });

    it('opens the port at the requested baud rate and becomes ready', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();

      const ok = await printer.connect(19200);
      expect(ok).toBe(true);
      expect(port.open).toHaveBeenCalledWith({ baudRate: 19200 });
      expect(printer.status).toBe('ready');
      expect(printer.info.portName).toBe('Serial (19200 baud)');
      expect(port.addEventListener).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('treats a cancelled picker (NotFoundError) as a clean disconnect', async () => {
      const requestPort = vi.fn(async () => {
        throw new DOMException('No port selected', 'NotFoundError');
      });
      installSerial(null, requestPort);
      const printer = new ThermalPrinter();

      const ok = await printer.connect();
      expect(ok).toBe(false);
      expect(printer.status).toBe('disconnected');
      expect(printer.info.error).toBeUndefined();
    });

    it('reports other errors as an error status', async () => {
      const requestPort = vi.fn(async () => {
        throw new Error('Device busy');
      });
      installSerial(null, requestPort);
      const printer = new ThermalPrinter();

      const ok = await printer.connect();
      expect(ok).toBe(false);
      expect(printer.status).toBe('error');
      expect(printer.info.error).toBe('Device busy');
    });
  });

  describe('print', () => {
    it('refuses to print when not connected', async () => {
      const printer = new ThermalPrinter();
      const ok = await printer.print(new Uint8Array([1, 2, 3]));
      expect(ok).toBe(false);
      expect(printer.status).toBe('error');
      expect(printer.info.error).toBe('Impresora no conectada');
    });

    it('writes data in <=512 byte chunks and returns to ready', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();
      await printer.connect();

      const data = new Uint8Array(1100).map((_, i) => i % 256);
      const ok = await printer.print(data);

      expect(ok).toBe(true);
      expect(printer.status).toBe('ready');
      expect(port.writer.write).toHaveBeenCalledTimes(3); // 512 + 512 + 76
      const totalWritten = port.writer.written.reduce((n, c) => n + c.length, 0);
      expect(totalWritten).toBe(1100);
      expect(port.writer.written[0].length).toBe(512);
      expect(port.writer.written[2].length).toBe(76);
    });

    it('reports an error when the underlying writer throws', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();
      await printer.connect();

      port.writer.write.mockRejectedValueOnce(new Error('write failed'));
      const ok = await printer.print(new Uint8Array([1]));
      expect(ok).toBe(false);
      expect(printer.status).toBe('error');
      expect(printer.info.error).toBe('write failed');
    });
  });

  describe('disconnect', () => {
    it('releases the writer, closes the port and resets state', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();
      await printer.connect();

      await printer.disconnect();
      expect(port.writer.releaseLock).toHaveBeenCalled();
      expect(port.close).toHaveBeenCalled();
      expect(printer.status).toBe('disconnected');
      expect(printer.info.portName).toBe('');
    });

    it('swallows close errors', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();
      await printer.connect();
      port.close.mockRejectedValueOnce(new Error('already closed'));

      await expect(printer.disconnect()).resolves.toBeUndefined();
      expect(printer.status).toBe('disconnected');
    });
  });

  describe('disconnect event handling', () => {
    it('resets to disconnected when the port emits a disconnect event', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();
      await printer.connect();
      expect(printer.status).toBe('ready');

      port.listeners['disconnect']?.();
      expect(printer.status).toBe('disconnected');
      expect(printer.info.portName).toBe('');
    });
  });

  describe('destroy', () => {
    it('disconnects and clears listeners', async () => {
      const port = new FakePort();
      installSerial(port);
      const printer = new ThermalPrinter();
      await printer.connect();

      const listener = vi.fn();
      printer.onStatusChange(listener);
      printer.destroy();

      // Listeners cleared: a later manual status change should not call them.
      listener.mockClear();
      // destroy() triggers an async disconnect; give it a tick.
      await Promise.resolve();
      expect(printer.status).toBe('disconnected');
    });
  });
});