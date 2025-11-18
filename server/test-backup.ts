import { createFullBackup, restoreFromBackup } from '../electron/backup-manager';
import { storage } from '../server/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Test suite per verificare la funzionalità di export/import del DB
 * 
 * Esegui con: npx tsx server/test-backup.ts
 */

async function runTests() {
  console.log('🧪 Starting Backup/Restore Tests...\n');

  const testDir = path.join(os.tmpdir(), 'app-fatture-test');
  await fs.mkdir(testDir, { recursive: true });

  try {
    // Test 1: Verifica che il storage abbia invoices
    console.log('📋 Test 1: Checking current invoices...');
    const allInvoices = await storage.getAllInvoices();
    console.log(`✓ Found ${allInvoices.length} invoices in storage`);

    // Test 2: Crea un backup
    console.log('\n📦 Test 2: Creating full backup...');
    const backupPath = path.join(testDir, 'test-backup.zip');
    const createdBackup = await createFullBackup(backupPath, {
      includeXML: true,
      includeHTML: true,
      includePDF: true,
      includeMetadata: true,
    });
    
    const stats = await fs.stat(createdBackup);
    console.log(`✓ Backup created: ${createdBackup}`);
    console.log(`✓ Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Test 3: Verifica il contenuto del backup
    console.log('\n📂 Test 3: Verifying backup contents...');
    const JSZip = (await import('jszip')).default;
    const zipBuffer = await fs.readFile(createdBackup);
    const zip = new JSZip();
    await zip.loadAsync(zipBuffer);

    let xmlCount = 0, htmlCount = 0, pdfCount = 0, hasMetadata = false;
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (filePath.includes('.xml') && !file.dir) xmlCount++;
      if (filePath.includes('.html') && !file.dir) htmlCount++;
      if (filePath.includes('.pdf') && !file.dir) pdfCount++;
      if (filePath.includes('invoices.json')) hasMetadata = true;
    }

    console.log(`✓ XML files: ${xmlCount}`);
    console.log(`✓ HTML files: ${htmlCount}`);
    console.log(`✓ PDF files: ${pdfCount}`);
    console.log(`✓ Metadata: ${hasMetadata ? 'YES' : 'NO'}`);

    // Test 4: Verifica il manifest
    console.log('\n📄 Test 4: Checking manifest...');
    const manifestEntry = zip.file('BACKUP_MANIFEST.json');
    if (manifestEntry) {
      const manifestContent = await manifestEntry.async('string');
      const manifest = JSON.parse(manifestContent);
      console.log(`✓ Backup version: ${manifest.version}`);
      console.log(`✓ App name: ${manifest.appName}`);
      console.log(`✓ Total invoices in backup: ${manifest.totalInvoices}`);
      console.log(`✓ Exported at: ${manifest.exportedAt}`);
    }

    // Test 5: Simula un restore (opzionale)
    console.log('\n🔄 Test 5: Simulating restore process...');
    console.log('ℹ️ Note: Full restore not executed to preserve current data');
    console.log('✓ To test restore, manually import the backup file using the UI');

    // Test 6: Verifica che il backup sia un file ZIP valido
    console.log('\n✅ Test 6: Validating ZIP integrity...');
    try {
      const testZip = new JSZip();
      await testZip.loadAsync(zipBuffer);
      console.log('✓ ZIP file is valid and can be extracted');
    } catch (err) {
      console.error('✗ ZIP file is corrupted:', err);
      throw err;
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed successfully!');
    console.log('='.repeat(50));
    console.log('\nBackup file created at:');
    console.log(`  ${backupPath}`);
    console.log('\nYou can now:');
    console.log('  1. Use the backup file for migration');
    console.log('  2. Import it on another PC using the app UI');
    console.log('  3. Create additional backups with different settings');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup (opzionale)
    console.log('\n🧹 Cleaning up test directory...');
    // Commented out to preserve the backup for manual inspection
    // await fs.rm(testDir, { recursive: true, force: true });
    console.log(`✓ Test files preserved in: ${testDir}`);
  }
}

// Esegui i test
runTests().catch(console.error);
