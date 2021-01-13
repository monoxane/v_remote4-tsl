module.exports = {
    v_remote: {
        host: '10.10.10.10', // IP of a V_Remote Interface, only tested with 1G/1 MGMT interface but should work on the others.
        port: 9000, // Ember+ Port, usually 9000 unless you've got some interesting stuff going on.
        pipmap: [1, 2, 3, 4] // TSL Address to follow for tally updates, in order of which PIP in the MV the border will be displayed on.
    },
    tsl: {
        enabled: false, // Set to true to send TSL label updates for the inputs
        host: '10.10.10.11', // IP of the device to send label updates to
        port: 5727, // Port to send TCP TSL v3.1 data to 
        sourcemap: [5, 6, 7, 8], // TSL address to update, in order of the V_Remote4 Inputs (It's not possible to do this via outputs unfortunately)
        defaults: ['VREM1', 'VREM2', 'VREM3', 'VREM4'] // Default labels to reset on exit
    },
    rosstalk: {
        enabled: false, // Set to true to use the RossTalk MNEM command to update Carbonite Mnemonics
        host: '10.10.10.11', // IP of the device to send mnemonic updates to
        port: 7788, // Rosstalk Port (usually 7788)
        sourcemap: [5, 6, 7, 8], // Input Number to update, in order of the V_Remote4 Inputs (It's not possible to do this via outputs unfortunately)
        defaults: ['VREM1', 'VREM2', 'VREM3', 'VREM4'] // Default labels to reset on exit
    },
    processingInterval: 20 // Delay on tally update interval, if set too low the vremote will fail to update, tested with 20ms.
}