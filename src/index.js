var _ = require('lodash') // I really don't like using lodash for silly things but I need uniqBy()
const UMD = require('tsl-umd')
const EmberClient = require('node-emberplus').EmberClient
const Net = require('net');

// Get user configuration data
const config = require('../config')

let state = []
let isConnectedToVRemote = false
let isConnectedToTSL = false
let isConnectedToRossTalk = false
let MVqueue = []
let isProcessingMV = false 
let processingInterval
let sourceID = []

// The Ember+ Client for the V_Remote4 connection
const vremote = new EmberClient(config.v_remote.host, config.v_remote.port)

// Initialise the TSL server
const umd = new UMD(5001)

// The TCP Clients
const TSLClient = new Net.Socket()
const RossTalkClient = new Net.Socket()

/*
  ROSSTALK LOGIC
*/

const connectRossTalk = () => new Promise(resolve => {
if (config.rosstalk.enabled) {
    RossTalkClient.connect({ port: config.rosstalk.port, host: config.rosstalk.host }, () => {
      console.log(`RossTalk Connected to ${config.tsl.host}:${config.rosstalk.port}`)
      isConnectedToRossTalk = true
      resolve()
    })

    RossTalkClient.on('data', chunk => {
      console.log(`Data received from the server: ${chunk.toString()}.`)
    })

    RossTalkClient.on('end', () => {
      console.log('Requested an end to the TCP connection')
    })

    RossTalkClient.on('close', () => {
      console.log('Requested an end to the TCP connection')
    })

    RossTalkClient.on('error', e => {
      console.log(e)
    })
  } else resolve()
})

const processRossTalk = () => {
  if (config.rosstalk.enabled && isConnectedToRossTalk) {
    sourceID.map((id, index) => {
      if (id) {
        console.log(`Updating RossTalk mnemonic for address ${config.rosstalk.sourcemap[index]} to ${id.replace(/^\s+|\s+$/g,'').padEnd(16).slice(0, 16)}`)
        console.log(`MNEM IN:${config.rosstalk.sourcemap[index]}:${id.replace(/^\s+|\s+$/g,'').slice(0, 8)}`)
        RossTalkClient.write(`MNEM IN:${config.rosstalk.sourcemap[index]}:${id.replace(/^\s+|\s+$/g,'').slice(0, 8)}\n`)
      }
    })
  }
}

const handleRossTalkExit = () => new Promise(resolve => {
  if (config.rosstalk.enabled && isConnectedToRossTalk) {
    sourceID.map((id, index) => {
      if (id) {
        console.log(`Updating RossTalk mnemonic for address ${config.rosstalk.sourcemap[index]} to ${config.rosstalk.defaults[index]}`)
        RossTalkClient.write(`MNEM IN:${config.rosstalk.sourcemap[index]}:${config.rosstalk.defaults[index]}\n`)
      }
    })
    RossTalkClient.end()
  }
  resolve()
})

/*
  TSL LOGIC
*/

const connectTSL = () => new Promise((resolve, reject) => {
  if (config.tsl.enabled) {
    TSLClient.connect({ port: config.tsl.port, host: config.tsl.host }, () => {
      console.log(`TSL Connected to ${config.tsl.host}:${config.tsl.port}`)
      isConnectedToTSL = true
      resolve()
    })

    TSLClient.on('data', chunk => {
      console.log(`Data received from the server: ${chunk.toString()}.`)
    })

    TSLClient.on('end', () => {
      console.log('Requested an end to the TCP connection')
    })

    TSLClient.on('error', e => {
      console.log(e)
    })
  } else resolve()
})

const processTSL = () => {
  if (config.tsl.enabled && isConnectedToTSL) {
    sourceID.map((id, index) => {
      if (id) {
        console.log(`Updating TSL for address ${config.tsl.sourcemap[index]} to ${id.replace(/^\s+|\s+$/g,'').padEnd(16).slice(0, 16)}`)
        const packet = Buffer.from([ ...Buffer.from((0x80 + config.tsl.sourcemap[index].toString(16)), 'hex'), 00, ...Buffer.from(id.replace(/^\s+|\s+$/g,'').padEnd(16).slice(0, 16)) ])
        TSLClient.write(packet)
      }
    })
  }
}

const handleTSLExit = () => new Promise(resolve => {
  if (config.tsl.enabled && isConnectedToTSL) {
    if (config.rosstalk.enabled && isConnectedToRossTalk) {
      sourceID.map((id, index) => {
        if (id) {
          console.log(`Updating TSL for address ${config.tsl.sourcemap[index]} to ${config.tsl.defaults[index].replace(/^\s+|\s+$/g,'').padEnd(16).slice(0, 16)}`)
          const packet = Buffer.from([ ...Buffer.from((0x80 + config.tsl.sourcemap[index].toString(16)), 'hex'), 00, ...Buffer.from(config.tsl.defaults[index].replace(/^\s+|\s+$/g,'').padEnd(16).slice(0, 16)) ])
          TSLClient.write(packet)
        }
      })
    }
    TSLClient.end()
    resolve()
  } else resolve()
})

/*
  VREMOTE LOGIC
*/

/**
 * Returns border colour
 * @param {object} status - The current tally status object to return colour from
 */
const getBorderColour = status => {
  if ((status?.red === 0) && (status?.green === 0)) {
    return 0
  } else if (status?.red === 1) {
    return 16711680
  } else if (status?.green === 1) {
    return 65280
  } else return 0
}

// Process the current MVqueue data in order
const processMVqueue = () => {
  if (MVqueue.length !=0) {
    const currentData = MVqueue.pop() // Update from the end of the MVqueue (FIFO)
    const currentState = state[config.v_remote.pipmap.indexOf(currentData.address)]
    console.log(`Update PIP ${config.v_remote.pipmap.indexOf(currentData.address) + 1} (${currentData.label.replace(/^\s+|\s+$/g,'')}) to ${currentState.red ? 'Red' : currentState.green ? 'Green' : 'Clear'}`)
    vremote.setValue(vremote.root.getElementByPath(`1.7.${config.v_remote.pipmap.indexOf(currentData.address) + 1}.13`), getBorderColour(currentState)) // Set border colour to tally data
      .catch(console.log)
  } else {
    // Clear the interval if the MVqueue is empty to stop wasting CPU
    clearInterval(processingInterval)
    isProcessingMV = false
  }
}

/**
 * MVqueues an update
 * @param {object} tally - The tally update object
 */
const MVqueueTally = tally => {
  MVqueue.push(tally)
  _.uniqBy(MVqueue, tally => tally.address)
}

// Handle Errors
umd.server.on('error', console.log)

// Recieve TSL data and process it
umd.on('message', tally => {
  // Need to process on a loop to ensure V_Remote4 actually takes the updates
  if (!isProcessingMV) {
    processingInterval = setInterval(processMVqueue, config.processingInterval)
    isProcessingMV = true
  }

  // Create an update object with the data we want in a readable format
  const updateObject = { 
    address: tally.address,
    label: tally.label,
    green: tally.tally1,
    red: tally.tally2,
    blue: tally.tally3,
    yellow: tally.tally4
  }

  // Ensure we are only updating borders for things we actually care about
  if (config.v_remote.pipmap.includes(tally.address)) {
    state[config.v_remote.pipmap.indexOf(tally.address)] = { ...updateObject } // Keep state
    if (isConnectedToVRemote) {
      // MVqueue the change if currently connected
      MVqueueTally(tally)
    } else {
      // Log if not connected
      console.log('NOT CONNECTED TO VREMOTE')
    }
  }
})

const handleUpdate = (index, update) => {
  sourceID[index] = update.contents.value.split('sourceId=')[1]?.replace(/(\r\n|\n|\r)/gm, "")
  if (config.tsl.enabled) {
    processTSL()
  }
  if (config.rosstalk.enabled) {
    processRossTalk()
  }
}

const connectVremote = () => new Promise((resolve, reject) => {
  vremote.connect()
  .then(() => vremote.getDirectory())
  // The Ember+ Tree must be updated to correctly enable borders on the MV head
  .then(() => vremote.getElementByPath('1.7.1.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.1.12'), true))
  .then(() => vremote.getElementByPath('1.7.2.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.2.12'), true))
  .then(() => vremote.getElementByPath('1.7.3.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.3.12'), true))
  .then(() => vremote.getElementByPath('1.7.4.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.4.12'), true))
  // Getting current source IDs
  .then(() => vremote.getElementByPath('1.15.1.1.1.4'))
  .then(node => sourceID[0] = node.contents.value.split('sourceId=')[1]?.replace(/(\r\n|\n|\r)/gm, ""))
  .then(() => vremote.getElementByPath('1.15.1.1.1.4', update => { handleUpdate(0, update)}))
  .then(() => vremote.getElementByPath('1.15.1.1.2.4'))
  .then(node => sourceID[1] = node.contents.value.split('sourceId=')[1]?.replace(/(\r\n|\n|\r)/gm, ""))
  .then(() => vremote.getElementByPath('1.15.1.1.2.4', update => { handleUpdate(1, update)}))
  .then(() => vremote.getElementByPath('1.15.1.1.3.4'))
  .then(node => sourceID[2] = node.contents.value.split('sourceId=')[1]?.replace(/(\r\n|\n|\r)/gm, ""))
  .then(() => vremote.getElementByPath('1.15.1.1.3.4', update => { handleUpdate(2, update)}))
  .then(() => vremote.getElementByPath('1.15.1.1.4.4'))
  .then(node => sourceID[3] = node.contents.value.split('sourceId=')[1]?.replace(/(\r\n|\n|\r)/gm, ""))
  .then(() => vremote.getElementByPath('1.15.1.1.4.4', update => { handleUpdate(3, update)}))
  .then(() => console.log(sourceID))
  .then(() => isConnectedToVRemote = true)
  .catch(reject)
  .finally(resolve)
})

// Set all borders to black on exit
const handleVRemoteExit = () => new Promise(resolve => {
  vremote.setValue(vremote.root.getElementByPath('1.7.1.13'), 0)
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.2.13'), 0))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.3.13'), 0))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.4.13'), 0))
  .then(() => vremote.disconnect())
  .catch(e => console.log(e))
  .finally(resolve)
})

/*
  MAIN
*/

// Initalise Things
connectVremote()
  .then(() => connectTSL())
  .then(() => connectRossTalk())
  .then(() => processTSL())
  .then(() => processRossTalk())

// Handle clean exit
const handleExit = () => {
  console.log('\r')
  console.log('EXITING')
  handleVRemoteExit()
    .then(handleTSLExit())
    .then(handleRossTalkExit())
    .finally(() => process.exit(0))
}

// Catch SIGTERM and SIGINT
process.on('SIGTERM', () => handleExit())
process.on('SIGINT', () => handleExit())