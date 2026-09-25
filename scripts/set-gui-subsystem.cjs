const fs = require('fs');
const path = require('path');

function setGuiSubsystem(exePath) {
  if (!fs.existsSync(exePath)) {
    console.error(`File not found: ${exePath}`);
    return false;
  }

  const fd = fs.openSync(exePath, 'r+');
  try {
    // Read DOS header e_lfanew at 0x3C
    const dosHeader = Buffer.alloc(0x40);
    fs.readSync(fd, dosHeader, 0, 0x40, 0);

    const peOffset = dosHeader.readUInt32LE(0x3C);

    // Read PE signature (4 bytes) + COFF header (20 bytes) + start of Optional Header (2 bytes magic)
    const headerBuf = Buffer.alloc(26);
    fs.readSync(fd, headerBuf, 0, 26, peOffset);

    const peSig = headerBuf.toString('ascii', 0, 4);
    if (peSig !== 'PE\0\0') {
      console.error('Invalid PE signature:', peSig);
      return false;
    }

    const optionalHeaderOffset = peOffset + 24;
    const magic = headerBuf.readUInt16LE(24);

    // For both PE32 (0x10b) and PE32+ (0x20b), the Subsystem field is at offset 68 (0x44) in the Optional Header.
    // Subsystem: 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI (no console window)
    //            3 = IMAGE_SUBSYSTEM_WINDOWS_CUI (console window)
    const subsystemOffset = optionalHeaderOffset + 68;

    const currentSubsystemBuf = Buffer.alloc(2);
    fs.readSync(fd, currentSubsystemBuf, 0, 2, subsystemOffset);
    const currentSubsystem = currentSubsystemBuf.readUInt16LE(0);

    console.log(`Current Subsystem at offset 0x${subsystemOffset.toString(16)}: ${currentSubsystem} (Magic: 0x${magic.toString(16)})`);

    const guiSubsystemBuf = Buffer.alloc(2);
    guiSubsystemBuf.writeUInt16LE(2, 0); // IMAGE_SUBSYSTEM_WINDOWS_GUI
    fs.writeSync(fd, guiSubsystemBuf, 0, 2, subsystemOffset);

    console.log(`Successfully changed Subsystem to IMAGE_SUBSYSTEM_WINDOWS_GUI (2) -> Console window disabled!`);
    return true;
  } finally {
    fs.closeSync(fd);
  }
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Usage: node set-gui-subsystem.cjs <path-to-exe>');
  process.exit(1);
}

const success = setGuiSubsystem(path.resolve(targetFile));
if (!success) {
  process.exit(1);
}
