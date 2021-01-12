var _ = require('lodash') // I really don't like using lodash for silly things but I need uniqBy()
const UMD = require('tsl-umd')
const EmberClient = require('node-emberplus').EmberClient

// Get user configuration data
const config = require('../config')

let state = []
let isConnectedToVRemote = false
let queue = []
let isProcessing = false 
let processingInterval

// The Ember+ Client for the V_Remote4 connection
const vremote = new EmberClient(config.v_remote.ip, config.v_remote.port)

// Initialise the TSL server
const umd = new UMD(5001)

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

// Process the current queue data in order
const processQueue = () => {
  if (queue.length !=0) {
    const currentData = queue.pop() // Update from the end of the queue (FIFO)
    const currentState = state[config.pipmap.indexOf(currentData.address)]
    console.log(`Update PIP ${config.pipmap.indexOf(currentData.address) + 1} (${currentData.label}) to ${currentState.red ? 'Red' : currentState.green ? 'Green' : 'Clear'}`)
    vremote.setValue(vremote.root.getElementByPath(`1.7.${config.pipmap.indexOf(currentData.address) + 1}.13`), getBorderColour(currentState)) // Set border colour to tally data
      .catch(console.log)
  } else {
    // Clear the interval if the queue is empty to stop wasting CPU
    clearInterval(processingInterval)
    isProcessing = false
  }
}

/**
 * Queues an update
 * @param {object} tally - The tally update object
 */
const queueTally = tally => {
  queue.push(tally)
  _.uniqBy(queue, tally => tally.address)
}

// Handle Errors
umd.server.on('error', console.log)

// Recieve TSL data and process it
umd.on('message', tally => {
  // Need to process on a loop to ensure V_Remote4 actually takes the updates
  if (!isProcessing) {
    processingInterval = setInterval(processQueue, config.processingInterval)
    isProcessing = true
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
  if (config.pipmap.includes(tally.address)) {
    state[config.pipmap.indexOf(tally.address)] = { ...updateObject } // Keep state
    if (isConnectedToVRemote) {
      // Queue the change if currently connected
      queueTally(tally)
    } else {
      // Log if not connected
      console.log('NOT CONNECTED TO VREMOTE')
    }
  }
})

// The Ember+ Tree must be updated to correctly enable borders on the MV head
vremote.connect()
  .then(() => vremote.getDirectory())
  .then(() => vremote.getElementByPath('1.7.1.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.1.12'), true))
  .then(() => vremote.getElementByPath('1.7.2.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.2.12'), true))
  .then(() => vremote.getElementByPath('1.7.3.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.3.12'), true))
  .then(() => vremote.getElementByPath('1.7.4.12'))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.4.12'), true))
  .then(() => isConnectedToVRemote = true)

// Set all borders to black on exit
const handleExit = () => {
  console.log('\r')
  console.log('EXITING')
  vremote.setValue(vremote.root.getElementByPath('1.7.1.13'), 0)
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.2.13'), 0))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.3.13'), 0))
  .then(() => vremote.setValue(vremote.root.getElementByPath('1.7.4.13'), 0))
  .then(() => vremote.disconnect())
  .catch(e => console.log(e))
  .finally(() => process.exit(0))
}

// Handle SIGTERM and SIGINT to clear borders
process.on('SIGTERM', () => handleExit())
process.on('SIGINT', () => handleExit())
