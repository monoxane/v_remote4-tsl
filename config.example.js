module.exports = {
    v_remote: {
        ip: '10.10.10.10', // IP of a V_Remote Interface, only tested with 1G/1 MGMT interface but should work on the others.
        port: 9000 // Ember+ Port, usually 9000 unless you've got some interesting stuff going on.
    },
    pipmap: [1, 2, 3, 4], // TSL Address to follow for tally updates, in order of which PIP in the MV the border will be displayed on.
    processingInterval: 20 // Delay on tally update interval, if set too low the vremote will fail to update, tested with 20ms.
}