// Maestro script: Launch app via ADB
async function run(maestro, parameters, outputs) {
  await maestro.shell('am start -n ru.checkonout.mobile/.MainActivity');
}
