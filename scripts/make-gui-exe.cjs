const fs = require('fs');
const path = require('path');

function patchExeToGui(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);

  // Check MZ signature
  if (buffer.readUInt16LE(0) !== 0x5a4d) {
    console.error('Not a valid PE executable (missing MZ)');
    process.exit(1);
  }

  // Get PE header offset from 0x3C
  const peOffset = buffer.readUInt32LE(0x3c);
  const peMagic = buffer.toString('ascii', peOffset, peOffset + 4);
  if (peMagic !== 'PE\0\0') {
    console.error('Not a valid PE executable (missing PE signature)');
    process.exit(1);
  }

  const coffHeaderOffset = peOffset + 4;
  const optionalHeaderOffset = coffHeaderOffset + 20;
  const optionalHeaderMagic = buffer.readUInt16LE(optionalHeaderOffset);

  // 0x10b = PE32 (32-bit), 0x20b = PE32+ (64-bit)
  if (optionalHeaderMagic !== 0x10b && optionalHeaderMagic !== 0x20b) {
    console.error('Unknown optional header magic: 0x' + optionalHeaderMagic.toString(16));
    process.exit(1);
  }

  // Subsystem field is at offset 68 (0x44) within the Optional Header for both PE32 and PE32+
  const subsystemOffset = optionalHeaderOffset + 68;
  const currentSubsystem = buffer.readUInt16LE(subsystemOffset);

  console.log(`Current PE Subsystem: ${currentSubsystem} (${currentSubsystem === 3 ? 'Console / CUI' : currentSubsystem === 2 ? 'GUI / Windows' : 'Other'})`);

  if (currentSubsystem === 3) {
    // 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI (prevents Windows from opening the black console window!)
    buffer.writeUInt16LE(2, subsystemOffset);
    fs.writeFileSync(filePath, buffer);
    console.log(`Successfully patched ${path.basename(filePath)} to GUI Subsystem (IMAGE_SUBSYSTEM_WINDOWS_GUI)!`);
    console.log('Windows will now run this EXE directly as a desktop application without opening any black console window.');
  } else if (currentSubsystem === 2) {
    console.log('Executable is already configured as GUI Subsystem.');
  } else {
    console.warn(`Unexpected subsystem ${currentSubsystem}, leaving unchanged.`);
  }
}

const targetFile = process.argv[2] || path.join(__dirname, '..', 'dist-exe', 'ToraDelia-Kiosk.exe');
patchExeToGui(targetFile);
